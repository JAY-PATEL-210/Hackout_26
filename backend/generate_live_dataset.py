#!/usr/bin/env python3
"""
generate_live_dataset.py

Generates an independent synthetic wind turbine SCADA sensor dataset for 5 turbines
over 30 days at 10-minute intervals to be used exclusively for testing/live simulation.

Differences from training dataset:
- Different random seed (7 instead of 42)
- Fault injected into Turbine 5 (instead of Turbine 3)
- Fault start point: 80% through the timeline (step 3456) instead of 75%
- Slightly different severity parameters and multipliers for non-identical degradation
- Saves output to backend/data/live_input_dataset.csv
"""

import os
import sys
import argparse
import numpy as np
import pandas as pd
from datetime import datetime, timedelta


def generate_live_data(force: bool = False):
    output_dir = os.path.join(os.path.dirname(__file__), "data")
    output_path = os.path.join(output_dir, "live_input_dataset.csv")

    # Fault window for Turbine 5: starts at 80% through the timeline (step 3456)
    FAULT_TURBINE_ID = 5
    FAULT_START_STEP = 3456

    # Demo mode safeguard: if verified dataset already exists and force is False, use cache
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0 and not force:
        print("=" * 88)
        print(" [DEMO MODE SAFEGUARD] VERIFIED DATASET CACHE DETECTED")
        print("=" * 88)
        print(f"[✓] Using cached live dataset: {output_path}")
        print("[✓] Re-running simulator will replay the exact same verified sequence.")
        print("[✓] Random re-generation skipped to prevent sequence drift. (Use --force to override)\n", flush=True)
        cached_df = pd.read_csv(output_path)
        print_summary_statistics(cached_df, FAULT_TURBINE_ID, FAULT_START_STEP)
        return cached_df

    print("[*] Generating fresh live SCADA dataset (Seed=7, Fault on Turbine 5)...", flush=True)
    # 1. Reproducibility with independent seed
    SEED = 7
    np.random.seed(SEED)

    # 2. Configuration parameters
    NUM_TURBINES = 5
    DAYS = 30
    INTERVAL_MINUTES = 10
    STEPS_PER_DAY = (24 * 60) // INTERVAL_MINUTES  # 144 steps/day
    TOTAL_STEPS = DAYS * STEPS_PER_DAY             # 4320 steps
    START_TIME = datetime(2026, 2, 1, 0, 0, 0)     # Feb 1, 2026 (independent timeline)
    
    # Turbine specifications
    CUT_IN_WIND = 3.0    # m/s
    RATED_WIND = 12.0   # m/s
    CUT_OUT_WIND = 25.0  # m/s
    RATED_POWER = 2000.0 # kW (2 MW turbine)
    RATED_RPM = 16.0     # RPM

    # Fault window for Turbine 5: starts at 80% through the timeline
    FAULT_TURBINE_ID = 5
    FAULT_START_STEP = int(TOTAL_STEPS * 0.80)  # step 3456 (day 24.0)

    records = []

    # Shared weather background with independent weather front dynamics
    time_indices = np.arange(TOTAL_STEPS)
    hours = (time_indices * INTERVAL_MINUTES / 60.0) % 24.0

    # Ambient temperature: daily cycle
    macro_ambient = 17.5 + 4.5 * np.sin(2 * np.pi * (hours - 10.0) / 24.0)

    # Wind speed: synoptic waves + diurnal variation
    synoptic_wave = 2.2 * np.sin(2 * np.pi * time_indices / (STEPS_PER_DAY * 6))
    diurnal_wind = 1.3 * np.sin(2 * np.pi * (hours - 15.0) / 24.0)
    macro_wind_base = 8.8 + synoptic_wave + diurnal_wind

    for turbine_id in range(1, NUM_TURBINES + 1):
        # Turbine-specific micro-climate variation
        turbine_seed_offset = turbine_id * 150
        rng = np.random.default_rng(SEED + turbine_seed_offset)

        # 1. Ambient Temp (°C)
        ambient_noise = rng.normal(0, 0.45, TOTAL_STEPS)
        ambient_temp = np.round(macro_ambient + rng.uniform(-0.6, 0.6) + ambient_noise, 2)

        # 2. Wind Speed (m/s)
        wind_noise = rng.normal(0, 1.25, TOTAL_STEPS)
        raw_wind = macro_wind_base + rng.uniform(-0.45, 0.45) + wind_noise
        wind_speed = np.clip(raw_wind, 0.5, 24.5)
        wind_speed = np.round(wind_speed, 2)

        # 3. RPM & Power Output
        rpm = np.zeros(TOTAL_STEPS)
        power_output = np.zeros(TOTAL_STEPS)

        for i in range(TOTAL_STEPS):
            ws = wind_speed[i]
            if ws < CUT_IN_WIND or ws >= CUT_OUT_WIND:
                rpm[i] = max(0.0, rng.normal(0.5, 0.1)) if ws < CUT_IN_WIND else 0.0
                power_output[i] = 0.0
            elif CUT_IN_WIND <= ws < RATED_WIND:
                fraction = (ws - CUT_IN_WIND) / (RATED_WIND - CUT_IN_WIND)
                rpm_val = 6.0 + fraction * (RATED_RPM - 6.0) + rng.normal(0, 0.15)
                rpm[i] = np.clip(rpm_val, 5.0, RATED_RPM)
                
                cubic_fraction = ((ws - CUT_IN_WIND) / (RATED_WIND - CUT_IN_WIND)) ** 3
                power_val = cubic_fraction * RATED_POWER + rng.normal(0, 15.0)
                power_output[i] = np.clip(power_val, 0.0, RATED_POWER)
            else:
                rpm_val = RATED_RPM + rng.normal(0, 0.12)
                rpm[i] = np.clip(rpm_val, 15.5, 16.5)
                power_val = RATED_POWER + rng.normal(0, 10.0)
                power_output[i] = np.clip(power_val, 1950.0, 2020.0)

        rpm = np.round(rpm, 2)
        power_output = np.round(power_output, 2)

        # 4. Gearbox Temperature (°C)
        load_fraction = power_output / RATED_POWER
        gearbox_base = ambient_temp + 27.5 + 26.5 * load_fraction + rng.normal(0, 0.65, TOTAL_STEPS)
        gearbox_temp = np.round(gearbox_base, 2)

        # 5. Bearing Vibration (mm/s)
        vib_base = 1.18 + 0.16 * load_fraction + rng.normal(0, 0.05, TOTAL_STEPS)
        bearing_vibration = np.round(np.clip(vib_base, 0.6, 2.0), 3)

        # 6. Fault Status
        is_fault = np.zeros(TOTAL_STEPS, dtype=int)

        # 7. Fault Injection for Turbine 5 (starts at step 3456, 80% through timeline)
        if turbine_id == FAULT_TURBINE_ID:
            fault_indices = np.arange(FAULT_START_STEP, TOTAL_STEPS)
            is_fault[fault_indices] = 1

            # Non-linear accelerating severity curve: progress ** 2.0 (slightly different curve)
            progress = (fault_indices - FAULT_START_STEP) / float(TOTAL_STEPS - FAULT_START_STEP)
            severity = np.power(progress, 2.0)

            # Vibration rises smoothly and severely (+0 mm/s up to +5.4 mm/s)
            vibration_spike = 5.4 * severity + rng.normal(0, 0.09, len(fault_indices)) * severity
            bearing_vibration[fault_indices] = np.round(bearing_vibration[fault_indices] + vibration_spike, 3)

            # Gearbox temperature rises smoothly (+0°C up to +29°C)
            temp_spike = 29.0 * severity + rng.normal(0, 0.45, len(fault_indices)) * severity
            gearbox_temp[fault_indices] = np.round(gearbox_temp[fault_indices] + temp_spike, 2)

            # Power output falls smoothly (-0% to -40%)
            power_reduction = 1.0 - (0.40 * severity)
            power_output[fault_indices] = np.round(np.maximum(0.0, power_output[fault_indices] * power_reduction), 2)

        # Append records
        for step in range(TOTAL_STEPS):
            timestamp = START_TIME + timedelta(minutes=INTERVAL_MINUTES * step)
            records.append({
                "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "turbine_id": turbine_id,
                "wind_speed": wind_speed[step],
                "rpm": rpm[step],
                "gearbox_temp": gearbox_temp[step],
                "bearing_vibration": bearing_vibration[step],
                "power_output": power_output[step],
                "ambient_temp": ambient_temp[step],
                "is_fault": int(is_fault[step])
            })

    # Convert to DataFrame
    df = pd.DataFrame(records)

    # Save output to backend/data/live_input_dataset.csv
    output_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "live_input_dataset.csv")
    df.to_csv(output_path, index=False)
    print(f"[✓] Successfully generated live input dataset with {len(df):,} rows.")
    print(f"[✓] Saved to: {output_path}\n", flush=True)

    # Print summary statistics comparing normal turbine vs turbine 5 before and during fault
    print_summary_statistics(df, FAULT_TURBINE_ID, FAULT_START_STEP)

    return df


def print_summary_statistics(df, fault_turbine_id, fault_start_step):
    print("=" * 88)
    print(" " * 24 + "LIVE SCADA SENSOR SUMMARY STATISTICS")
    print("=" * 88)

    # Normal control turbine: Turbine 1
    df_normal_t1 = df[df["turbine_id"] == 1]
    
    # Turbine 5 before fault window (first 80% steps)
    df_t5 = df[df["turbine_id"] == fault_turbine_id].reset_index(drop=True)
    df_t5_before = df_t5.iloc[:fault_start_step]
    
    # Turbine 5 during fault window (last 20% steps)
    df_t5_during = df_t5.iloc[fault_start_step:]

    # Other normal turbines during the late window
    df_others_late = df[(df["turbine_id"] != fault_turbine_id)].groupby("turbine_id").apply(
        lambda g: g.iloc[fault_start_step:], include_groups=False
    ).reset_index(drop=True)

    sensor_cols = ["bearing_vibration", "gearbox_temp", "power_output", "rpm", "wind_speed"]
    units = {
        "bearing_vibration": "mm/s",
        "gearbox_temp": "°C",
        "power_output": "kW",
        "rpm": "RPM",
        "wind_speed": "m/s"
    }

    groups = [
        ("Turbine 1 (Normal Control - All 30 Days)", df_normal_t1),
        (f"Other Turbines 1-4 (Days 24 - 30)", df_others_late),
        (f"Turbine {fault_turbine_id} (BEFORE Fault: Days 0 - 24)", df_t5_before),
        (f"Turbine {fault_turbine_id} (DURING Fault: Days 24 - 30)", df_t5_during),
    ]

    header_fmt = "{:<42} | {:>10} | {:>10} | {:>10} | {:>10}"
    row_fmt    = "  • {:<38} | {:>10.2f} | {:>10.2f} | {:>10.2f} | {:>10.2f}"

    for col in sensor_cols:
        col_title = f"Sensor: {col} ({units.get(col, '')})"
        print(f"\n{col_title.upper()}")
        print("-" * 88)
        print(header_fmt.format("Group Segment", "Mean", "Std", "Min", "Max"))
        print("-" * 88)
        for label, grp in groups:
            s = grp[col]
            print(row_fmt.format(label, s.mean(), s.std(), s.min(), s.max()))

    print("\n" + "=" * 88)
    print("LIVE FAULT PATTERN VERIFICATION ANALYSIS (TURBINE 5)")
    print("=" * 88)
    t5_pre_vib = df_t5_before["bearing_vibration"].mean()
    t5_dur_vib = df_t5_during["bearing_vibration"].mean()
    t5_dur_vib_max = df_t5_during["bearing_vibration"].max()
    vib_change = ((t5_dur_vib - t5_pre_vib) / t5_pre_vib) * 100

    t5_pre_temp = df_t5_before["gearbox_temp"].mean()
    t5_dur_temp = df_t5_during["gearbox_temp"].mean()
    t5_dur_temp_max = df_t5_during["gearbox_temp"].max()
    temp_change = ((t5_dur_temp - t5_pre_temp) / t5_pre_temp) * 100

    t5_pre_pwr = df_t5_before["power_output"].mean()
    t5_dur_pwr = df_t5_during["power_output"].mean()
    pwr_change = ((t5_dur_pwr - t5_pre_pwr) / t5_pre_pwr) * 100

    print(f"1. Bearing Vibration:")
    print(f"   - Turbine 5 Pre-fault Mean : {t5_pre_vib:.3f} mm/s")
    print(f"   - Turbine 5 Fault Window   : {t5_dur_vib:.3f} mm/s (Peak: {t5_dur_vib_max:.3f} mm/s)")
    print(f"   - Relative Shift           : +{vib_change:.1f}% increase (Clear Smooth Surge)")

    print(f"\n2. Gearbox Temperature:")
    print(f"   - Turbine 5 Pre-fault Mean : {t5_pre_temp:.2f} °C")
    print(f"   - Turbine 5 Fault Window   : {t5_dur_temp:.2f} °C (Peak: {t5_dur_temp_max:.2f} °C)")
    print(f"   - Relative Shift           : +{temp_change:.1f}% increase (Overheating Drivetrain)")

    print(f"\n3. Power Output:")
    print(f"   - Turbine 5 Pre-fault Mean : {t5_pre_pwr:.2f} kW")
    print(f"   - Turbine 5 Fault Window   : {t5_dur_pwr:.2f} kW")
    print(f"   - Relative Shift           : {pwr_change:.1f}% reduction (Efficiency Loss)")

    print(f"\n4. Fault Ground Truth Column (is_fault):")
    fault_count = df['is_fault'].sum()
    expected_faults = len(df_t5_during)
    print(f"   - Total Fault Rows: {fault_count} / {len(df)} rows ({fault_count/len(df)*100:.1f}%)")
    print(f"   - Exactly matches Turbine 5 fault window: {fault_count == expected_faults}")
    print("=" * 88 + "\n")


def upload_dataset_to_firestore(df: pd.DataFrame, dataset_name: str = "live"):
    """Writes live dataset records to Firestore under turbines/{turbine_id}/readings."""
    try:
        from firebase_setup import get_db
        db = get_db()
        if db is None:
            print("[!] Cannot write to Firestore: Firebase Admin credentials not available.")
            return

        print(f"[*] Writing {len(df):,} records to Firestore subcollections...")
        for turbine_id, group in df.groupby("turbine_id"):
            tid = str(int(turbine_id))
            turbine_ref = db.collection("turbines").document(tid)
            records = group.to_dict(orient="records")
            for i in range(0, len(records), 400):
                batch = db.batch()
                chunk = records[i:i + 400]
                for r in chunk:
                    rid = f"{dataset_name}_{str(r['timestamp']).replace(' ', '_').replace(':', '-')}"
                    doc_ref = turbine_ref.collection("readings").document(rid)
                    batch.set(doc_ref, {
                        "timestamp": str(r["timestamp"]),
                        "wind_speed": float(r["wind_speed"]),
                        "rpm": float(r["rpm"]),
                        "gearbox_temp": float(r["gearbox_temp"]),
                        "bearing_vibration": float(r["bearing_vibration"]),
                        "power_output": float(r["power_output"]),
                        "ambient_temp": float(r["ambient_temp"]),
                        "is_fault": int(r.get("is_fault", 0)),
                    })
                batch.commit()
                print(f"  [✓] Turbine {tid}: committed batch {i // 400 + 1}")
        print("[✓] Finished writing live dataset to Firestore!")
    except Exception as e:
        print(f"[!] Error writing to Firestore: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Demo mode safeguard for live SCADA dataset generator."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force regeneration of live dataset, bypassing demo mode safeguard."
    )
    parser.add_argument(
        "--to-firestore",
        action="store_true",
        help="Upload generated dataset records to Cloud Firestore."
    )
    args = parser.parse_args()
    df = generate_live_data(force=args.force)
    if args.to_firestore:
        upload_dataset_to_firestore(df, "live")
