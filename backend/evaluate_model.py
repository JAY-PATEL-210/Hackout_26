#!/usr/bin/env python3
"""
evaluate_model.py

Evaluates the trained IsolationForest anomaly detection model on the held-out
live dataset (live_input_dataset.csv), which the model was NOT trained on.

Metrics reported:
  1. Precision, Recall, Confusion Matrix (High/Critical = positive prediction)
  2. Detection Lead Time for Turbine 5 (days before the injected fault window)
  3. False-Positive Rate on healthy turbines (1-4)
  4. ML-only vs Backstop-only flag attribution breakdown
  5. Per-turbine risk level distribution
"""

import os
import sys
import json
import numpy as np
import pandas as pd

# Ensure backend/ is importable regardless of CWD
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import score_dataframe

FAULT_TURBINE_ID    = 5
HIGH_RISK_LABELS    = {"High", "Critical"}
BACKSTOP_VIB_THRESH = 5.0
BACKSTOP_TEMP_THRESH = 75.0
INTERVAL_MINUTES    = 10
MINUTES_PER_DAY     = 1440.0


def load_thresholds() -> dict:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for fname in ["models/thresholds.json", "thresholds.json"]:
        path = os.path.join(base_dir, fname)
        if os.path.exists(path):
            with open(path) as f:
                return json.load(f)
    raise FileNotFoundError("thresholds.json not found.")


def flag_attribution(row, med_cutoff: float) -> str:
    backstop = (row["bearing_vibration"] > BACKSTOP_VIB_THRESH or
                row["gearbox_temp"] > BACKSTOP_TEMP_THRESH)
    ml_high  = row["anomaly_score"] >= med_cutoff
    if ml_high and backstop:
        return "both"
    elif ml_high:
        return "ml_only"
    else:
        return "backstop_only"


def sep(char="─", width=72):
    return char * width


def main():
    base_dir  = os.path.dirname(os.path.abspath(__file__))
    live_path = os.path.join(base_dir, "data", "live_input_dataset.csv")

    if not os.path.exists(live_path):
        raise FileNotFoundError(f"Live dataset not found: {live_path}")

    thresholds  = load_thresholds()
    low_cutoff  = thresholds["low_cutoff"]
    med_cutoff  = thresholds["medium_cutoff"]
    high_cutoff = thresholds["high_cutoff"]

    df     = pd.read_csv(live_path, parse_dates=["timestamp"])
    scored = score_dataframe(df)

    scored["predicted_positive"] = scored["risk_level"].isin(HIGH_RISK_LABELS)
    scored["actual_positive"]    = scored["is_fault"].astype(bool)

    # 1. Confusion Matrix
    tp = int(( scored["predicted_positive"] &  scored["actual_positive"]).sum())
    fp = int(( scored["predicted_positive"] & ~scored["actual_positive"]).sum())
    fn = int((~scored["predicted_positive"] &  scored["actual_positive"]).sum())
    tn = int((~scored["predicted_positive"] & ~scored["actual_positive"]).sum())

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = (2 * precision * recall / (precision + recall)
                 if (precision + recall) > 0 else 0.0)
    fpr_all   = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    # 2. Lead Time - Turbine 5
    t5 = scored[scored["turbine_id"] == FAULT_TURBINE_ID].copy()
    t5 = t5.sort_values("timestamp").reset_index(drop=True)

    fault_onset_ts = t5.loc[t5["is_fault"] == 1, "timestamp"].iloc[0]
    flagged_t5     = t5[t5["predicted_positive"]]
    lead_time_days = None
    first_flag_ts  = None

    if not flagged_t5.empty:
        first_flag_ts  = flagged_t5["timestamp"].iloc[0]
        delta_minutes  = (fault_onset_ts - first_flag_ts).total_seconds() / 60.0
        lead_time_days = delta_minutes / MINUTES_PER_DAY

    # 3. FPR on healthy turbines
    healthy      = scored[scored["turbine_id"] != FAULT_TURBINE_ID]
    fp_healthy   = int(healthy["predicted_positive"].sum())
    total_healthy= len(healthy)
    fpr_healthy  = fp_healthy / total_healthy if total_healthy > 0 else 0.0

    # 4. Flag Attribution
    flagged_all = scored[scored["predicted_positive"]].copy()
    flagged_all["attribution"] = flagged_all.apply(
        flag_attribution, axis=1, med_cutoff=med_cutoff
    )
    attr_counts     = flagged_all["attribution"].value_counts()
    n_ml_only       = int(attr_counts.get("ml_only", 0))
    n_backstop_only = int(attr_counts.get("backstop_only", 0))
    n_both          = int(attr_counts.get("both", 0))
    total_flagged   = len(flagged_all)

    # 5. Per-Turbine Distribution
    per_turbine = (
        scored.groupby(["turbine_id", "risk_level"])
        .size()
        .unstack(fill_value=0)
        .reindex(columns=["Low", "Medium", "High", "Critical"], fill_value=0)
    )
    per_turbine["Total"] = per_turbine.sum(axis=1)
    for lvl in ["Low", "Medium", "High", "Critical"]:
        per_turbine[f"{lvl}%"] = (per_turbine[lvl] / per_turbine["Total"] * 100).round(1)

    # 6. Turbine 5 fault window detail
    t5_fault   = t5[t5["is_fault"] == 1]
    t5_healthy = t5[t5["is_fault"] == 0]
    t5_fault_flagged   = int(t5_fault["predicted_positive"].sum())
    t5_healthy_flagged = int(t5_healthy["predicted_positive"].sum())

    # ── PRINT REPORT ──────────────────────────────────────────────────────────
    W = 72
    print()
    print("=" * W)
    print("  WIND TURBINE ANOMALY DETECTION  —  MODEL EVALUATION REPORT")
    print("  Dataset : live_input_dataset.csv  (held-out, never seen in training)")
    print(f"  Rows    : {len(scored):,}  |  Turbines: {sorted(scored['turbine_id'].unique())}")
    print(f"  Fault Turbine : T{FAULT_TURBINE_ID}  |  Fault rows: {int(scored['actual_positive'].sum()):,}")
    print("=" * W)

    print()
    print(sep())
    print("  1.  CONFUSION MATRIX  (High / Critical = Positive)")
    print(sep())
    print(f"  {'':26}  {'Predicted Neg':>14}  {'Predicted Pos':>14}")
    print(f"  {'Actual Negative (is_fault=0)':26}  {tn:>14,}  {fp:>14,}")
    print(f"  {'Actual Positive (is_fault=1)':26}  {fn:>14,}  {tp:>14,}")
    print()
    print(f"  Precision          : {precision:.4f}   ({precision*100:.1f}%)")
    print(f"  Recall (TPR)       : {recall:.4f}   ({recall*100:.1f}%)")
    print(f"  F1 Score           : {f1:.4f}")
    print(f"  FPR (all turbines) : {fpr_all:.4f}   ({fpr_all*100:.2f}%)")

    print()
    print(sep())
    print(f"  2.  DETECTION LEAD TIME  —  Turbine {FAULT_TURBINE_ID}")
    print(sep())
    print(f"  Injected fault onset : {fault_onset_ts}  (is_fault → 1)")
    if first_flag_ts is not None:
        if lead_time_days is not None and lead_time_days > 0:
            readings_ahead = int(lead_time_days * MINUTES_PER_DAY / INTERVAL_MINUTES)
            print(f"  First High/Critical  : {first_flag_ts}")
            print(f"  Lead time            : {lead_time_days:.2f} days  "
                  f"({readings_ahead} readings / {lead_time_days*24:.1f} hours) BEFORE fault")
        elif lead_time_days is not None and lead_time_days == 0:
            print(f"  First High/Critical  : {first_flag_ts}  (exactly at fault onset)")
            print(f"  Lead time            : 0.00 days")
        else:
            lag = abs(lead_time_days) if lead_time_days is not None else 0
            print(f"  First High/Critical  : {first_flag_ts}")
            print(f"  NOTE: Model first flagged AFTER fault onset by {lag:.2f} days")
    else:
        print("  First High/Critical  : (none — model never raised alarm for T5)")
        print("  Lead time            : N/A")

    print()
    print(sep())
    print("  3.  FALSE-POSITIVE RATE  —  Healthy Turbines (T1–T4)")
    print(sep())
    print(f"  Healthy turbine rows : {total_healthy:,}")
    print(f"  Spurious High/Crit   : {fp_healthy:,}")
    print(f"  False-Positive Rate  : {fpr_healthy:.4f}   ({fpr_healthy*100:.2f}%)")

    print()
    print(sep())
    print("  4.  FLAG ATTRIBUTION  —  ML Score vs Rule-Based Safety Backstop")
    print(sep())
    print(f"  Total High/Critical flags raised : {total_flagged:,}")
    print()
    pct = lambda n: f"{n/total_flagged*100:.1f}%" if total_flagged else "—"
    print(f"  {'Source':<35}  {'Count':>7}  {'Share':>7}")
    print(f"  {'-'*35}  {'-'*7}  {'-'*7}")
    print(f"  {'ML score alone  (score >= p95)':35}  {n_ml_only:>7,}  {pct(n_ml_only):>7}")
    print(f"  {'Backstop only   (rule fired, ML < p95)':35}  {n_backstop_only:>7,}  {pct(n_backstop_only):>7}")
    print(f"  {'Both ML + Backstop triggered':35}  {n_both:>7,}  {pct(n_both):>7}")
    print()
    ml_total   = n_ml_only + n_both
    rule_total = n_backstop_only + n_both
    print(f"  ML model involved  (ml_only + both) : {ml_total:,}  ({pct(ml_total)})")
    print(f"  Backstop involved  (rule  + both)   : {rule_total:,}  ({pct(rule_total)})")
    print(f"  Backstop-ONLY flags (no ML signal)  : {n_backstop_only:,}  ({pct(n_backstop_only)})")

    print()
    print(sep())
    print("  5.  PER-TURBINE RISK LEVEL DISTRIBUTION")
    print(sep())
    print(f"  {'Turbine':>8}  {'Low':>6}  {'Med':>6}  {'High':>6}  {'Crit':>6}  "
          f"{'Low%':>6}  {'Med%':>6}  {'Hi%':>6}  {'Cr%':>6}")
    print(f"  {'-'*8}  {'-'*6}  {'-'*6}  {'-'*6}  {'-'*6}  "
          f"{'-'*6}  {'-'*6}  {'-'*6}  {'-'*6}")
    for tid, row in per_turbine.iterrows():
        marker = "  <- FAULT" if tid == FAULT_TURBINE_ID else ""
        print(f"  {'T'+str(tid):>8}  {int(row['Low']):>6,}  {int(row['Medium']):>6,}  "
              f"{int(row['High']):>6,}  {int(row['Critical']):>6,}  "
              f"{row['Low%']:>5.1f}%  {row['Medium%']:>5.1f}%  "
              f"{row['High%']:>5.1f}%  {row['Critical%']:>5.1f}%{marker}")

    print()
    print(sep())
    print(f"  6.  TURBINE {FAULT_TURBINE_ID} FAULT WINDOW DETAIL")
    print(sep())
    print(f"  Healthy period  ({len(t5_healthy):,} rows, is_fault=0):")
    print(f"    High/Critical flagged : {t5_healthy_flagged:,}  "
          f"({t5_healthy_flagged/len(t5_healthy)*100:.1f}%  false-pos within T5)")
    print()
    print(f"  Fault period    ({len(t5_fault):,} rows, is_fault=1):")
    print(f"    High/Critical flagged : {t5_fault_flagged:,}  "
          f"({t5_fault_flagged/len(t5_fault)*100:.1f}%  true positives)")
    missed = len(t5_fault) - t5_fault_flagged
    print(f"    Missed (Low/Medium)   : {missed:,}  "
          f"({missed/len(t5_fault)*100:.1f}%  false negatives)")

    print()
    print(sep())
    print("  THRESHOLDS USED  (percentile-calibrated on training data)")
    print(sep())
    print(f"  Low  → Medium  (p90) : {low_cutoff:.4f}")
    print(f"  Medium → High  (p95) : {med_cutoff:.4f}")
    print(f"  High → Critical(p99) : {high_cutoff:.4f}")
    print(f"  Safety backstop      : bearing_vibration > {BACKSTOP_VIB_THRESH}  "
          f"OR  gearbox_temp > {BACKSTOP_TEMP_THRESH}")
    print()
    print("=" * W)
    print("  END OF REPORT")
    print("=" * W)
    print()


if __name__ == "__main__":
    main()
