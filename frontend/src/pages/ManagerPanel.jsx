import React, { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://127.0.0.1:8000'

/* ── Stat Card component ─────────────────────────────────────────────────── */
function StatCard({ label, value, subtext, accent = 'text-cyan-400', icon }) {
  return (
    <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <span className={`text-2xl font-mono font-bold ${accent} block`}>
        {value ?? '—'}
      </span>
      {subtext && (
        <span className="text-[11px] text-slate-500 mt-1 block">{subtext}</span>
      )}
    </div>
  )
}

/* ── Risk Distribution Bar ───────────────────────────────────────────────── */
function RiskDistributionBar({ distribution, total }) {
  const levels = [
    { key: 'Critical', color: 'bg-rose-500', textColor: 'text-rose-400', label: 'Critical' },
    { key: 'High', color: 'bg-orange-500', textColor: 'text-orange-400', label: 'High' },
    { key: 'Medium', color: 'bg-amber-500', textColor: 'text-amber-400', label: 'Medium' },
    { key: 'Low', color: 'bg-emerald-500', textColor: 'text-emerald-400', label: 'Healthy' },
  ]

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-6 rounded-full overflow-hidden bg-slate-800 mb-4">
        {levels.map((l) => {
          const count = distribution[l.key] || 0
          const pct = total > 0 ? (count / total) * 100 : 0
          if (pct === 0) return null
          return (
            <div
              key={l.key}
              className={`${l.color} flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${l.label}: ${count}`}
            >
              {pct >= 15 && count}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {levels.map((l) => (
          <div key={l.key} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-sm ${l.color}`} />
            <span className="text-xs text-slate-400">{l.label}</span>
            <span className={`text-xs font-mono font-bold ${l.textColor}`}>
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
          subtext="True positive rate"
          accent="text-sky-400"
        />
        <StatCard
          label="Recall"
          value={(metrics.recall * 100).toFixed(1) + '%'}
          subtext="Sensitivity"
          accent="text-violet-400"
        />
        <StatCard
          label="F1 Score"
          value={(metrics.f1_score * 100).toFixed(1) + '%'}
          subtext="Harmonic mean"
          accent="text-cyan-400"
        />
        <StatCard
          label="False Positive Rate"
          value={(metrics.false_positive_rate_healthy_turbines * 100).toFixed(1) + '%'}
          subtext="On healthy turbines"
          accent="text-amber-400"
        />
      </div>

      {/* Detection lead time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Detection Lead Time
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-mono font-bold text-emerald-400">
              {metrics.detection_lead_time_days}
            </span>
            <span className="text-sm text-slate-400">days</span>
            <span className="text-slate-600 mx-1">|</span>
            <span className="text-xl font-mono font-bold text-emerald-300">
              {metrics.detection_lead_time_hours}
            </span>
            <span className="text-sm text-slate-400">hours</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Average early warning before failure event
          </span>
        </div>

        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Evaluation Dataset
          </span>
          <p className="text-sm text-slate-300 font-mono mt-1">
            {metrics.evaluation_dataset}
          </p>
        </div>
      </div>

      {/* Flag attribution breakdown */}
      {flag.total_high_critical_flags > 0 && (
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-3">
            Flag Attribution Breakdown
          </span>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 rounded-lg bg-sky-950/30 border border-sky-500/20">
              <span className="text-xs text-slate-400 block mb-1">ML Model Alone</span>
              <span className="text-lg font-mono font-bold text-sky-400">{flag.ml_score_alone_pct}%</span>
              <span className="text-[10px] text-slate-500 block">{flag.ml_score_alone_count} flags</span>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-950/30 border border-amber-500/20">
              <span className="text-xs text-slate-400 block mb-1">Safety Backstop</span>
              <span className="text-lg font-mono font-bold text-amber-400">{flag.safety_backstop_alone_pct}%</span>
              <span className="text-[10px] text-slate-500 block">{flag.safety_backstop_alone_count} flags</span>
            </div>
            <div className="text-center p-3 rounded-lg bg-violet-950/30 border border-violet-500/20">
              <span className="text-xs text-slate-400 block mb-1">Both Combined</span>
              <span className="text-lg font-mono font-bold text-violet-400">{flag.both_ml_and_backstop_pct}%</span>
              <span className="text-[10px] text-slate-500 block">{flag.both_ml_and_backstop_count} flags</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800">
            <span>Total High/Critical Flags: <strong className="text-white">{flag.total_high_critical_flags}</strong></span>
            <span>ML Model Involved: <strong className="text-sky-400">{flag.ml_model_involved_pct}%</strong></span>
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-violet-500/20 ring-1 ring-violet-400/30">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Manager Panel
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  Executive
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Fleet-wide business metrics, revenue-at-risk, and model validation reporting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800 text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${apiOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${apiOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {apiOnline ? 'Live' : 'Offline'} • 3s poll
            </span>
          </div>
        </div>
      </div>

      {/* Inline API Offline / Recovery Banner */}
      {!apiOnline && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 backdrop-blur-sm shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>
              Executive SCADA API is offline or reconnecting. Displaying latest metrics — automatically retrying every 3s...
            </span>
          </div>
          <button
            type="button"
            onClick={fetchSummary}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition shrink-0 cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      {loading && !summary ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Connecting to fleet API...
        </div>
      ) : summary ? (
        <>
          {/* Fleet Summary KPIs */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <span>⚡</span> Fleet Summary
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Total Turbines"
                value={summary.total_turbines}
                icon="🏭"
                accent="text-white"
              />
              <StatCard
                label="Revenue at Risk"
                value={`$${summary.total_revenue_at_risk?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon="💰"
                accent="text-rose-400"
                subtext="Cumulative degradation loss"
              />
              <StatCard
                label="Simulation Progress"
                value={`${summary.simulation_progress_pct}%`}
                icon="📈"
                accent="text-cyan-400"
              />
              <StatCard
                label="Simulated Time"
                value={summary.simulated_timestamp ? summary.simulated_timestamp.slice(0, 16) : '—'}
                icon="🕒"
                accent="text-emerald-400"
              />
            </div>

            {/* Risk Distribution */}
            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Fleet Risk Distribution
              </h3>
              <RiskDistributionBar
                distribution={summary.risk_distribution || {}}
                total={summary.total_turbines || 5}
              />
            </div>
          </div>

          {/* Model Performance Metrics */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <span>🧠</span> ML Model Performance
              <span className="text-[10px] font-normal text-slate-500 ml-2">
                Phase 4 Verified Metrics
              </span>
            </h2>

            <ModelMetrics metrics={summary.model_evaluation} />
          </div>
        </>
      ) : (
        <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-center">
          <p className="text-rose-300 text-sm font-medium">
            Unable to reach backend. Start the API server and run a simulation.
          </p>
        </div>
      )}
    </div>
  )
}
