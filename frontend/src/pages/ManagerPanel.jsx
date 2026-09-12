import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'

const API_BASE = 'http://127.0.0.1:8000'

/* ── Color tokens ───────────────────────────────────────────────────────────── */
const RISK_PALETTE = {
  Low:      { fill: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  Medium:   { fill: '#f59e0b', text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'  },
  High:     { fill: '#f97316', text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30' },
  Critical: { fill: '#f43f5e', text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/60'   },
}

/* ── Max rolling history points to plot ─────────────────────────────────────── */
const MAX_HISTORY = 120

/* ── Stat card component ────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent = 'violet', icon }) {
  const accents = {
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  }
  return (
    <div className={`rounded-2xl border bg-slate-900/60 backdrop-blur-sm p-5 shadow-xl flex flex-col gap-1 ${accents[accent]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-base">{icon}</span>}
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      </div>
      <p className="text-3xl font-extrabold tracking-tight text-white">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5 leading-snug">{sub}</p>}
    </div>
  )
}

/* ── Custom Donut tooltip ────────────────────────────────────────────────────── */
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  const p = RISK_PALETTE[name] || {}
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 text-xs shadow-2xl">
      <p className={`font-bold ${p.text || 'text-white'}`}>{name}</p>
      <p className="text-slate-300 mt-0.5">{value} turbine{value !== 1 ? 's' : ''}</p>
    </div>
  )
}

/* ── Custom Trend tooltip ────────────────────────────────────────────────────── */
function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 text-xs shadow-2xl min-w-[180px]">
      <p className="text-slate-400 border-b border-slate-800 pb-1 mb-1.5 font-mono">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-3">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-mono">{Number(p.value).toFixed(4)}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Custom Donut label ───────────────────────────────────────────────────────── */
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.08) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

/* ── Metric validation row ────────────────────────────────────────────────────── */
function ValidationRow({ icon, label, value, note }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-800/60 last:border-0">
      <span className="text-lg mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        {note && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{note}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-base font-bold text-violet-300 font-mono">{value}</p>
      </div>
    </div>
  )
}

/* ── Attribution bar ─────────────────────────────────────────────────────────── */
function AttributionBar({ label, pct, color }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono font-semibold text-white">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════ */
export default function ManagerPanel() {
  const [summary, setSummary]           = useState(null)
  const [assets, setAssets]             = useState([])
  const [trendHistory, setTrendHistory] = useState([])
  const [loading, setLoading]           = useState(true)
  const [lastUpdated, setLastUpdated]   = useState(null)
  const pollingRef = useRef(null)

  /* ── Fetch /fleet/summary (called once, then every 4 s) ──────────────── */
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/fleet/summary`)
      if (!res.ok) return
      const data = await res.json()
      setSummary(data)
    } catch (_) {}
  }, [])

  /* ── Fetch /assets every 2 s and accumulate rolling trend ───────────── */
  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/assets`)
      if (!res.ok) return
      const data = await res.json()
      setAssets(data)
      setLastUpdated(new Date())
      setLoading(false)

      if (data.length > 0) {
        const avgScore = data.reduce((s, t) => s + (t.anomaly_score || 0), 0) / data.length
        const riskScore = data.reduce((s, t) => {
          const w = { Low: 0, Medium: 1, High: 2, Critical: 3 }
          return s + (w[t.risk_level] || 0)
        }, 0) / data.length

        const ts = data[0]?.last_updated
          ? new Date(data[0].last_updated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

        setTrendHistory(prev => {
          const next = [...prev, { time: ts, avgAnomalyScore: +avgScore.toFixed(4), avgRiskScore: +riskScore.toFixed(3) }]
          return next.slice(-MAX_HISTORY)
        })
      }
    } catch (_) {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
    fetchAssets()

    const summaryInterval = setInterval(fetchSummary, 4000)
    const assetsInterval  = setInterval(fetchAssets, 2000)
    pollingRef.current = [summaryInterval, assetsInterval]

    return () => {
      clearInterval(summaryInterval)
      clearInterval(assetsInterval)
    }
  }, [fetchSummary, fetchAssets])

  /* ── Derived values ──────────────────────────────────────────────────── */
  const dist = summary?.risk_distribution || { Low: 0, Medium: 0, High: 0, Critical: 0 }
  const donutData = Object.entries(dist)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  const atRiskCount   = (dist.Medium || 0) + (dist.High || 0) + (dist.Critical || 0)
  const totalRevLoss  = summary?.total_revenue_at_risk ?? 0
  const evalData      = summary?.model_evaluation
  const flagAttr      = evalData?.flag_attribution

  const highestRisk   = assets.reduce((worst, t) => {
    const order = { Critical: 4, High: 3, Medium: 2, Low: 1 }
    return (order[t.risk_level] || 0) > (order[worst?.risk_level] || 0) ? t : worst
  }, null)

  /* ── Loading skeleton ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading fleet data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">

      {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-violet-500/10 text-2xl border border-violet-500/20">📊</span>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Executive Fleet Overview</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Real-time financial exposure, AI early-warning performance, and fleet health for budget allocation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live · updated {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}</span>
          </div>
        </div>
      </div>

      {/* ── KPI ROW ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="💵"
          label="Estimated Revenue at Risk"
          value={totalRevLoss > 0 ? `$${totalRevLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '$0'}
          sub="Cumulative power-output loss across degraded turbines at $0.12/kWh"
          accent="rose"
        />
        <StatCard
          icon="⚠️"
          label="Turbines Needing Attention"
          value={`${atRiskCount} / ${summary?.total_turbines ?? 5}`}
          sub="Medium, High, or Critical risk — action recommended"
          accent={atRiskCount > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          icon="🕐"
          label="Average Early-Warning Lead Time"
          value={evalData ? `${evalData.detection_lead_time_days} days` : '—'}
          sub="How far in advance the system identifies developing faults before failure"
          accent="cyan"
        />
        <StatCard
          icon="🛡️"
          label="Fault Detection Coverage"
          value={evalData ? `${(evalData.recall * 100).toFixed(0)}%` : '—'}
          sub="Share of real fault events caught by the system"
          accent="violet"
        />
      </div>

      {/* ── FLEET RISK DISTRIBUTION + REVENUE ROW ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Donut chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-white text-base">Fleet Risk Breakdown</h2>
              <p className="text-xs text-slate-400 mt-0.5">Current risk level across all {summary?.total_turbines ?? 5} turbines</p>
            </div>
            {summary?.simulation_progress_pct != null && (
              <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-1 rounded-lg">
                Sim {summary.simulation_progress_pct}%
              </span>
            )}
          </div>

          {donutData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel}
                    animationBegin={0}
                    animationDuration={600}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={RISK_PALETTE[entry.name]?.fill || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex flex-col gap-2 flex-1">
                {['Critical', 'High', 'Medium', 'Low'].map((level) => {
                  const count = dist[level] || 0
                  const p = RISK_PALETTE[level]
                  return (
                    <div key={level} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${p.bg} ${p.border}`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.fill }} />
                        <span className={`text-xs font-semibold ${p.text}`}>{level}</span>
                      </div>
                      <span className="text-white font-bold text-sm">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
              Waiting for simulation data…
            </div>
          )}

          {/* Worst turbine callout */}
          {highestRisk && highestRisk.risk_level !== 'Low' && (
            <div className={`mt-4 rounded-xl px-4 py-3 border text-xs leading-relaxed
              ${RISK_PALETTE[highestRisk.risk_level]?.bg} ${RISK_PALETTE[highestRisk.risk_level]?.border}`}>
              <span className={`font-bold ${RISK_PALETTE[highestRisk.risk_level]?.text}`}>
                ⚡ Turbine {highestRisk.turbine_id} — {highestRisk.risk_level} Risk
              </span>
              <span className="text-slate-300 ml-2">{highestRisk.status}</span>
            </div>
          )}
        </div>

        {/* Revenue at risk detail */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <h2 className="font-bold text-white text-base mb-1">Revenue Exposure by Turbine</h2>
          <p className="text-xs text-slate-400 mb-5">
            Power loss × electricity price ($0.12/kWh) since each asset first showed degradation
          </p>

          <div className="space-y-3">
            {assets.length > 0 ? assets.map((t) => {
              const p = RISK_PALETTE[t.risk_level] || RISK_PALETTE.Low
              const score = t.anomaly_score || 0
              // Estimate revenue from anomaly score as proxy (exact values come from /impact endpoint)
              return (
                <div key={t.turbine_id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${p.bg} ${p.border}`}>
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 border border-slate-700">
                    <span className="text-xs font-bold text-white">T{t.turbine_id}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${p.text}`}>{t.risk_level}</span>
                      <span className="text-xs text-slate-500 truncate">{t.status}</span>
                    </div>
                    {/* Anomaly score mini-bar */}
                    <div className="mt-1.5 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, score * 150)}%`, background: p.fill }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">Anomaly</p>
                    <p className="text-sm font-bold font-mono" style={{ color: p.fill }}>{score.toFixed(3)}</p>
                  </div>
                </div>
              )
            }) : (
              <p className="text-slate-500 text-sm text-center py-8">Waiting for asset data…</p>
            )}
          </div>

          {totalRevLoss > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-sm text-slate-400 font-medium">Total estimated financial exposure</span>
              <span className="text-xl font-extrabold text-rose-400 font-mono">
                ${totalRevLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── MODEL PERFORMANCE CARD ────────────────────────────────────────── */}
      {evalData && (
        <div className="bg-slate-900/60 border border-violet-500/20 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <div className="flex items-start gap-3 mb-5">
            <span className="p-2 rounded-xl bg-violet-500/10 text-xl border border-violet-500/20 shrink-0">🤖</span>
            <div>
              <h2 className="font-bold text-white text-base">AI System Validation</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Performance verified on a held-out dataset the model was never trained on — results are conservative and reliable
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            {/* Left: key metrics */}
            <div>
              <ValidationRow
                icon="📅"
                label="Detects faults before they happen"
                value={`${evalData.detection_lead_time_days} days early`}
                note="Average time between the system's first alert and actual equipment failure — giving maintenance teams time to act"
              />
              <ValidationRow
                icon="🎯"
                label="Catches this share of real faults"
                value={`${(evalData.recall * 100).toFixed(1)}%`}
                note="Out of every 100 actual fault events, the system correctly flags this many before they become breakdowns"
              />
              <ValidationRow
                icon="📣"
                label="Alert accuracy (positive predictive value)"
                value={`${(evalData.precision * 100).toFixed(1)}%`}
                note="When the system raises an alarm, this is how often it corresponds to a real developing fault"
              />
              <ValidationRow
                icon="✅"
                label="False alarm rate on healthy turbines"
                value={`${(evalData.false_positive_rate_healthy_turbines * 100).toFixed(1)}%`}
                note="Share of readings on fully healthy turbines that were incorrectly flagged — kept low to avoid alert fatigue"
              />
            </div>

            {/* Right: attribution */}
            {flagAttr && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                  How alarms are generated
                </p>
                <div className="space-y-4">
                  <AttributionBar
                    label="AI anomaly model — autonomous detection"
                    pct={flagAttr.ml_model_involved_pct}
                    color="#a78bfa"
                  />
                  <AttributionBar
                    label="Rule-based safety backstop (sensor threshold)"
                    pct={flagAttr.safety_backstop_involved_pct}
                    color="#fb923c"
                  />
                  <AttributionBar
                    label="AI alone (no sensor threshold breached)"
                    pct={flagAttr.ml_score_alone_pct}
                    color="#818cf8"
                  />
                  <AttributionBar
                    label="Safety rule alone (AI score below High)"
                    pct={flagAttr.safety_backstop_alone_pct}
                    color="#fb7185"
                  />
                </div>

                <div className="mt-5 p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-violet-300">Key takeaway: </span>
                  The AI model autonomously generates{' '}
                  <span className="text-white font-bold">{flagAttr.ml_model_involved_pct}%</span> of all alerts,
                  while the rule-based safety net catches an additional{' '}
                  <span className="text-white font-bold">{flagAttr.safety_backstop_alone_pct}%</span> of
                  edge cases where sensor readings cross hard thresholds — providing two independent
                  layers of protection.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORICAL TREND ─────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-bold text-white text-base">Fleet-Wide Risk Trend</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rolling average anomaly score across all turbines — built live from polling data this session
            </p>
          </div>
          <span className="text-xs text-slate-500 bg-slate-800 rounded-lg px-2 py-1 font-mono">
            {trendHistory.length} pts
          </span>
        </div>

        {trendHistory.length >= 3 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                width={48}
              />
              <Tooltip content={<TrendTooltip />} />
              {/* Reference line at p90 threshold — the "Medium risk" cutoff */}
              <ReferenceLine
                y={0.5198}
                stroke="#f59e0b"
                strokeDasharray="4 3"
                label={{ value: 'Alert threshold', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
              />
              <Line
                type="monotone"
                dataKey="avgAnomalyScore"
                name="Avg Anomaly Score"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#a78bfa' }}
              />
              <Line
                type="monotone"
                dataKey="avgRiskScore"
                name="Avg Risk Level (0–3)"
                stroke="#fb923c"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                activeDot={{ r: 4, fill: '#fb923c' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
            <div className="w-8 h-8 border-2 border-violet-500/50 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Accumulating fleet history — updates every 2 seconds…</p>
            <p className="text-xs">({trendHistory.length}/3 readings collected)</p>
          </div>
        )}

        <p className="text-xs text-slate-600 mt-3">
          Purple line = fleet-average ML anomaly score · Orange dashed = average risk tier (0=Low, 1=Med, 2=High, 3=Critical) ·
          Yellow dashed = Medium-risk alert threshold (p90)
        </p>
      </div>

    </div>
  )
}
