import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts'

const API_BASE = 'http://127.0.0.1:8000'

/* ── Risk colour helpers ─────────────────────────────────────────────────── */
const RISK_BADGE = {
  Critical: 'bg-rose-500/25 text-rose-400 border-rose-500/50',
  High:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
  Medium:   'bg-amber-500/20 text-amber-400 border-amber-500/40',
  Low:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}
const RISK_DOT = {
  Critical: 'bg-rose-400', High: 'bg-orange-400',
  Medium: 'bg-amber-400', Low: 'bg-emerald-400',
}
const RISK_ROW_BG = {
  Critical: 'bg-rose-950/30 border-rose-500/40',
  High:     'bg-orange-950/20 border-orange-500/30',
  Medium:   'bg-amber-950/15 border-amber-500/20',
  Low:      'bg-slate-950/60 border-slate-800',
}

/* ── "Why Flagged" diagnostic generator ──────────────────────────────────── */
function buildWhyFlagged(asset, history) {
  if (!asset) return null
  const risk = asset.risk_level
  if (risk === 'Low') return null

  const reasons = []
  const sr = asset.sensor_readings || {}

  // Anomaly score analysis
  const score = asset.anomaly_score ?? 0
  if (score > 0.7) {
    reasons.push(`ML anomaly score is critically elevated at ${score.toFixed(3)} (threshold ≈ 0.5).`)
  } else if (score > 0.5) {
    reasons.push(`ML anomaly score is ${score.toFixed(3)}, above the warning threshold.`)
  } else if (score > 0.3) {
    reasons.push(`Anomaly score trending upward at ${score.toFixed(3)}.`)
  }

  // Gearbox temperature
  if (sr.gearbox_temp > 80) {
    reasons.push(`Gearbox temperature is critically high at ${sr.gearbox_temp.toFixed(1)}°C (normal < 65°C).`)
  } else if (sr.gearbox_temp > 70) {
    reasons.push(`Gearbox temperature elevated at ${sr.gearbox_temp.toFixed(1)}°C, approaching safety limit.`)
  }

  // Bearing vibration
  if (sr.bearing_vibration > 2.0) {
    reasons.push(`Bearing vibration at ${sr.bearing_vibration.toFixed(2)}g exceeds safe operating range (normal < 1.2g).`)
  } else if (sr.bearing_vibration > 1.5) {
    reasons.push(`Bearing vibration elevated at ${sr.bearing_vibration.toFixed(2)}g — monitor for escalation.`)
  }

  // Power deficit
  if (sr.wind_speed > 5 && sr.power_output < 500) {
    reasons.push(`Power output only ${sr.power_output.toFixed(0)} kW despite ${sr.wind_speed.toFixed(1)} m/s wind — possible drivetrain efficiency loss.`)
  }

  // Trend analysis from history
  if (history && history.length >= 10) {
    const recent = history.slice(-10)
    const older  = history.slice(-20, -10)
    if (older.length >= 5) {
      const recentAvgScore = recent.reduce((s, r) => s + (r.anomaly_score || 0), 0) / recent.length
      const olderAvgScore  = older.reduce((s, r) => s + (r.anomaly_score || 0), 0) / older.length
      if (recentAvgScore > olderAvgScore * 1.3) {
        reasons.push(`Anomaly score trend is rising — recent avg ${recentAvgScore.toFixed(3)} vs prior ${olderAvgScore.toFixed(3)}.`)
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push(`Flagged as ${risk} by safety backstop rules or composite scoring.`)
  }

  return reasons
}

/* ── Custom Recharts tooltip ─────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-400 font-mono mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-mono font-bold text-white">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Main Component ──────────────────────────────────────────────────────── */
export default function TechnicianPanel() {
  const [queue, setQueue] = useState([])
  const [selectedTurbine, setSelectedTurbine] = useState(5)
  const [history, setHistory] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(true)

  /* Fetch maintenance queue (all turbines with priority scores) */
  const fetchQueue = useCallback(async () => {
    try {
      // 1. Get all assets
      const assetRes = await fetch(`${API_BASE}/assets`)
      if (!assetRes.ok) throw new Error(`HTTP ${assetRes.status}`)
      const assetData = await assetRes.json()
      setAssets(assetData)
      setApiOnline(true)

      // 2. Get priority scores for each turbine
      const priorities = await Promise.all(
        assetData.map(async (a) => {
          try {
            const res = await fetch(`${API_BASE}/assets/${a.turbine_id}/queue-priority`)
            if (!res.ok) return { ...a, priority_score: 0, estimated_revenue_loss: 0 }
            const data = await res.json()
            return { ...a, ...data }
          } catch {
            return { ...a, priority_score: 0, estimated_revenue_loss: 0 }
          }
        })
      )

      // Sort by priority_score descending
      priorities.sort((a, b) => b.priority_score - a.priority_score)
      setQueue(priorities)
    } catch (err) {
      console.error('Technician: Failed to fetch queue:', err)
      setApiOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  /* Fetch history for selected turbine */
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/assets/${selectedTurbine}/history?range=30d`)
      if (!res.ok) return
      const data = await res.json()
      // Format timestamps for chart readability
      const formatted = data.map((r) => ({
        ...r,
        ts: r.timestamp ? r.timestamp.slice(5, 16).replace(' ', '\n') : '',
      }))
      setHistory(formatted)
    } catch (err) {
      console.error('Technician: Failed to fetch history:', err)
    }
  }, [selectedTurbine])

  // Poll every 3 seconds
  useEffect(() => {
    fetchQueue()
    fetchHistory()
    const timer = setInterval(() => {
      fetchQueue()
      fetchHistory()
    }, 3000)
    return () => clearInterval(timer)
  }, [fetchQueue, fetchHistory])

  const selectedAsset = assets.find((a) => a.turbine_id === selectedTurbine) || null
  const whyFlagged = buildWhyFlagged(selectedAsset, history)

  // Downsample history for chart performance
  const chartData = history.length > 200
    ? history.filter((_, i) => i % Math.ceil(history.length / 200) === 0)
    : history

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30">
              🔧
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Technician Panel
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Maintenance
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Prioritized maintenance queue with diagnostic sensor charts and root-cause analysis.
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
              SCADA API is offline or reconnecting. Telemetry display will update automatically once backend is reached.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              fetchQueue()
              fetchHistory()
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition shrink-0 cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Maintenance Queue */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>🚨</span> Maintenance Queue
              </h2>
              <span className="text-[10px] font-mono text-slate-500">
                Sorted by priority score ↓
              </span>
            </div>

            {loading && queue.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Loading queue...
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((item, idx) => (
                  <button
                    key={item.turbine_id}
                    type="button"
                    onClick={() => setSelectedTurbine(item.turbine_id)}
                    className={`
                      w-full text-left p-4 rounded-xl border transition-all duration-200
                      ${RISK_ROW_BG[item.risk_level] || RISK_ROW_BG.Low}
                      ${selectedTurbine === item.turbine_id
                        ? 'ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/10 scale-[1.01]'
                        : 'hover:brightness-110 hover:scale-[1.005]'}
                      cursor-pointer
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono text-slate-500 w-5">#{idx + 1}</span>
                        <span className="font-bold text-white text-sm">
                          Turbine {item.turbine_id}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${RISK_BADGE[item.risk_level] || RISK_BADGE.Low}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[item.risk_level] || RISK_DOT.Low}`} />
                          {item.risk_level}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">Priority</span>
                        <span className="text-sm font-mono font-bold text-cyan-400">
                          {item.priority_score?.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate max-w-[60%]">{item.status}</span>
                      <span className="font-mono">
                        Loss: ${item.estimated_revenue_loss?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail Charts + Why Flagged */}
        <div className="lg:col-span-7 space-y-5">
          {/* Turbine selector header */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                📈 Turbine {selectedTurbine} — Sensor Diagnostics
              </h2>
              <span className="text-[10px] font-mono text-slate-500">
                {history.length} data points
              </span>
            </div>

            {/* Bearing Vibration Chart */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">Bearing Vibration (g)</h3>
              <div className="h-44 bg-slate-950/60 rounded-xl border border-slate-800 p-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="vibGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={1.8} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Alert', fill: '#ef4444', fontSize: 10 }} />
                      <Area type="monotone" dataKey="bearing_vibration" name="Vibration" stroke="#f97316" fill="url(#vibGrad)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">No data yet</div>
                )}
              </div>
            </div>

            {/* Gearbox Temp Chart */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">Gearbox Temperature (°C)</h3>
              <div className="h-44 bg-slate-950/60 rounded-xl border border-slate-800 p-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Limit', fill: '#ef4444', fontSize: 10 }} />
                      <Area type="monotone" dataKey="gearbox_temp" name="Gearbox Temp" stroke="#ef4444" fill="url(#tempGrad)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">No data yet</div>
                )}
              </div>
            </div>

            {/* Power Output Chart */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">Power Output (kW)</h3>
              <div className="h-44 bg-slate-950/60 rounded-xl border border-slate-800 p-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 'auto']} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="power_output" name="Power" stroke="#22d3ee" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">No data yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Why Flagged Analysis */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
              <span>🔍</span> Why Flagged — Turbine {selectedTurbine}
            </h2>

            {whyFlagged ? (
              <div className="space-y-2.5">
                {whyFlagged.map((reason, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl bg-rose-950/20 border border-rose-500/20"
                  >
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Turbine {selectedTurbine} is currently operating normally — no flags.
              </div>
            )}

            {/* Current readings quick strip */}
            {selectedAsset && (
              <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-4 gap-3">
                {[
                  { label: 'Score', value: selectedAsset.anomaly_score?.toFixed(3), color: 'text-cyan-400' },
                  { label: 'Gearbox', value: `${selectedAsset.sensor_readings?.gearbox_temp?.toFixed(1)}°C`, color: selectedAsset.sensor_readings?.gearbox_temp > 75 ? 'text-rose-400' : 'text-slate-300' },
                  { label: 'Vibration', value: `${selectedAsset.sensor_readings?.bearing_vibration?.toFixed(2)}g`, color: selectedAsset.sensor_readings?.bearing_vibration > 1.8 ? 'text-rose-400' : 'text-slate-300' },
                  { label: 'Power', value: `${selectedAsset.sensor_readings?.power_output?.toFixed(0)} kW`, color: 'text-sky-400' },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <span className="text-[10px] text-slate-500 uppercase block">{m.label}</span>
                    <span className={`text-sm font-mono font-bold ${m.color}`}>{m.value ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
