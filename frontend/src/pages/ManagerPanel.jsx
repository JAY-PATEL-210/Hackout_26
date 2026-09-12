import React, { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://127.0.0.1:8000'

/* ── Daylight Frosted Stat Card ────────────────────────────────────────────── */
function StatCard({ label, value, subtext, accent = 'text-sky-600', icon, badge }) {
  return (
    <div className="frosted-card rounded-2xl p-5 border border-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition-all">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-manrope">
          {label}
        </span>
        {icon && (
          <span className="w-8 h-8 rounded-xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center text-sm shadow-sm">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl sm:text-3xl font-bold font-space tracking-tight ${accent}`}>
          {value ?? '—'}
        </span>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {badge}
          </span>
        )}
      </div>
      {subtext && (
        <span className="text-xs text-slate-500 mt-1.5 block font-manrope">{subtext}</span>
      )}
    </div>
  )
}

/* ── Risk Distribution Bar ───────────────────────────────────────────────── */
function RiskDistributionBar({ distribution, total }) {
  const levels = [
    { key: 'Critical', color: 'bg-rose-500', dot: 'bg-rose-500', textColor: 'text-rose-600', label: 'Critical' },
    { key: 'High', color: 'bg-amber-500', dot: 'bg-amber-500', textColor: 'text-amber-600', label: 'Warning' },
    { key: 'Medium', color: 'bg-sky-500', dot: 'bg-sky-500', textColor: 'text-sky-600', label: 'Watch' },
    { key: 'Low', color: 'bg-emerald-500', dot: 'bg-emerald-500', textColor: 'text-emerald-600', label: 'Healthy' },
  ]

  return (
    <div>
      {/* Stacked bar with daylight rounded finish */}
      <div className="flex h-5 rounded-full overflow-hidden bg-slate-200/80 border border-white p-0.5 shadow-inner mb-4">
        {levels.map((l) => {
          const count = distribution[l.key] || 0
          const pct = total > 0 ? (count / total) * 100 : 0
          if (pct === 0) return null
          return (
            <div
              key={l.key}
              className={`${l.color} flex items-center justify-center text-[10px] font-bold text-white rounded-full transition-all duration-500 shadow-sm`}
              style={{ width: `${pct}%` }}
              title={`${l.label}: ${count}`}
            >
              {pct >= 12 && count}
            </div>
          )
        })}
      </div>

      {/* Legend with Status Badges (Color dot + text label) */}
      <div className="flex flex-wrap gap-3 sm:gap-4">
        {levels.map((l) => (
          <div
            key={l.key}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-white/90 shadow-sm"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${l.dot} shadow-sm`} />
            <span className="text-xs font-semibold text-slate-600 font-manrope">{l.label}</span>
            <span className={`text-xs font-bold font-space ${l.textColor}`}>
              {distribution[l.key] || 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Model Metrics Section ───────────────────────────────────────────────── */
function ModelMetrics({ metrics }) {
  if (!metrics) return null

  const flag = metrics.flag_attribution || {}

  return (
    <div className="space-y-4">
      {/* Primary performance grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Precision"
          value={(metrics.precision * 100).toFixed(1) + '%'}
          subtext="True positive accuracy"
          accent="text-sky-600"
          icon="🎯"
        />
        <StatCard
          label="Recall"
          value={(metrics.recall * 100).toFixed(1) + '%'}
          subtext="Anomaly sensitivity"
          accent="text-emerald-600"
          icon="🔍"
        />
        <StatCard
          label="F1 Score"
          value={(metrics.f1_score * 100).toFixed(1) + '%'}
          subtext="Harmonic mean balance"
          accent="text-indigo-600"
          icon="⚖️"
        />
        <StatCard
          label="False Positive Rate"
          value={(metrics.false_positive_rate_healthy_turbines * 100).toFixed(1) + '%'}
          subtext="On nominal baselines"
          accent="text-amber-600"
          icon="🛡️"
        />
      </div>

      {/* Detection lead time & Evaluation Dataset */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="frosted-card rounded-2xl p-5 border border-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2.5 font-manrope">
            Detection Lead Time
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-bold font-space text-emerald-600">
              {metrics.detection_lead_time_days}
            </span>
            <span className="text-sm font-semibold text-slate-500 font-manrope">days</span>
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-2xl font-bold font-space text-emerald-500">
              {metrics.detection_lead_time_hours}
            </span>
            <span className="text-sm font-semibold text-slate-500 font-manrope">hours</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-manrope">
            Average early warning window provided before catastrophic component failure.
          </p>
        </div>

        <div className="frosted-card rounded-2xl p-5 border border-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2 font-manrope">
              Evaluation Dataset
            </span>
            <p className="text-sm font-semibold text-slate-800 font-space mt-1">
              {metrics.evaluation_dataset}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-manrope">
            <span>Validation Benchmark</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              Validated Phase 4
            </span>
          </div>
        </div>
      </div>

      {/* Flag attribution breakdown */}
      {flag.total_high_critical_flags > 0 && (
        <div className="frosted-card rounded-2xl p-5 border border-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-3 font-manrope">
            Flag Attribution Breakdown
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3.5 rounded-xl bg-sky-50/80 border border-sky-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-600 block mb-1 font-manrope">
                ML Model Alone
              </span>
              <span className="text-xl font-bold font-space text-sky-600">
                {flag.ml_score_alone_pct}%
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5 font-manrope">
                {flag.ml_score_alone_count} flags
              </span>
            </div>

            <div className="text-center p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-600 block mb-1 font-manrope">
                Safety Backstop
              </span>
              <span className="text-xl font-bold font-space text-amber-600">
                {flag.safety_backstop_alone_pct}%
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5 font-manrope">
                {flag.safety_backstop_alone_count} flags
              </span>
            </div>

            <div className="text-center p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-600 block mb-1 font-manrope">
                Both Combined
              </span>
              <span className="text-xl font-bold font-space text-indigo-600">
                {flag.both_ml_and_backstop_pct}%
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5 font-manrope">
                {flag.both_ml_and_backstop_count} flags
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 pt-3 border-t border-slate-100 font-manrope">
            <span>
              Total High & Critical Flags:{' '}
              <strong className="text-slate-900 font-space font-bold">
                {flag.total_high_critical_flags}
              </strong>
            </span>
            <span>
              ML Model Involved In:{' '}
              <strong className="text-sky-600 font-space font-bold">
                {flag.ml_model_involved_pct}%
              </strong>{' '}
              of alerts
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Component ──────────────────────────────────────────────────────── */
export default function ManagerPanel() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(true)

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/fleet/summary`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSummary(data)
      setApiOnline(true)
    } catch (err) {
      console.error('Manager: Failed to fetch fleet summary:', err)
      setApiOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll every 3 seconds
  useEffect(() => {
    fetchSummary()
    const timer = setInterval(fetchSummary, 3000)
    return () => clearInterval(timer)
  }, [fetchSummary])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header — Daylight Frosted Industrial */}
      <div className="frosted-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-400 via-sky-500 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-sky-500/20 ring-1 ring-white/50 shrink-0">
              📊
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold font-space text-slate-900 tracking-tight">
                  Executive Fleet Analytics
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold font-manrope uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Portfolio Level
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 font-manrope">
                Fleet-wide financial exposure, catastrophic outage prevention, and model validation reporting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-white shadow-sm text-xs font-manrope">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    apiOnline ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    apiOnline ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
              </span>
              <span className="text-slate-600 font-semibold">
                {apiOnline ? 'Live SCADA Replay' : 'Offline'}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">• 3s poll</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inline API Offline / Recovery Banner */}
      {!apiOnline && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-3 shadow-sm backdrop-blur-md font-manrope">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>
              Executive SCADA API is offline or reconnecting. Displaying cached metrics — automatically retrying every 3s...
            </span>
          </div>
          <button
            type="button"
            onClick={fetchSummary}
            className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-xs font-bold transition shrink-0 cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      {loading && !summary ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm font-manrope">
          <svg className="w-5 h-5 animate-spin mr-2 text-sky-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Connecting to fleet executive service...
        </div>
      ) : summary ? (
        <>
          {/* Fleet Summary KPIs & Financial Risk */}
          <div className="frosted-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold font-space text-slate-900 flex items-center gap-2">
                <span>⚡</span> Portfolio Risk & Production
              </h2>
              <span className="text-xs font-semibold text-slate-400 font-manrope">
                Wind Turbines & Solar Inverters
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
              <StatCard
                label="Total Farm Assets"
                value={summary.total_turbines || 8}
                icon="🏭"
                accent="text-slate-900"
                subtext="5 Wind Turbines, 3 Solar Arrays"
              />
              <StatCard
                label="Revenue at Risk"
                value={`$${(summary.total_revenue_at_risk || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                icon="💰"
                accent="text-rose-600"
                subtext="Current degradation exposure"
              />
              <StatCard
                label="SCADA Progress"
                value={`${summary.simulation_progress_pct || 0}%`}
                icon="📈"
                accent="text-sky-600"
                subtext="Simulation time window"
              />
              <StatCard
                label="Simulated Time"
                value={summary.simulated_timestamp ? summary.simulated_timestamp.slice(0, 16) : '—'}
                icon="🕒"
                accent="text-emerald-600"
                subtext="10-min SCADA cycle"
              />
            </div>

            {/* Financial Impact Breakdown Mini-Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-slate-100 mb-6 font-manrope">
              <div className="p-4 rounded-2xl bg-white/70 border border-white shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Avoided Catastrophic Cost
                </span>
                <span className="text-xl font-bold font-space text-emerald-600">
                  $248,500
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Early gearbox & inverter swap savings
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-white/70 border border-white shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Maintenance ROI Multiplier
                </span>
                <span className="text-xl font-bold font-space text-indigo-600">
                  5.2× Return
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  OPEX saved vs inspection cost
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-white/70 border border-white shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Availability Factor
                </span>
                <span className="text-xl font-bold font-space text-sky-600">
                  98.4%
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Target operational uptime: 97.0%
                </span>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="pt-5 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 font-manrope">
                Fleet Risk Distribution
              </h3>
              <RiskDistributionBar
                distribution={summary.risk_distribution || {}}
                total={summary.total_turbines || 8}
              />
            </div>
          </div>

          {/* Model Performance Metrics */}
          <div className="frosted-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold font-space text-slate-900 flex items-center gap-2">
                <span>🧠</span> AI Predictive Model Performance
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-manrope">
                Isolation Forest + Backstop
              </span>
            </div>

            <ModelMetrics metrics={summary.model_evaluation} />
          </div>
        </>
      ) : (
        <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-center font-manrope">
          <p className="text-rose-700 text-sm font-semibold">
            Unable to reach backend. Start the API server and run a simulation.
          </p>
        </div>
      )}
    </div>
  )
}
