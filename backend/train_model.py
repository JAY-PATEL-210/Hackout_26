#!/usr/bin/env python3
"""
train_model.py

Trains an unsupervised anomaly detection model (Isolation Forest) on SCADA data
using per-turbine baseline normalization.

Steps:
1. Loads backend/data/training_dataset.csv.
2. For each turbine independently:
   a. Compute rolling-window features on bearing_vibration, gearbox_temp, and
      power_output: a 5-reading rolling mean and a 5-reading rate-of-change
      (difference from 5 readings ago) for each.
   b. Compute that turbine's own baseline mean/std for each raw feature using
      only the first 20% of its timeline (the guaranteed-healthy portion, before
      any fault window could start).
   c. Convert each rolling feature into a z-score relative to that turbine's own
      baseline mean/std, instead of using raw values.
3. Drop rows with NaN (the first 4-5 readings per turbine, before the rolling
   window is full).
4. Train a single scikit-learn IsolationForest on these per-turbine-normalized
   z-score features (excluding is_fault, timestamp, and turbine_id from the
   feature set).
5. Save the fitted model to backend/models/anomaly_model.pkl using joblib, the
   exact list of feature column names to feature_columns.json, AND the
   per-turbine baseline mean/std values to turbine_baselines.json.
6. Print the anomaly score distribution: min, max, mean, and the 50th/75th/90th/
   95th/99th percentiles.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

RAW_SENSOR_COLS = ["bearing_vibration", "gearbox_temp", "power_output"]
ROLLING_WINDOW = 5
HEALTHY_RATIO = 0.20


def compute_turbine_features_and_baselines(df: pd.DataFrame):
    """
    Computes per-turbine rolling features and baseline statistics.
    Returns:
      - processed_df: DataFrame with normalized z-score features added
      - feature_cols: list of feature column names
      - baselines: dict mapping turbine_id (str) to {col: {mean, std}}
      - global_baseline: dict mapping col to {mean, std} across all turbines
    """
    df = df.copy()
    # Ensure timestamp is datetime and sorted
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values(["turbine_id", "timestamp"]).reset_index(drop=True)

    baselines = {}
    turbine_dfs = []
    
    # 1. Compute per-turbine baselines from first 20% healthy timeline
    global_healthy_records = {col: [] for col in RAW_SENSOR_COLS}

    for turbine_id, group in df.groupby("turbine_id", sort=False):
        group = group.copy().sort_values("timestamp").reset_index(drop=True)
        cutoff_idx = max(5, int(len(group) * HEALTHY_RATIO))
        healthy_slice = group.iloc[:cutoff_idx]

        turbine_baselines = {}
        for col in RAW_SENSOR_COLS:
            mean_val = float(healthy_slice[col].mean())
            std_val = float(healthy_slice[col].std())
            if std_val < 1e-6:
                std_val = 1e-6
            turbine_baselines[col] = {"mean": mean_val, "std": std_val}
            global_healthy_records[col].extend(healthy_slice[col].tolist())

        baselines[str(turbine_id)] = turbine_baselines

    # Compute global baseline for unseen turbines fallback
    global_baseline = {}
    for col in RAW_SENSOR_COLS:
        vals = global_healthy_records[col]
        g_mean = float(np.mean(vals)) if len(vals) > 0 else 0.0
        g_std = float(np.std(vals)) if len(vals) > 0 and np.std(vals) > 1e-6 else 1.0
        global_baseline[col] = {"mean": g_mean, "std": g_std}
    baselines["_global"] = global_baseline

    # 2. Compute rolling features and z-score normalize per turbine
    feature_cols = []
    for col in RAW_SENSOR_COLS:
        feature_cols.append(f"{col}_roll_mean_z")
        feature_cols.append(f"{col}_roc_z")

    for turbine_id, group in df.groupby("turbine_id", sort=False):
        t_group = group.copy().sort_values("timestamp").reset_index(drop=True)
        t_base = baselines.get(str(turbine_id), global_baseline)

        for col in RAW_SENSOR_COLS:
            mean_base = t_base[col]["mean"]
            std_base = t_base[col]["std"]

            # 5-reading rolling mean
            roll_mean = t_group[col].rolling(window=ROLLING_WINDOW).mean()
            # 5-reading rate of change (difference from 5 readings ago)
            roc = t_group[col].diff(periods=ROLLING_WINDOW)

            # Z-score normalization relative to turbine's own baseline
            t_group[f"{col}_roll_mean_z"] = (roll_mean - mean_base) / std_base
            t_group[f"{col}_roc_z"] = roc / std_base

        turbine_dfs.append(t_group)

    processed_df = pd.concat(turbine_dfs, ignore_index=True)
    return processed_df, feature_cols, baselines


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, "data", "training_dataset.csv")
    models_dir = os.path.join(base_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    print(f"Loading training dataset from: {data_path}")
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Training dataset not found at: {data_path}")

    df = pd.read_csv(data_path)
    print(f"Loaded {len(df):,} rows across {df['turbine_id'].nunique()} turbines.")

    # Feature engineering & baseline calculation
    print("\nComputing per-turbine baselines and rolling z-score features...")
    processed_df, feature_cols, baselines = compute_turbine_features_and_baselines(df)

    print(f"Engineered features ({len(feature_cols)}): {feature_cols}")

    # Drop rows with NaN (the first readings per turbine before rolling window is full)
    initial_len = len(processed_df)
    clean_df = processed_df.dropna(subset=feature_cols).copy().reset_index(drop=True)
    dropped_count = initial_len - len(clean_df)
    print(f"Dropped {dropped_count} rows with NaN (initial rolling window warm-up). Remaining rows: {len(clean_df):,}")

    # Prepare feature matrix X (excluding is_fault, timestamp, and turbine_id)
    X = clean_df[feature_cols].values

    # Train Isolation Forest
    print("\nTraining scikit-learn IsolationForest model...", flush=True)
    iso_forest = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42,
        n_jobs=1
    )
    iso_forest.fit(X)
    print("[✓] Model training complete.", flush=True)

    # IsolationForest anomaly score:
    # score_samples returns negative anomaly score (-s).
    # Inverting (-score_samples) yields positive score s where higher = more anomalous.
    raw_scores = iso_forest.score_samples(X)
    anomaly_scores = -raw_scores

    # Compute distribution percentiles
    min_score = float(np.min(anomaly_scores))
    max_score = float(np.max(anomaly_scores))
    mean_score = float(np.mean(anomaly_scores))
    p50 = float(np.percentile(anomaly_scores, 50))
    p75 = float(np.percentile(anomaly_scores, 75))
    p90 = float(np.percentile(anomaly_scores, 90))
    p95 = float(np.percentile(anomaly_scores, 95))
    p99 = float(np.percentile(anomaly_scores, 99))

    print("\n" + "=" * 60)
    print("           ANOMALY SCORE DISTRIBUTION")
    print("=" * 60)
    print(f"  Min Score:         {min_score:.4f}")
    print(f"  Mean Score:        {mean_score:.4f}")
    print(f"  50th Percentile:   {p50:.4f}")
    print(f"  75th Percentile:   {p75:.4f}")
    print(f"  90th Percentile:   {p90:.4f}  (Medium Threshold)")
    print(f"  95th Percentile:   {p95:.4f}  (High Threshold)")
    print(f"  99th Percentile:   {p99:.4f}  (Critical Threshold)")
    print(f"  Max Score:         {max_score:.4f}")
    print("=" * 60)

    # Threshold dictionary
    thresholds = {
        "min": min_score,
        "p50": p50,
        "p75": p75,
        "p90": p90,
        "p95": p95,
        "p99": p99,
        "max": max_score,
        "mean": mean_score,
        "low_cutoff": p90,     # < 90th percentile -> Low
        "medium_cutoff": p95,  # 90th - 95th percentile -> Medium
        "high_cutoff": p99     # 95th - 99th percentile -> High, >= 99th -> Critical
    }

    # Save artifacts
    model_path = os.path.join(models_dir, "anomaly_model.pkl")
    joblib.dump(iso_forest, model_path)
    print(f"\n[✓] Saved fitted model to: {model_path}")

    # Save feature_columns.json (in models/ and backend/)
    for path in [os.path.join(models_dir, "feature_columns.json"), os.path.join(base_dir, "feature_columns.json")]:
        with open(path, "w") as f:
            json.dump(feature_cols, f, indent=2)
    print(f"[✓] Saved feature columns to feature_columns.json")

    # Save turbine_baselines.json (in models/ and backend/)
    for path in [os.path.join(models_dir, "turbine_baselines.json"), os.path.join(base_dir, "turbine_baselines.json")]:
        with open(path, "w") as f:
            json.dump(baselines, f, indent=2)
    print(f"[✓] Saved turbine baselines to turbine_baselines.json")

    # Save thresholds.json (in models/ and backend/)
    for path in [os.path.join(models_dir, "thresholds.json"), os.path.join(base_dir, "thresholds.json")]:
        with open(path, "w") as f:
            json.dump(thresholds, f, indent=2)
    print(f"[✓] Saved percentile thresholds to thresholds.json")

    return iso_forest, feature_cols, baselines, thresholds


if __name__ == "__main__":
    main()
