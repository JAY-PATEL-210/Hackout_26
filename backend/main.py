#!/usr/bin/env python3
"""
backend/main.py

FastAPI application for the Predictive Maintenance Platform.
Exposes REST API endpoints consumed by the User, Technician, and Manager dashboards,
as well as the live SCADA simulator control.

Data Source: backend/data/live_input_dataset.csv (scored via score.py)
Empirical Power Curve: built at startup from healthy rows of training_dataset.csv
Concurrency: Thread-safe in-memory simulation state protected by an asyncio.Lock.
"""

import os
import sys
import json
import pickle
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure backend directory is in python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from score import score_dataframe

app = FastAPI(
    title="Predictive Maintenance Platform API",
    description="REST API for fleet-wide wind turbine anomaly detection, diagnostics, and simulation.",
    version="1.0.0"
)

# CORS Middleware allowing requests from Vite frontend (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ==============================================================================
# 1. EMPIRICAL POWER CURVE LOOKUP TABLE
# ==============================================================================
def build_expected_power_lookup() -> Dict[int, float]:
    """
    Builds an empirical power curve lookup table by binning healthy rows of
    training_dataset.csv into 1 m/s wind_speed buckets.
    Avoids linear regression since power curves are cubic-then-capped S-curves.
    """
    training_path = os.path.join(BASE_DIR, "data", "training_dataset.csv")
    if not os.path.exists(training_path):
        # Fallback if training_dataset not present
        return {ws: float(min(2000.0, max(0.0, ((ws - 3.0) / 9.0) ** 3 * 2000.0))) for ws in range(30)}

    df_train = pd.read_csv(training_path)
    # Healthy rows only: exclude turbine 3
    healthy_df = df_train[df_train["turbine_id"] != 3].copy()
    healthy_df["ws_bucket"] = healthy_df["wind_speed"].round().astype(int)

    lookup = healthy_df.groupby("ws_bucket")["power_output"].mean().to_dict()
    # Fill standard buckets from 0 to 25 m/s
    complete_lookup = {}
    for ws in range(26):
        if ws in lookup:
            complete_lookup[ws] = round(float(lookup[ws]), 2)
        elif ws < 3:
            complete_lookup[ws] = 0.0
        elif ws >= 12:
            complete_lookup[ws] = 2000.0
        else:
            # Nearest bucket interpolation
            nearest = min(lookup.keys(), key=lambda k: abs(k - ws))
            complete_lookup[ws] = round(float(lookup[nearest]), 2)

    return complete_lookup


EXPECTED_POWER_LOOKUP = build_expected_power_lookup()


def get_expected_power(wind_speed: float) -> float:
    """Looks up expected power in kW for a given wind speed using 1 m/s buckets."""
    bucket = int(round(wind_speed))
    if bucket in EXPECTED_POWER_LOOKUP:
        return EXPECTED_POWER_LOOKUP[bucket]
    min_b = min(EXPECTED_POWER_LOOKUP.keys())
    max_b = max(EXPECTED_POWER_LOOKUP.keys())
    if bucket < min_b:
        return EXPECTED_POWER_LOOKUP[min_b]
    return EXPECTED_POWER_LOOKUP[max_b]


# ==============================================================================
# 2. STATIC PHASE 4 MODEL EVALUATION METRICS
# ==============================================================================
MODEL_EVALUATION_METRICS = {
    "evaluation_dataset": "live_input_dataset.csv (held-out, never seen during training)",
    "precision": 0.2473,
    "recall": 0.5046,
    "f1_score": 0.3319,
    "detection_lead_time_days": 23.5,
    "detection_lead_time_hours": 564.0,
    "false_positive_rate_healthy_turbines": 0.0669,
    "flag_attribution": {
        "total_high_critical_flags": 1763,
        "ml_score_alone_count": 1082,
        "ml_score_alone_pct": 61.4,
        "safety_backstop_alone_count": 393,
        "safety_backstop_alone_pct": 22.3,
        "both_ml_and_backstop_count": 288,
        "both_ml_and_backstop_pct": 16.3,
        "ml_model_involved_pct": 77.7,
        "safety_backstop_involved_pct": 38.6
    }
}


# ==============================================================================
# 3. THREAD-SAFE SIMULATION STATE MANAGER
# ==============================================================================
class SimulationManager:
    """
    Manages live streaming replay of live_input_dataset.csv.
    Protected by an asyncio.Lock to guarantee thread-safe, consistent reads & writes.
    """
    def __init__(self):
        self.lock = asyncio.Lock()
        self.is_playing = False
        self.is_paused = False
        self.speed = "10x"
        self.current_step = 0
        self.total_steps = 0
        self.timestamps: List[str] = []
        self.dataset_by_step: List[List[Dict[str, Any]]] = []
        self.all_turbines: List[int] = [1, 2, 3, 4, 5]
        
        # In-memory current state per turbine
        self.latest_readings: Dict[int, Dict[str, Any]] = {}
        self.history_by_turbine: Dict[int, List[Dict[str, Any]]] = {
            tid: [] for tid in self.all_turbines
        }
        self.bg_task: Optional[asyncio.Task] = None
        self._initialized = False

    def initialize_data(self):
        if self._initialized:
            return
        live_path = os.path.join(BASE_DIR, "data", "live_input_dataset.csv")
        cache_path = os.path.join(BASE_DIR, "data", "cached_live_scored.pkl")

        if not os.path.exists(live_path):
            raise FileNotFoundError(f"Missing live dataset at: {live_path}")

        # Demo mode safeguard: load pre-scored cached sequence if available and up-to-date
        if os.path.exists(cache_path) and os.path.getmtime(cache_path) >= os.path.getmtime(live_path):
            print(f"[SimulationManager: DEMO MODE] Loading verified pre-scored cache from {cache_path}...", flush=True)
            try:
                with open(cache_path, "rb") as f:
                    cached = pickle.load(f)
                self.timestamps = cached["timestamps"]
                self.dataset_by_step = cached["dataset_by_step"]
                self.total_steps = len(self.timestamps)
                self.reset_sync()
                self._initialized = True
                print(f"[SimulationManager: DEMO MODE] Ready. Replaying verified sequence ({self.total_steps} steps, instant startup).", flush=True)
                return
            except Exception as err:
                print(f"[SimulationManager] Warning: could not load cache ({err}). Re-scoring...", flush=True)

        print("[SimulationManager] Loading and pre-scoring live_input_dataset.csv...", flush=True)
        raw_df = pd.read_csv(live_path)
        scored_df = score_dataframe(raw_df)

        # Ensure sorted by timestamp
        scored_df["timestamp_dt"] = pd.to_datetime(scored_df["timestamp"])
        scored_df = scored_df.sort_values(["timestamp_dt", "turbine_id"]).reset_index(drop=True)

        # Group by timestamp so all turbines at step t advance together
        grouped = scored_df.groupby("timestamp", sort=False)
        self.timestamps = list(grouped.groups.keys())
        self.total_steps = len(self.timestamps)

        self.dataset_by_step = []
        for ts, group in grouped:
            rows = group.drop(columns=["timestamp_dt"], errors="ignore").to_dict(orient="records")
            self.dataset_by_step.append(rows)

        # Cache pre-scored sequence for future instant restarts
        try:
            with open(cache_path, "wb") as f:
                pickle.dump({
                    "timestamps": self.timestamps,
                    "dataset_by_step": self.dataset_by_step
                }, f)
            print(f"[SimulationManager: DEMO MODE] Successfully cached pre-scored dataset to {cache_path}", flush=True)
        except Exception as err:
            print(f"[SimulationManager] Warning: failed to save pre-score cache: {err}", flush=True)

        # Initial baseline state (step 0 populated so turbines show normal status)
        self.reset_sync()
        self._initialized = True
        print(f"[SimulationManager] Ready. {self.total_steps} simulation steps loaded.", flush=True)

    def reset_sync(self):
        """Synchronous reset of simulation state to step 0."""
        self.current_step = 0
        self.is_playing = False
        self.is_paused = False
        self.latest_readings = {}
        self.history_by_turbine = {tid: [] for tid in self.all_turbines}

        # Initialize with first step (or first 5 readings)
        initial_steps = min(5, self.total_steps)
        for s in range(initial_steps):
            for row in self.dataset_by_step[s]:
                tid = int(row["turbine_id"])
                self.latest_readings[tid] = row
                self.history_by_turbine[tid].append(row)
        self.current_step = initial_steps

    async def reset(self):
        async with self.lock:
            if self.bg_task and not self.bg_task.done():
                self.bg_task.cancel()
            self.reset_sync()

    async def pause(self):
        async with self.lock:
            self.is_playing = False
            self.is_paused = True

    async def start_replay(self, speed: str = "10x"):
        async with self.lock:
            self.speed = speed
            self.is_playing = True
            self.is_paused = False

            # If task already running, speed was updated in place
            if self.bg_task and not self.bg_task.done():
                return

            # Start background asyncio loop
            self.bg_task = asyncio.create_task(self._run_loop())

    async def _run_loop(self):
        """Background replay worker advancing one timestamp step at a time."""
        try:
            while True:
                # Determine delay based on current speed
                spd = self.speed.lower().strip()
                if spd == "100x":
                    delay = 0.01
                elif spd == "10x":
                    delay = 0.1
                else:  # 1x default
                    delay = 1.0

                await asyncio.sleep(delay)

                async with self.lock:
                    if not self.is_playing or self.is_paused:
                        break
                    if self.current_step >= self.total_steps:
                        self.is_playing = False
                        break

                    # Advance one timestamp step across all turbines
                    rows = self.dataset_by_step[self.current_step]
                    for row in rows:
                        tid = int(row["turbine_id"])
                        self.latest_readings[tid] = row
                        self.history_by_turbine[tid].append(row)
                    self.current_step += 1

        except asyncio.CancelledError:
            pass


sim_manager = SimulationManager()


@app.on_event("startup")
def startup_event():
    sim_manager.initialize_data()


# ==============================================================================
# 4. API ENDPOINTS
# ==============================================================================

def get_status_string(turbine_id: int, risk_level: str) -> str:
    """Generates a plain-English status string from risk_level in backend."""
    if risk_level in ["Critical"]:
        return f"Turbine {turbine_id} critical fault detected — immediate action required"
    elif risk_level in ["High"]:
        return f"Turbine {turbine_id} needs attention"
    elif risk_level in ["Medium"]:
        return f"Turbine {turbine_id} running with early warning deviation"
    else:
        return "Running normally"


@app.get("/")
def root():
    return {
        "service": "Predictive Maintenance Platform API",
        "status": "online",
        "endpoints": [
            "/assets",
            "/assets/{turbine_id}/history",
            "/assets/{turbine_id}/impact",
            "/assets/{turbine_id}/queue-priority",
            "/fleet/summary",
            "/simulate/replay",
            "/simulate/reset",
            "/simulate/pause"
        ]
    }


# ------------------------------------------------------------------------------
# GET /assets
# ------------------------------------------------------------------------------
@app.get("/assets")
async def get_assets(response: Response):
    """
    Returns a list of all turbines with:
      - turbine_id
      - latest risk_level
      - latest sensor readings
      - last-updated timestamp
      - one-line plain-English status string
    """
    async with sim_manager.lock:
        response.headers["X-Current-Step"] = str(sim_manager.current_step)
        response.headers["X-Total-Steps"] = str(sim_manager.total_steps)
        response.headers["X-Rows-Processed"] = str(sim_manager.current_step * len(sim_manager.all_turbines))
        response.headers["X-Simulation-Status"] = "playing" if sim_manager.is_playing else ("paused" if sim_manager.is_paused else "idle")
        response.headers["X-Simulation-Speed"] = str(sim_manager.speed)

        assets = []
        for tid in sorted(sim_manager.all_turbines):
            row = sim_manager.latest_readings.get(tid)
            if not row:
                continue

            risk = row.get("risk_level", "Low")
            assets.append({
                "turbine_id": tid,
                "risk_level": risk,
                "status": get_status_string(tid, risk),
                "last_updated": row.get("timestamp"),
                "anomaly_score": float(row.get("anomaly_score", 0.0)),
                "why_flagged": row.get("why_flagged", []),
                "sensor_readings": {
                    "wind_speed": float(row.get("wind_speed", 0.0)),
                    "rpm": float(row.get("rpm", 0.0)),
                    "gearbox_temp": float(row.get("gearbox_temp", 0.0)),
                    "bearing_vibration": float(row.get("bearing_vibration", 0.0)),
                    "power_output": float(row.get("power_output", 0.0)),
                    "ambient_temp": float(row.get("ambient_temp", 0.0))
                }
            })
        return assets


# ------------------------------------------------------------------------------
# GET /assets/{turbine_id}/history?range=24h|7d|30d
# ------------------------------------------------------------------------------
@app.get("/assets/{turbine_id}/history")
async def get_turbine_history(
    turbine_id: int,
    range: str = Query("24h", pattern="^(24h|7d|30d)$")
):
    """
    Returns time-series sensor readings + risk_level + anomaly_score for charting.
    Supported ranges: 24h, 7d, 30d.
    """
    async with sim_manager.lock:
        if turbine_id not in sim_manager.history_by_turbine:
            raise HTTPException(status_code=404, detail=f"Turbine {turbine_id} not found")

        history = sim_manager.history_by_turbine[turbine_id]
        if not history:
            return []

        # 10-minute intervals: 24h=144 readings, 7d=1008 readings, 30d=4320 readings
        limit_map = {"24h": 144, "7d": 1008, "30d": 4320}
        n_rows = limit_map.get(range, 144)
        sliced = history[-n_rows:]

        results = []
        for row in sliced:
            results.append({
                "timestamp": row.get("timestamp"),
                "wind_speed": float(row.get("wind_speed", 0.0)),
                "rpm": float(row.get("rpm", 0.0)),
                "gearbox_temp": float(row.get("gearbox_temp", 0.0)),
                "bearing_vibration": float(row.get("bearing_vibration", 0.0)),
                "power_output": float(row.get("power_output", 0.0)),
                "anomaly_score": float(row.get("anomaly_score", 0.0)),
                "risk_level": row.get("risk_level", "Low"),
                "why_flagged": row.get("why_flagged", [])
            })
        return results


# ------------------------------------------------------------------------------
# GET /assets/{turbine_id}/impact
# ------------------------------------------------------------------------------
@app.get("/assets/{turbine_id}/impact")
async def get_turbine_impact(turbine_id: int):
    """
    Computes revenue loss from equipment degradation:
    1. Looks up expected power from empirical wind speed power curve table.
    2. Clips power deficit: max(0, expected_power - actual_power).
    3. Multiplies by price_per_kwh ($0.12) and hours_affected (rows at Medium+ risk).
    4. Returns days_since_degradation_started if current risk is Medium+, else null.
    """
    async with sim_manager.lock:
        if turbine_id not in sim_manager.history_by_turbine:
            raise HTTPException(status_code=404, detail=f"Turbine {turbine_id} not found")

        history = sim_manager.history_by_turbine[turbine_id]
        latest = sim_manager.latest_readings.get(turbine_id)
        if not latest or not history:
            return {
                "turbine_id": turbine_id,
                "current_risk_level": "Low",
                "revenue_loss": 0.0,
                "hours_affected": 0.0,
                "days_since_degradation_started": None,
                "degradation_start_timestamp": None
            }

        current_risk = latest.get("risk_level", "Low")
        price_per_kwh = 0.12
        interval_hours = 10.0 / 60.0  # 10-minute intervals

        # Find when risk first reached Medium or above
        medium_plus_rows = []
        first_med_ts = None
        for r in history:
            if r.get("risk_level") in ["Medium", "High", "Critical"]:
                if first_med_ts is None:
                    first_med_ts = r.get("timestamp")
                medium_plus_rows.append(r)

        is_currently_degraded = current_risk in ["Medium", "High", "Critical"]

        if not is_currently_degraded or first_med_ts is None:
            return {
                "turbine_id": turbine_id,
                "current_risk_level": current_risk,
                "revenue_loss": 0.0,
                "hours_affected": 0.0,
                "days_since_degradation_started": None,
                "degradation_start_timestamp": None,
                "price_per_kwh": price_per_kwh
            }

        # Calculate affected hours and cumulative revenue loss
        hours_affected = round(len(medium_plus_rows) * interval_hours, 2)

        total_loss = 0.0
        for r in medium_plus_rows:
            ws = float(r.get("wind_speed", 0.0))
            act_pwr = float(r.get("power_output", 0.0))
            exp_pwr = get_expected_power(ws)
            deficit_kw = max(0.0, exp_pwr - act_pwr)
            # kWh lost in 10 minutes = deficit_kw * (10 / 60)
            kwh_lost = deficit_kw * interval_hours
            total_loss += kwh_lost * price_per_kwh

        # Days since degradation started
        first_dt = pd.to_datetime(first_med_ts)
        curr_dt = pd.to_datetime(latest.get("timestamp"))
        days_since = round(max(0.0, (curr_dt - first_dt).total_seconds() / 86400.0), 2)

        # Expected and actual for latest reading
        latest_ws = float(latest.get("wind_speed", 0.0))
        latest_exp = get_expected_power(latest_ws)
        latest_act = float(latest.get("power_output", 0.0))

        return {
            "turbine_id": turbine_id,
            "current_risk_level": current_risk,
            "expected_power_kw": latest_exp,
            "actual_power_kw": latest_act,
            "current_power_loss_kw": round(max(0.0, latest_exp - latest_act), 2),
            "hours_affected": hours_affected,
            "price_per_kwh": price_per_kwh,
            "revenue_loss": round(total_loss, 2),
            "days_since_degradation_started": days_since,
            "degradation_start_timestamp": first_med_ts
        }


# ------------------------------------------------------------------------------
# GET /assets/{turbine_id}/queue-priority
# ------------------------------------------------------------------------------
@app.get("/assets/{turbine_id}/queue-priority")
async def get_queue_priority(turbine_id: int):
    """
    Returns a unified priority score combining risk level severity, estimated
    revenue loss, and anomaly score, used to order the technician maintenance queue.
    """
    async with sim_manager.lock:
        latest = sim_manager.latest_readings.get(turbine_id)
        history = sim_manager.history_by_turbine.get(turbine_id, [])
        if not latest:
            raise HTTPException(status_code=404, detail=f"Turbine {turbine_id} not found")

        risk = latest.get("risk_level", "Low")
        score = float(latest.get("anomaly_score", 0.0))

        # Risk base scores
        risk_weight_map = {
            "Critical": 400.0,
            "High": 300.0,
            "Medium": 150.0,
            "Low": 0.0
        }
        base_risk = risk_weight_map.get(risk, 0.0)

        # Calculate revenue impact component
        price_per_kwh = 0.12
        interval_hours = 10.0 / 60.0
        loss_val = 0.0
        if risk in ["Medium", "High", "Critical"]:
            for r in history:
                if r.get("risk_level") in ["Medium", "High", "Critical"]:
                    exp = get_expected_power(float(r.get("wind_speed", 0.0)))
                    act = float(r.get("power_output", 0.0))
                    loss_val += max(0.0, exp - act) * interval_hours * price_per_kwh

        # Combined priority score
        priority_score = round(base_risk + (score * 50.0) + min(150.0, loss_val * 0.1), 1)

        return {
            "turbine_id": turbine_id,
            "priority_score": priority_score,
            "risk_level": risk,
            "anomaly_score": score,
            "estimated_revenue_loss": round(loss_val, 2),
            "status": get_status_string(turbine_id, risk),
            "why_flagged": latest.get("why_flagged", [])
        }


# ------------------------------------------------------------------------------
# GET /fleet/summary
# ------------------------------------------------------------------------------
@app.get("/fleet/summary")
async def get_fleet_summary():
    """
    Returns:
    - fleet-wide counts of turbines by risk level
    - total estimated revenue at risk (sum of /impact across all turbines)
    - Phase 4 model evaluation metrics (precision, recall, lead time, FPR, flag breakdown)
    """
    async with sim_manager.lock:
        risk_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
        total_revenue_loss = 0.0
        price_per_kwh = 0.12
        interval_hours = 10.0 / 60.0

        for tid in sim_manager.all_turbines:
            latest = sim_manager.latest_readings.get(tid)
            if latest:
                r_level = latest.get("risk_level", "Low")
                risk_counts[r_level] = risk_counts.get(r_level, 0) + 1

                if r_level in ["Medium", "High", "Critical"]:
                    hist = sim_manager.history_by_turbine.get(tid, [])
                    for r in hist:
                        if r.get("risk_level") in ["Medium", "High", "Critical"]:
                            exp = get_expected_power(float(r.get("wind_speed", 0.0)))
                            act = float(r.get("power_output", 0.0))
                            total_revenue_loss += max(0.0, exp - act) * interval_hours * price_per_kwh

        return {
            "total_turbines": len(sim_manager.all_turbines),
            "risk_distribution": risk_counts,
            "total_revenue_at_risk": round(total_revenue_loss, 2),
            "simulated_timestamp": sim_manager.timestamps[min(sim_manager.current_step, len(sim_manager.timestamps) - 1)] if sim_manager.timestamps else None,
            "simulation_progress_pct": round((sim_manager.current_step / max(1, sim_manager.total_steps)) * 100.0, 1),
            "model_evaluation": MODEL_EVALUATION_METRICS
        }


# ------------------------------------------------------------------------------
# SIMULATION CONTROL ENDPOINTS
# ------------------------------------------------------------------------------
@app.get("/simulate/replay")
async def simulate_replay(speed: str = Query("10x", pattern="^(1x|10x|100x)$")):
    """Starts or updates replay of live_input_dataset.csv in timestamp order."""
    await sim_manager.start_replay(speed=speed)
    async with sim_manager.lock:
        curr_ts = sim_manager.timestamps[min(sim_manager.current_step, len(sim_manager.timestamps) - 1)] if sim_manager.timestamps else None
        return {
            "status": "playing",
            "speed": sim_manager.speed,
            "current_step": sim_manager.current_step,
            "total_steps": sim_manager.total_steps,
            "simulated_timestamp": curr_ts,
            "progress_pct": round((sim_manager.current_step / max(1, sim_manager.total_steps)) * 100.0, 1)
        }


@app.post("/simulate/reset")
async def simulate_reset():
    """Resets playback to the beginning."""
    await sim_manager.reset()
    async with sim_manager.lock:
        curr_ts = sim_manager.timestamps[0] if sim_manager.timestamps else None
        return {
            "status": "reset",
            "current_step": sim_manager.current_step,
            "simulated_timestamp": curr_ts,
            "message": "Simulation reset to beginning."
        }


@app.post("/simulate/pause")
async def simulate_pause():
    """Pauses playback."""
    await sim_manager.pause()
    async with sim_manager.lock:
        curr_ts = sim_manager.timestamps[min(sim_manager.current_step, len(sim_manager.timestamps) - 1)] if sim_manager.timestamps else None
        return {
            "status": "paused",
            "current_step": sim_manager.current_step,
            "simulated_timestamp": curr_ts,
            "message": "Simulation paused."
        }


@app.get("/simulate/status")
async def simulate_status():
    """Returns the current simulation playback status and metrics."""
    async with sim_manager.lock:
        curr_ts = sim_manager.timestamps[min(sim_manager.current_step, len(sim_manager.timestamps) - 1)] if sim_manager.timestamps else None
        return {
            "status": "playing" if sim_manager.is_playing else ("paused" if sim_manager.is_paused else "idle"),
            "is_playing": sim_manager.is_playing,
            "is_paused": sim_manager.is_paused,
            "speed": sim_manager.speed,
            "current_step": sim_manager.current_step,
            "total_steps": sim_manager.total_steps,
            "rows_processed": sim_manager.current_step * len(sim_manager.all_turbines),
            "simulated_timestamp": curr_ts,
            "progress_pct": round((sim_manager.current_step / max(1, sim_manager.total_steps)) * 100.0, 1)
        }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
