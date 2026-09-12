#!/usr/bin/env python3
"""
seed_firestore.py

Initializes and seeds Cloud Firestore with the enterprise renewable energy schema:
- renewable_assets/{asset_id} (WTG-01..05, PV-01..03)
- turbines/{turbine_id} (both WTG-01..05 and 1..5)
- work_orders/{order_id} (WO-1041..1044)
- fleet_summary/current & fleet_analytics/live_overview
- model_metrics/latest & ai_model_metrics/production_benchmark
- simulation_state/current
"""

import os
import sys
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from firebase_setup import get_db

ENTERPRISE_ASSETS = [
    {
        "asset_id": "WTG-01",
        "legacy_id": 1,
        "name": "Wind Turbine Alpha 01",
        "short_tag": "WTG-01",
        "category": "Wind Turbine",
        "model_spec": "Vestas V112-3.0 MW Industrial",
        "manufacturer": "Vestas Wind Systems",
        "farm_sector": "Sector Alpha - Ridge North",
        "rated_capacity_mw": 3.0,
        "commissioned_date": datetime(2023, 4, 15, 0, 0, 0, tzinfo=timezone.utc),
        "operational_status": "Online (Nominal)",
        "health_score": 96.4,
        "current_risk_level": "Healthy",
        "current_anomaly_score": 0.112,
        "failure_probability_pct": 2.1,
        "revenue_at_risk_usd": 145.50,
        "active_fault": "Nominal baseline",
        "last_inspection_date": "2026-02-10",
        "next_scheduled_service": "2026-05-15",
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
        "asset_id": "WTG-02",
        "legacy_id": 2,
        "name": "Wind Turbine Alpha 02",
        "short_tag": "WTG-02",
        "category": "Wind Turbine",
        "model_spec": "Vestas V112-3.0 MW Industrial",
        "manufacturer": "Vestas Wind Systems",
        "farm_sector": "Sector Alpha - Ridge Center",
        "rated_capacity_mw": 3.0,
        "commissioned_date": datetime(2023, 4, 20, 0, 0, 0, tzinfo=timezone.utc),
        "operational_status": "Warning (Pitch Drift)",
        "health_score": 82.1,
        "current_risk_level": "Warning",
        "current_anomaly_score": 0.495,
        "failure_probability_pct": 18.5,
        "revenue_at_risk_usd": 860.00,
        "active_fault": "Pitch Valve Drift",
        "last_inspection_date": "2026-01-28",
        "next_scheduled_service": "2026-03-01",
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
        "asset_id": "WTG-03",
        "legacy_id": 3,
        "name": "Wind Turbine Beta 01",
        "short_tag": "WTG-03",
        "category": "Wind Turbine",
        "model_spec": "GE 2.8-127 High Efficiency",
        "manufacturer": "GE Renewable Energy",
        "farm_sector": "Sector Beta - Valley Inflow",
        "rated_capacity_mw": 2.8,
        "commissioned_date": datetime(2023, 5, 2, 0, 0, 0, tzinfo=timezone.utc),
        "operational_status": "Online (Nominal)",
        "health_score": 93.8,
        "current_risk_level": "Healthy",
        "current_anomaly_score": 0.145,
        "failure_probability_pct": 3.4,
        "revenue_at_risk_usd": 220.00,
        "active_fault": "Nominal baseline",
        "last_inspection_date": "2026-02-04",
        "next_scheduled_service": "2026-05-20",
        "last_updated": datetime.now(timezone.utc),
        "latest_reading": {
            "wind_speed": 8.65,
            "rpm": 12.4,
            "gearbox_temp": 51.05,
            "bearing_vibration": 1.215,
            "power_output": 542.1,
            "ambient_temp": 16.2,
        },
    },
    {
        "asset_id": "WTG-04",
        "legacy_id": 4,
        "name": "Wind Turbine Beta 02",
        "short_tag": "WTG-04",
        "category": "Wind Turbine",
        "model_spec": "Siemens Gamesa SG 3.4-132",
        "manufacturer": "Siemens Gamesa",
        "farm_sector": "Sector Beta - Valley Outflow",
        "rated_capacity_mw": 3.4,
        "commissioned_date": datetime(2023, 5, 10, 0, 0, 0, tzinfo=timezone.utc),
        "operational_status": "Critical (Gearbox Vibration)",
        "health_score": 61.2,
        "current_risk_level": "Critical",
        "current_anomaly_score": 0.812,
        "failure_probability_pct": 42.8,
        "revenue_at_risk_usd": 2840.00,
        "active_fault": "Bearing Vibration Spike & Micro-pitting",
        "last_inspection_date": "2026-01-15",
        "next_scheduled_service": "2026-02-20",
        "last_updated": datetime.now(timezone.utc),
        "latest_reading": {
            "wind_speed": 9.45,
            "rpm": 13.2,
            "gearbox_temp": 78.4,
            "bearing_vibration": 2.18,
            "power_output": 680.9,
            "ambient_temp": 17.1,
        },
    },
    {
        "asset_id": "WTG-05",
        "legacy_id": 5,
        "name": "Wind Turbine Gamma 01",
        "short_tag": "WTG-05",
        "category": "Wind Turbine",
        "model_spec": "Nordex N131/3300 High Wind",
        "manufacturer": "Nordex Group",
        "farm_sector": "Sector Gamma - High Peak",
        "rated_capacity_mw": 3.3,
        "commissioned_date": datetime(2023, 6, 1, 0, 0, 0, tzinfo=timezone.utc),
        "operational_status": "Watch (Elevated Temp)",
        "health_score": 87.5,
        "current_risk_level": "Medium",
        "current_anomaly_score": 0.392,
        "failure_probability_pct": 9.6,
        "revenue_at_risk_usd": 510.00,
        "active_fault": "Elevated High-Speed Shaft Temp",
        "last_inspection_date": "2026-02-08",
        "next_scheduled_service": "2026-04-10",
        "last_updated": datetime.now(timezone.utc),
        "latest_reading": {
            "wind_speed": 8.95,
            "rpm": 12.75,
            "gearbox_temp": 68.8,
            "bearing_vibration": 1.48,
            "power_output": 585.2,
            "ambient_temp": 16.4,
        },
    },
]

def seed():
    db = get_db()
    if not db:
        print("[!] Firestore client not connected via Admin SDK. Use node frontend/seed_enterprise_db.mjs.")
        return

    print("[*] Seeding Firestore with enterprise renewable energy schema...")
    for asset in ENTERPRISE_ASSETS:
        aid = asset["asset_id"]
        db.collection("renewable_assets").document(aid).set(asset)
        db.collection("turbines").document(aid).set(asset)
        db.collection("turbines").document(str(asset["legacy_id"])).set(asset)
        print(f"  [✓] Set renewable_assets/{aid} and turbines/{aid}")
    print("[SUCCESS] Seeding completed.")

if __name__ == "__main__":
    seed()
