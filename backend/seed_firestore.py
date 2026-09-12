#!/usr/bin/env python3
"""
seed_firestore.py

Initializes and seeds Cloud Firestore with the required initial collections:
- turbines/{turbine_id}
- turbines/{turbine_id}/readings (initial baseline readings)
- turbines/{turbine_id}/maintenance_log (initial setup log)
- simulation_state/current
- model_metrics/latest
- fleet_summary/current

Can be run via Firebase Admin SDK (with service account) or prints Firestore REST instructions.
"""

import os
import sys
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from firebase_setup import get_db

INITIAL_TURBINES = [
    {
        "turbine_id": 1,
        "name": "Turbine 1",
        "type": "wind",
        "location": "Sector Alpha - Ridge North",
        "installed_date": datetime(2023, 4, 15, 0, 0, 0, tzinfo=timezone.utc),
        "current_risk_level": "Low",
        "current_anomaly_score": 0.375,
        "last_updated": datetime.now(timezone.utc),
        "latest_reading": {
            "wind_speed": 8.79,
            "rpm": 12.54,
            "gearbox_temp": 50.28,
            "bearing_vibration": 1.222,
            "power_output": 536.94,
            "ambient_temp": 16.5,
        },
    },
    {
        "turbine_id": 2,
        "name": "Turbine 2",
        "type": "wind",
        "location": "Sector Alpha - Ridge Center",
        "installed_date": datetime(2023, 4, 20, 0, 0, 0, tzinfo=timezone.utc),
        "current_risk_level": "Low",
        "current_anomaly_score": 0.395,
        "last_updated": datetime.now(timezone.utc),
        "latest_reading": {
            "wind_speed": 9.12,
            "rpm": 12.91,
            "gearbox_temp": 52.14,
            "bearing_vibration": 1.205,
            "power_output": 612.45,
            "ambient_temp": 16.8,
        },
    },
    {
        "turbine_id": 3,
        "name": "Turbine 3",
        "type": "wind",
        "location": "Sector Beta - Valley Inflow",
        "installed_date": datetime(2023, 5, 2, 0, 0, 0, tzinfo=timezone.utc),
        "current_risk_level": "Low",
        "current_anomaly_score": 0.405,
        "last_updated": datetime.now(timezone.utc),
        "latest_reading": {
            "wind_speed": 8.65,
            "rpm": 12.40,
            "gearbox_temp": 51.05,
            "bearing_vibration": 1.215,
            "power_output": 542.10,
            "ambient_temp": 16.2,
        },
    },
    {
        "turbine_id": 4,
        "name": "Turbine 4",
        "type": "wind",
        "location": "Sector Beta - Valley Outflow",
        "installed_date": datetime(2023, 5, 10, 0, 0, 0, tzinfo=timezone.utc),
        "current_risk_level": "Low",
        "current_anomaly_score": 0.412,
        "last_updated": datetime.now(timezone.utc),
        "latest_reading": {
            "wind_speed": 9.45,
            "rpm": 13.20,
            "gearbox_temp": 53.40,
            "bearing_vibration": 1.228,
            "power_output": 680.90,
            "ambient_temp": 17.1,
        },
    },
    {
        "turbine_id": 5,
        "name": "Turbine 5",
        "type": "wind",
        "location": "Sector Gamma - High Peak",
        "installed_date": datetime(2023, 6, 1, 0, 0, 0, tzinfo=timezone.utc),
        "current_risk_level": "Low",
        "current_anomaly_score": 0.392,
        "last_updated": datetime.now(timezone.utc),
        "latest_reading": {
            "wind_speed": 8.95,
            "rpm": 12.75,
            "gearbox_temp": 51.80,
            "bearing_vibration": 1.198,
            "power_output": 585.20,
            "ambient_temp": 16.4,
        },
    },
]

MODEL_METRICS_DATA = {
    "precision": 0.2473,
    "recall": 0.5046,
    "detection_lead_time_days": 23.5,
    "false_positive_rate": 0.0669,
    "evaluated_at": datetime.now(timezone.utc),
}

FLEET_SUMMARY_DATA = {
    "count_low": 5,
    "count_medium": 0,
    "count_high": 0,
    "count_critical": 0,
    "total_estimated_revenue_at_risk": 0.0,
    "last_computed": datetime.now(timezone.utc),
}

SIMULATION_STATE_DATA = {
    "status": "stopped",
    "speed": "10x",
    "current_row_index": 0,
    "current_simulated_timestamp": datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc),
    "dataset_source": "live_input_dataset.csv",
}


def seed_database():
    db = get_db()
    if db is None:
        print("[!] No Firestore client available. Please ensure backend/serviceAccountKey.json is present.")
        return False

    print("[*] Seeding Firestore with schema...")

    # 1. Turbines collection
    for turbine in INITIAL_TURBINES:
        tid = str(turbine["turbine_id"])
        doc_ref = db.collection("turbines").document(tid)
        doc_ref.set(turbine)
        print(f"  [✓] Set turbines/{tid}")

        # Seed initial reading subcollection
        reading_ref = doc_ref.collection("readings").document("init_001")
        reading_ref.set({
            "timestamp": turbine["last_updated"],
            **turbine["latest_reading"],
            "anomaly_score": turbine["current_anomaly_score"],
            "risk_level": turbine["current_risk_level"],
            "is_fault": 0,
        })

        # Seed initial maintenance log
        log_ref = doc_ref.collection("maintenance_log").document("init_log")
        log_ref.set({
            "timestamp": turbine["installed_date"],
            "technician_name": "Commissioning Engineer",
            "action": "inspected",
            "notes": "Turbine commissioned and operational baseline validated.",
        })

    # 2. Simulation State (single document: simulation_state/current)
    db.collection("simulation_state").document("current").set(SIMULATION_STATE_DATA)
    print("  [✓] Set simulation_state/current")

    # 3. Model Metrics (single document: model_metrics/latest)
    db.collection("model_metrics").document("latest").set(MODEL_METRICS_DATA)
    print("  [✓] Set model_metrics/latest")

    # 4. Fleet Summary (single document: fleet_summary/current)
    db.collection("fleet_summary").document("current").set(FLEET_SUMMARY_DATA)
    print("  [✓] Set fleet_summary/current")

    print("[✓] Firestore seeding completed successfully!")
    return True


if __name__ == "__main__":
    seed_database()
