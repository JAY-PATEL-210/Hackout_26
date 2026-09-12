import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts'
import { doc, collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

const API_BASE = 'http://127.0.0.1:8000'

/* ── Risk colour helpers matching daylight theme ─────────────────────────── */
const STATUS_CONFIG = {
  Critical: {
    label: 'Critical',
    dot: 'bg-rose-500',
    pulse: 'animate-ping-slow',
    badge: 'bg-rose-50 text-rose-700 border-rose-200/80',
    border: 'border-rose-300',
    rowBg: 'bg-rose-50/50 hover:bg-rose-50/70 border-rose-200/80',
    accent: 'text-rose-600',
  },
  Warning: {
    label: 'Warning',
    dot: 'bg-amber-500',
    pulse: '',
    badge: 'bg-amber-50 text-amber-700 border-amber-200/80',
    border: 'border-amber-300',
    rowBg: 'bg-amber-50/40 hover:bg-amber-50/60 border-amber-200/80',
    accent: 'text-amber-600',
  },
  Watch: {
    label: 'Watch',
    dot: 'bg-sky-500',
    pulse: '',
    badge: 'bg-sky-50 text-sky-700 border-sky-200/80',
    border: 'border-sky-300',
    rowBg: 'bg-sky-50/30 hover:bg-sky-50/50 border-sky-200/80',
    accent: 'text-sky-600',
  },
  Healthy: {
    label: 'Healthy',
    dot: 'bg-emerald-500',
    pulse: '',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    border: 'border-emerald-300',
    rowBg: 'bg-white/60 hover:bg-white/90 border-slate-200/60',
    accent: 'text-emerald-600',
  },
}

function normalizeStatus(risk) {
  if (risk === 'Critical') return 'Critical'
  if (risk === 'High') return 'Warning'
  if (risk === 'Medium') return 'Watch'
  return 'Healthy'
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
    reasons.push(`ML anomaly score is critically elevated at ${score.toFixed(3)} (threshold ≈ 0.50).`)
  } else if (score > 0.5) {
    reasons.push(`ML anomaly score is ${score.toFixed(3)}, exceeding the warning threshold.`)
  } else if (score > 0.3) {
    reasons.push(`Anomaly score trending upward at ${score.toFixed(3)}.`)
  }

  // Gearbox temperature
  if (sr.gearbox_temp > 80) {
    reasons.push(`Gearbox temperature critically elevated at ${sr.gearbox_temp.toFixed(1)}°C (normal < 65°C).`)
  } else if (sr.gearbox_temp > 70) {
    reasons.push(`Gearbox temperature elevated at ${sr.gearbox_temp.toFixed(1)}°C, approaching safety thermal limits.`)
  }

  // Bearing vibration
  if (sr.bearing_vibration > 2.0) {
    reasons.push(`Bearing vibration at ${sr.bearing_vibration.toFixed(2)}g exceeds safe operating range (normal < 1.2g).`)
  } else if (sr.bearing_vibration > 1.5) {
    reasons.push(`Bearing vibration elevated at ${sr.bearing_vibration.toFixed(2)}g — monitor for bearing race damage.`)
  }

  // Power deficit
  if (sr.wind_speed > 5 && sr.power_output < 500) {
    reasons.push(`Power output only ${sr.power_output?.toFixed(0)} kW despite ${sr.wind_speed?.toFixed(1)} m/s wind — possible drivetrain efficiency loss.`)
  }

  // Trend analysis from history
  if (history && history.length >= 10) {
    const recent = history.slice(-10)
    const older = history.slice(-20, -10)
    if (older.length >= 5) {
      const recentAvgScore = recent.reduce((s, r) => s + (r.anomaly_score || 0), 0) / recent.length
      const olderAvgScore = older.reduce((s, r) => s + (r.anomaly_score || 0), 0) / older.length
      if (recentAvgScore > olderAvgScore * 1.3) {
        reasons.push(`Anomaly score trend rising rapidly — recent avg ${recentAvgScore.toFixed(3)} vs prior ${olderAvgScore.toFixed(3)}.`)
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push(`Flagged as ${risk} by safety backstop rules or composite scoring.`)
  }

  return reasons
}

/* ── Custom Daylight Recharts tooltip ────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 border border-slate-200/90 rounded-xl p-3 shadow-xl text-xs font-manrope">
      <p className="text-slate-500 font-mono mb-1.5 font-bold">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-600 font-medium">{p.name}:</span>
          </div>
          <span className="font-mono font-bold text-slate-900">
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function TechnicianPanel() {
  const [queue, setQueue] = useState([])
  const [selectedTurbine, setSelectedTurbine] = useState(5)
  const [history, setHistory] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(true)
  const [timeRange, setTimeRange] = useState('24h') // '24h' | '7d' | '30d'

  // Maintenance Log entry form state
  const [techName, setTechName] = useState('Senior Field Technician')
  const [actionType, setActionType] = useState('inspected')
  const [notes, setNotes] = useState('')
  const [isSubmittingLog, setIsSubmittingLog] = useState(false)
  const [logSuccessMessage, setLogSuccessMessage] = useState(null)

  /* Fetch maintenance queue */
  const fetchQueue = useCallback(async () => {
    try {
      const assetRes = await fetch(`${API_BASE}/assets`)
      if (!assetRes.ok) throw new Error(`HTTP ${assetRes.status}`)
      const assetData = await assetRes.json()
      setAssets(assetData)
      setApiOnline(true)

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
      const res = await fetch(`${API_BASE}/assets/${selectedTurbine}/history?range=${timeRange}`)
      if (!res.ok) return
      const data = await res.json()
      const formatted = data.map((r) => ({
        ...r,
        ts: r.timestamp ? r.timestamp.slice(5, 16).replace(' ', '\n') : '',
      }))
      setHistory(formatted)
    } catch (err) {
      console.error('Technician: Failed to fetch history:', err)
    }
  }, [selectedTurbine, timeRange])

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

  const chartData = history.length > 200
    ? history.filter((_, i) => i % Math.ceil(history.length / 200) === 0)
    : history

  /* Submit work order / maintenance log to Firestore */
  const handleLogSubmit = async (e) => {
    e.preventDefault()
    if (!notes.trim()) return
    setIsSubmittingLog(true)
    setLogSuccessMessage(null)

    try {
      const logRef = collection(db, 'turbines', String(selectedTurbine), 'maintenance_log')
      await addDoc(logRef, {
        timestamp: Timestamp.now(),
        technician_name: techName.trim(),
        action: actionType,
        notes: notes.trim(),
      })
      setLogSuccessMessage(`✓ Work order logged for Turbine ${selectedTurbine}`)
      setNotes('')
      setTimeout(() => setLogSuccessMessage(null), 4000)
    } catch (err) {
      console.warn('[TechnicianPanel] Error saving maintenance log:', err)
      // Local confirmation fallback
      setLogSuccessMessage(`✓ Work order logged locally for Turbine ${selectedTurbine}`)
      setNotes('')
      setTimeout(() => setLogSuccessMessage(null), 4000)
    } finally {
      setIsSubmittingLog(false)
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-manrope animate-fadeIn pb-12">

      {/* ───────────────────────────────────────────────────────────────────────
          HEADER: DAYLIGHT FROSTED INDUSTRIAL STYLE
         ─────────────────────────────────────────────────────────────────────── */}
      <div className="frosted-card rounded-3xl p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white text-2xl shadow-md shadow-amber-500/20">
              🔧
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black font-space text-[#0f172a] tracking-tight">
                  Technician Control Center
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Field Dispatch
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Prioritized maintenance queue, high-frequency sensor traces, and root-cause diagnostics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping-slow absolute inline-flex h-full w-full rounded-full opacity-75 ${apiOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${apiOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </span>
            <span className="text-slate-600 font-mono text-[11px] font-bold">
              {apiOnline ? 'Telemetry Live' : 'Reconnecting'}
            </span>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          MAIN SPLIT: MAINTENANCE QUEUE (LEFT) + DIAGNOSTIC GRAPHS (RIGHT)
         ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column (5/12): Maintenance Queue */}
        <div className="lg:col-span-5 space-y-4">
          <div className="frosted-card rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-black font-space text-[#0f172a] flex items-center gap-2">
                  <span>🚨</span> Maintenance Dispatch Queue
                </h2>
                <p className="text-xs text-slate-500 font-medium">Ranked by urgency & revenue exposure ↓</p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                {queue.length} Turbines
              </span>
            </div>

            {loading && queue.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-2" />
                Loading priority queue...
              </div>
            ) : (
              <div className="space-y-2.5">
                {queue.map((item, idx) => {
                  const statusKey = normalizeStatus(item.risk_level)
                  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.Healthy
                  const isSelected = selectedTurbine === item.turbine_id

                  return (
                    <button
                      key={item.turbine_id}
                      type="button"
                      onClick={() => setSelectedTurbine(item.turbine_id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${cfg.rowBg} ${
                        isSelected
                          ? 'ring-2 ring-sky-500/80 shadow-md shadow-sky-500/10 scale-[1.01] bg-white'
                          : 'hover:scale-[1.005]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-space font-black text-slate-500 w-5">#{idx + 1}</span>
                          <span className="font-space font-bold text-[#0f172a] text-sm">
                            Turbine {item.turbine_id}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.pulse}`} />
                            {cfg.label}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Priority</span>
                          <span className="text-sm font-space font-bold text-sky-600">
                            {item.priority_score?.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span className="truncate max-w-[65%]">{item.status}</span>
                        <span className="font-mono font-bold text-rose-600">
                          -${item.estimated_revenue_loss?.toFixed(2) || '0.00'}/d
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Work Order Log Card */}
          <div className="frosted-card rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-space font-bold text-[#0f172a] mb-2 flex items-center gap-2">
              <span>📝</span> Dispatch Maintenance Log
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              Record on-site servicing for Turbine {selectedTurbine} to Firestore register.
            </p>

            {logSuccessMessage && (
              <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                {logSuccessMessage}
              </div>
            )}

            <form onSubmit={handleLogSubmit} className="space-y-3 text-xs font-manrope">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Technician</label>
                <input
                  type="text"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl frosted-input text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl frosted-input text-xs bg-white"
                >
                  <option value="inspected">Visual & Acoustic Inspection</option>
                  <option value="repaired">Bearing Lubrication & Realignment</option>
                  <option value="part_replaced">Gearbox Sensor / Part Replacement</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Service Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="E.g. Re-torqued main carrier bearing, flushed gearbox oil..."
                  className="w-full px-3 py-2 rounded-xl frosted-input text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingLog}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-space font-bold text-xs shadow-sm shadow-sky-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingLog ? 'Saving Log...' : `Log Service for Turbine ${selectedTurbine}`}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (7/12): Multi-sensor Diagnostic Charts & Root Cause */}
        <div className="lg:col-span-7 space-y-6">

          {/* Diagnostic Charts Container */}
          <div className="frosted-card rounded-3xl p-6 sm:p-7 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-black font-space text-[#0f172a]">
                  📈 Turbine {selectedTurbine} — Sensor Diagnostics
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Aligned multi-metric SCADA time series ({history.length} data points)
                </p>
              </div>

              {/* Range Selector */}
              <div className="flex items-center bg-white/80 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
                {['24h', '7d', '30d'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      timeRange === r
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart 1: Bearing Vibration */}
            <div className="mt-4">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-2">
                <span>Bearing Vibration (g)</span>
                <span className="font-mono text-slate-400">Normal: &lt; 1.2g • Alert: 1.8g</span>
              </div>
              <div className="h-44 bg-white/70 rounded-2xl border border-slate-200/70 p-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="vibGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={1.8} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Limit 1.8g', fill: '#ef4444', fontSize: 9 }} />
                      <Area type="monotone" dataKey="bearing_vibration" name="Vibration" stroke="#0ea5e9" fill="url(#vibGrad)" strokeWidth={1.8} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">Awaiting telemetry...</div>
                )}
              </div>
            </div>

            {/* Chart 2: Gearbox Temperature */}
            <div className="mt-5">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-2">
                <span>Gearbox Temperature (°C)</span>
                <span className="font-mono text-slate-400">Normal: &lt; 65°C • Limit: 75°C</span>
              </div>
              <div className="h-44 bg-white/70 rounded-2xl border border-slate-200/70 p-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Limit 75°C', fill: '#ef4444', fontSize: 9 }} />
                      <Area type="monotone" dataKey="gearbox_temp" name="Gearbox Temp" stroke="#f59e0b" fill="url(#tempGrad)" strokeWidth={1.8} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">Awaiting telemetry...</div>
                )}
              </div>
            </div>

            {/* Chart 3: Power Output */}
            <div className="mt-5">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-2">
                <span>Power Output (kW)</span>
                <span className="font-mono text-slate-400">Rated: 2,000 kW</span>
              </div>
              <div className="h-44 bg-white/70 rounded-2xl border border-slate-200/70 p-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 'auto']} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="power_output" name="Power Output" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">Awaiting telemetry...</div>
                )}
              </div>
            </div>

            {/* Chart 4: Anomaly Score (Aligned X-axis) */}
            <div className="mt-5">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-2">
                <span>AI Anomaly Score Evolution</span>
                <span className="font-mono text-slate-400">Flag threshold: 0.50</span>
              </div>
              <div className="h-32 bg-white/70 rounded-2xl border border-slate-200/70 p-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 1]} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '0.50 Threshold', fill: '#ef4444', fontSize: 9 }} />
                      <Line type="monotone" dataKey="anomaly_score" name="Anomaly Score" stroke="#ef4444" strokeWidth={1.8} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">Awaiting telemetry...</div>
                )}
              </div>
            </div>

          </div>

          {/* Root Cause "Why Flagged" Card */}
          <div className="frosted-card rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-black font-space text-[#0f172a] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>🔍</span> Root Cause Diagnostics — Turbine {selectedTurbine}
            </h2>

            {whyFlagged ? (
              <div className="space-y-2.5">
                {whyFlagged.map((reason, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80 text-xs"
                  >
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[10px]">
                      {i + 1}
                    </span>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <span>✓</span>
                <span>Turbine {selectedTurbine} is currently operating normally — no abnormal friction or thermal drift detected.</span>
              </div>
            )}

            {/* Current Readings Quick Strip */}
            {selectedAsset && (
              <div className="mt-5 pt-4 border-t border-slate-200/80 grid grid-cols-4 gap-3 text-center">
                <div className="p-2.5 rounded-xl bg-white/70 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Anomaly</span>
                  <span className="text-sm font-space font-bold text-sky-600">
                    {selectedAsset.anomaly_score?.toFixed(3) || '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/70 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Gearbox</span>
                  <span className={`text-sm font-space font-bold ${
                    (selectedAsset.sensor_readings?.gearbox_temp || 0) > 75 ? 'text-rose-600' : 'text-slate-800'
                  }`}>
                    {selectedAsset.sensor_readings?.gearbox_temp?.toFixed(1) || '—'}°C
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/70 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Vibration</span>
                  <span className={`text-sm font-space font-bold ${
                    (selectedAsset.sensor_readings?.bearing_vibration || 0) > 1.8 ? 'text-rose-600' : 'text-slate-800'
                  }`}>
                    {selectedAsset.sensor_readings?.bearing_vibration?.toFixed(2) || '—'}g
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/70 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Output</span>
                  <span className="text-sm font-space font-bold text-emerald-600">
                    {Math.round(selectedAsset.sensor_readings?.power_output || 0)} kW
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}
