import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'

const API_BASE = 'http://127.0.0.1:8000'

/* ── Color tokens matching SCADA Operations Theme ──────────────────────────── */
const RISK_COLORS = {
  Low: {
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/10',
    ring: 'ring-emerald-500/20',
  },
  Medium: {
    bg: 'bg-amber-950/30',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/15',
    ring: 'ring-amber-500/25',
  },
  High: {
    bg: 'bg-orange-950/30',
    border: 'border-orange-500/50',
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    dot: 'bg-orange-400',
    text: 'text-orange-400',
    glow: 'shadow-orange-500/20',
    ring: 'ring-orange-500/30',
  },
  Critical: {
    bg: 'bg-rose-950/40',
    border: 'border-rose-500/70',
    badge: 'bg-rose-500/25 text-rose-400 border-rose-500/60',
    dot: 'bg-rose-400',
    text: 'text-rose-400',
    glow: 'shadow-rose-500/25',
    ring: 'ring-rose-500/40',
  },
}

function getRisk(level) {
  return RISK_COLORS[level] || RISK_COLORS.Low
}

/* ── Formats the dynamic "Why Flagged" list returned by backend ─────────────── */
function formatWhyFlagged(whyFlaggedList) {
  if (!whyFlaggedList || !Array.isArray(whyFlaggedList) || whyFlaggedList.length === 0) {
    return 'Operating within normal baseline tolerances.'
  }
  const parts = whyFlaggedList.map((item) => {
    const sigma = Math.abs(item.z_score).toFixed(1)
    const direction = item.z_score >= 0 ? 'above normal' : 'below normal'
    return `${item.feature} (${sigma}σ ${direction})`
  })
  return `Flagged due to: ${parts.join(', ')}`
}

/* ── Custom Recharts Tooltip for Multi-Line Sensor Chart ──────────────────── */
function CustomSensorTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[210px] z-50">
      <div className="font-mono text-slate-400 border-b border-slate-800 pb-1 flex justify-between items-center">
        <span>Time:</span>
        <span className="text-white font-medium">{label}</span>
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}:
          </span>
          <span className="font-mono font-bold text-slate-200">
            {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Custom Recharts Tooltip for Anomaly Score Chart ──────────────────────── */
function CustomScoreTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const score = payload[0]?.value

  return (
    <div className="bg-slate-900/95 border border-slate-700 p-2.5 rounded-xl shadow-xl backdrop-blur-md text-xs space-y-1 min-w-[170px] z-50">
      <div className="font-mono text-slate-400 flex justify-between">
        <span>Time:</span>
        <span className="text-white font-medium">{label}</span>
      </div>
      <div className="flex items-center justify-between text-purple-400 pt-1 border-t border-slate-800">
        <span>Anomaly Score:</span>
        <span className="font-mono font-bold text-purple-300">
          {typeof score === 'number' ? score.toFixed(4) : score}
        </span>
      </div>
    </div>
  )
}

export default function TechnicianPanel() {
  // Maintenance Queue state
  const [queue, setQueue] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [lastSyncTime, setLastSyncTime] = useState(null)
  const [serverOnline, setServerOnline] = useState(true)

  // Chart / Detail View state
  const [timeRange, setTimeRange] = useState('24h') // '24h' | '7d' | '30d'
  const [historyData, setHistoryData] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Inspection tracking in local state
  const [inspectedMap, setInspectedMap] = useState({})
  const [inspectionToast, setInspectionToast] = useState(null)

  // Simulation header indicators
  const [simStatus, setSimStatus] = useState('idle')
  const [currentStep, setCurrentStep] = useState(0)

  // Visible chart line toggles
  const [visibleLines, setVisibleLines] = useState({
    bearing_vibration: true,
    gearbox_temp: true,
    power_output: true,
  })

  /* ── 1. Maintenance Queue Polling: GET /assets every 2s ─────────────────── */
  const fetchQueue = async () => {
    try {
      const assetsRes = await fetch(`${API_BASE}/assets`)
      if (!assetsRes.ok) throw new Error(`HTTP ${assetsRes.status}`)

      // Extract simulation status headers
      const statusHeader = assetsRes.headers.get('X-Simulation-Status')
      const stepHeader = assetsRes.headers.get('X-Current-Step')
      if (statusHeader) setSimStatus(statusHeader)
      if (stepHeader) setCurrentStep(parseInt(stepHeader, 10))

      const assets = await assetsRes.json()

      // For each turbine, fetch queue-priority and impact in parallel
      const queuePromises = assets.map(async (asset) => {
        const tid = asset.turbine_id
        try {
          const [prioRes, impactRes] = await Promise.all([
            fetch(`${API_BASE}/assets/${tid}/queue-priority`),
            fetch(`${API_BASE}/assets/${tid}/impact`),
          ])

          const prioData = prioRes.ok ? await prioRes.json() : null
          const impactData = impactRes.ok ? await impactRes.json() : null

          return {
            turbine_id: tid,
            name: `Turbine ${tid}`,
            risk_level: asset.risk_level || (prioData && prioData.risk_level) || 'Low',
            priority_score: prioData ? prioData.priority_score : 0,
            anomaly_score: asset.anomaly_score ?? (prioData ? prioData.anomaly_score : 0),
            revenue_loss: impactData ? impactData.revenue_loss : (prioData ? prioData.estimated_revenue_loss : 0),
            hours_affected: impactData ? impactData.hours_affected : 0,
            status: asset.status || (prioData && prioData.status) || 'Running normally',
            why_flagged: asset.why_flagged || (prioData && prioData.why_flagged) || [],
            sensor_readings: asset.sensor_readings || {},
            last_updated: asset.last_updated || '—',
          }
        } catch {
          // Fallback if priority or impact fails
          return {
            turbine_id: tid,
            name: `Turbine ${tid}`,
            risk_level: asset.risk_level || 'Low',
            priority_score: 0,
            anomaly_score: asset.anomaly_score || 0,
            revenue_loss: 0,
            hours_affected: 0,
            status: asset.status || 'Running normally',
            why_flagged: asset.why_flagged || [],
            sensor_readings: asset.sensor_readings || {},
            last_updated: asset.last_updated || '—',
          }
        }
      })

      const detailedQueue = await Promise.all(queuePromises)

      // Sort by queue-priority: highest priority_score first
      detailedQueue.sort((a, b) => b.priority_score - a.priority_score)

      setQueue(detailedQueue)
      setLastSyncTime(new Date().toLocaleTimeString())
      setServerOnline(true)
      setLoadingQueue(false)

      // Auto-select top priority turbine initially if none selected
      setSelectedId((prev) => (prev !== null ? prev : detailedQueue[0]?.turbine_id ?? 1))
    } catch (err) {
      console.error('[TechnicianPanel] Queue fetch error:', err)
      setServerOnline(false)
      setLoadingQueue(false)
    }
  }

  // Poll every 2 seconds
  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 2000)
    return () => clearInterval(interval)
  }, [])

  /* ── 2. Detail View History: GET /assets/{id}/history?range=... ──────────── */
  const fetchHistory = async (turbineId, range) => {
    if (!turbineId) return
    setLoadingHistory(true)
    try {
      const res = await fetch(`${API_BASE}/assets/${turbineId}/history?range=${range}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // Format timestamp for display on x-axis
      const formatted = data.map((d) => {
        const dt = new Date(d.timestamp)
        const timeLabel = isNaN(dt.getTime())
          ? d.timestamp
          : dt.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) +
            ' ' +
            dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

        return {
          ...d,
          formattedTime: timeLabel,
        }
      })

      setHistoryData(formatted)
    } catch (err) {
      console.error('[TechnicianPanel] History fetch error:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Refetch history whenever selected turbine or range changes
  useEffect(() => {
    if (selectedId) {
      fetchHistory(selectedId, timeRange)
    }
  }, [selectedId, timeRange])

  // Periodic history refresh to reflect live simulation updates (every 4s)
  useEffect(() => {
    if (!selectedId) return
    const histInterval = setInterval(() => {
      fetchHistory(selectedId, timeRange)
    }, 4000)
    return () => clearInterval(histInterval)
  }, [selectedId, timeRange])

  // Selected turbine object from queue
  const selectedTurbine = useMemo(() => {
    return queue.find((t) => t.turbine_id === selectedId) || null
  }, [queue, selectedId])

  // Latest flagged features for the selected turbine:
  // Prefer the latest row in historyData if available, otherwise queue item
  const latestWhyFlagged = useMemo(() => {
    if (historyData.length > 0) {
      const lastRow = historyData[historyData.length - 1]
      if (lastRow.why_flagged && lastRow.why_flagged.length > 0) {
        return lastRow.why_flagged
      }
    }
    return selectedTurbine?.why_flagged || []
  }, [historyData, selectedTurbine])

  /* ── 3. Mark as Inspected Action ────────────────────────────────────────── */
  const handleMarkInspected = (turbineId) => {
    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const isCurrentlyInspected = !!inspectedMap[turbineId]

    setInspectedMap((prev) => ({
      ...prev,
      [turbineId]: !isCurrentlyInspected ? { time: timeStr, user: 'Field Specialist #4' } : null,
    }))

    if (!isCurrentlyInspected) {
      setInspectionToast({
        id: turbineId,
        message: `Turbine ${turbineId} logged as inspected at ${timeStr}. Status updated locally.`,
      })
    } else {
      setInspectionToast({
        id: turbineId,
        message: `Turbine ${turbineId} inspection status cleared.`,
      })
    }

    setTimeout(() => {
      setInspectionToast(null)
    }, 4000)
  }

  const toggleLine = (key) => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner">
            🔧
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">Technician Diagnostic Center</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                LIVE QUEUE
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Urgency-ordered maintenance pipeline, telemetry analysis, and automated baseline deviation attribution.
            </p>
          </div>
        </div>

        {/* Live sync readout & simulation badge */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300">
            <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span>Poll: 2s</span>
            {lastSyncTime && <span className="text-slate-500">| {lastSyncTime}</span>}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300">
            <span className="text-slate-500">Sim:</span>
            <span
              className={`font-bold ${
                simStatus === 'playing' ? 'text-cyan-400' : simStatus === 'paused' ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {simStatus.toUpperCase()}
            </span>
            {currentStep > 0 && <span className="text-slate-500 font-mono">#{currentStep}</span>}
          </div>
        </div>
      </div>

      {/* ── Inspection Feedback Toast ──────────────────────────────────────── */}
      {inspectionToast && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-sm flex items-center justify-between backdrop-blur-md shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">✅</span>
            <span className="font-medium">{inspectionToast.message}</span>
          </div>
          <button
            onClick={() => setInspectionToast(null)}
            className="text-emerald-400 hover:text-white px-2 py-0.5 text-xs font-mono uppercase tracking-wider cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main Layout: Split between Queue (Left) and Detail View (Right) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ==================================================================== */}
        {/* LEFT COLUMN: Maintenance Queue (4 cols)                             */}
        {/* ==================================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Maintenance Queue</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300">
                    {queue.length} Turbines
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sorted by <code className="text-amber-300">GET /assets/:id/queue-priority</code>
                </p>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Urgency ↓</span>
            </div>

            {loadingQueue && queue.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">Loading priority queue...</div>
            ) : queue.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">No assets reporting telemetry.</div>
            ) : (
              <div className="space-y-3">
                {queue.map((turbine, index) => {
                  const isSelected = turbine.turbine_id === selectedId
                  const r = getRisk(turbine.risk_level)
                  const isTopUrgent = index === 0 && turbine.risk_level !== 'Low'
                  const isInspected = !!inspectedMap[turbine.turbine_id]

                  return (
                    <div
                      key={turbine.turbine_id}
                      onClick={() => setSelectedId(turbine.turbine_id)}
                      className={`
                        group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer
                        ${isSelected ? `${r.border} bg-slate-800/80 ring-2 ${r.ring} shadow-lg` : 'border-slate-800 bg-slate-950/50 hover:bg-slate-800/40 hover:border-slate-700'}
                        ${isTopUrgent ? 'animate-pulse-subtle' : ''}
                      `}
                    >
                      {/* Priority Rank badge in top right */}
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center ${
                              index === 0
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            #{index + 1}
                          </span>
                          <div>
                            <h3 className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                              {turbine.name}
                              {isInspected && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  ✓ Inspected
                                </span>
                              )}
                            </h3>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Priority: {turbine.priority_score.toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Risk Level Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${r.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${r.dot} ${turbine.risk_level === 'Critical' ? 'animate-ping-slow' : ''}`} />
                          {turbine.risk_level}
                        </span>
                      </div>

                      {/* Revenue loss and anomaly score */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-500">Est. Revenue Loss: </span>
                          <span className={`font-mono font-bold ${turbine.revenue_loss > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                            ${turbine.revenue_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-slate-500">Anomaly: </span>
                          <span className="font-mono text-purple-300 font-semibold">
                            {turbine.anomaly_score.toFixed(3)}
                          </span>
                        </div>
                      </div>

                      {/* Status summary */}
                      <p className="mt-2 text-[11px] text-slate-400 line-clamp-1">
                        {turbine.status}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Queue Help info */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400 leading-relaxed space-y-1">
            <p className="font-semibold text-slate-300">💡 Field Dispatch Note:</p>
            <p>
              Queue dynamically escalates in real time as sensor wear increases. During simulation, watch Turbine 5
              climb to #1 as bearing degradation accelerates.
            </p>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* RIGHT COLUMN: Turbine Detail View & Diagnostic Charts (8 cols)      */}
        {/* ==================================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {selectedTurbine ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md shadow-xl space-y-6">
              {/* ── Detail Header: Turbine Info + Inspected Button + Range Selector */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold font-mono border ${
                      getRisk(selectedTurbine.risk_level).badge
                    }`}
                  >
                    T{selectedTurbine.turbine_id}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-white">{selectedTurbine.name} Telemetry & Diagnosis</h2>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                          getRisk(selectedTurbine.risk_level).badge
                        }`}
                      >
                        {selectedTurbine.risk_level}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Priority Score: {selectedTurbine.priority_score.toFixed(1)} | Last Reading:{' '}
                      {selectedTurbine.last_updated}
                    </p>
                  </div>
                </div>

                {/* Range Selector & Action Buttons */}
                <div className="flex items-center gap-3">
                  {/* Range Selector (24h / 7d / 30d) */}
                  <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                    {['24h', '7d', '30d'].map((rng) => (
                      <button
                        key={rng}
                        onClick={() => setTimeRange(rng)}
                        className={`
                          px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer
                          ${timeRange === rng ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}
                        `}
                      >
                        {rng}
                      </button>
                    ))}
                  </div>

                  {/* Mark as Inspected Button */}
                  <button
                    onClick={() => handleMarkInspected(selectedTurbine.turbine_id)}
                    className={`
                      px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md
                      ${
                        inspectedMap[selectedTurbine.turbine_id]
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      }
                    `}
                  >
                    <span>{inspectedMap[selectedTurbine.turbine_id] ? '✓' : '🛠'}</span>
                    <span>
                      {inspectedMap[selectedTurbine.turbine_id]
                        ? `Inspected (${inspectedMap[selectedTurbine.turbine_id].time})`
                        : 'Mark as inspected'}
                    </span>
                  </button>
                </div>
              </div>

              {/* ── "Why Flagged" Section ──────────────────────────────────── */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  selectedTurbine.risk_level === 'Low'
                    ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                    : selectedTurbine.risk_level === 'Critical'
                    ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                    : 'bg-amber-950/25 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">
                    {selectedTurbine.risk_level === 'Critical'
                      ? '🚨'
                      : selectedTurbine.risk_level === 'High'
                      ? '⚠️'
                      : selectedTurbine.risk_level === 'Medium'
                      ? '⚡'
                      : '✅'}
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Root Cause Attribution & Why Flagged
                    </p>
                    <p className="text-sm font-semibold tracking-wide font-mono">
                      {formatWhyFlagged(latestWhyFlagged)}
                    </p>
                    {latestWhyFlagged && latestWhyFlagged.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        {latestWhyFlagged.map((item, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900/80 border border-slate-700 text-slate-300"
                          >
                            <span className="font-bold text-white">{item.feature}:</span>
                            <span className={item.z_score >= 0 ? 'text-amber-400' : 'text-cyan-400'}>
                              {item.z_score > 0 ? `+${item.z_score.toFixed(1)}` : item.z_score.toFixed(1)}σ
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Sensor Metric Badges (Latest Values) ───────────────────── */}
              {selectedTurbine.sensor_readings && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
                    <div className="text-[11px] text-slate-400">Bearing Vibration</div>
                    <div className="text-base font-mono font-bold text-rose-400">
                      {selectedTurbine.sensor_readings.bearing_vibration?.toFixed(3) ?? '—'}{' '}
                      <span className="text-xs text-slate-500 font-normal">mm/s</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
                    <div className="text-[11px] text-slate-400">Gearbox Temperature</div>
                    <div className="text-base font-mono font-bold text-amber-400">
                      {selectedTurbine.sensor_readings.gearbox_temp?.toFixed(1) ?? '—'}{' '}
                      <span className="text-xs text-slate-500 font-normal">°C</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
                    <div className="text-[11px] text-slate-400">Power Output</div>
                    <div className="text-base font-mono font-bold text-cyan-400">
                      {selectedTurbine.sensor_readings.power_output?.toFixed(0) ?? '—'}{' '}
                      <span className="text-xs text-slate-500 font-normal">kW</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Chart 1: Multi-line Time Series (Vibration, Temp, Power) ── */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Sensor Telemetry Trend</span>
                      <span className="text-xs font-mono font-normal text-slate-400">
                        ({historyData.length} data points)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bearing Vibration (mm/s), Gearbox Temp (°C), and Power Output (kW)
                    </p>
                  </div>

                  {/* Interactive line visibility toggles */}
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <button
                      onClick={() => toggleLine('bearing_vibration')}
                      className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        visibleLines.bearing_vibration
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                      }`}
                    >
                      ● Vibration
                    </button>
                    <button
                      onClick={() => toggleLine('gearbox_temp')}
                      className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        visibleLines.gearbox_temp
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                      }`}
                    >
                      ● Temp
                    </button>
                    <button
                      onClick={() => toggleLine('power_output')}
                      className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        visibleLines.power_output
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                      }`}
                    >
                      ● Power
                    </button>
                  </div>
                </div>

                <div className="h-72 w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 relative">
                  {loadingHistory && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-20 rounded-xl">
                      <span className="text-xs font-mono text-slate-400 animate-pulse">Loading sensor history...</span>
                    </div>
                  )}

                  {historyData.length === 0 && !loadingHistory ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      No historical telemetry recorded yet. Start simulation replay to stream data.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={historyData}
                        syncId="technicianSync"
                        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="formattedTime"
                          stroke="#64748b"
                          fontSize={10}
                          tickLine={false}
                          minTickGap={40}
                        />
                        {/* Left Y Axis 1: Bearing Vibration (mm/s) */}
                        <YAxis
                          yAxisId="vib"
                          orientation="left"
                          stroke="#f43f5e"
                          fontSize={10}
                          domain={[0, 'auto']}
                          tickFormatter={(v) => `${v.toFixed(1)}`}
                          width={36}
                        />
                        {/* Right Y Axis: Power Output (kW) */}
                        <YAxis
                          yAxisId="power"
                          orientation="right"
                          stroke="#06b6d4"
                          fontSize={10}
                          domain={[0, 2200]}
                          tickFormatter={(v) => `${v}`}
                          width={48}
                        />
                        {/* Additional hidden scale for Temp (°C) sharing left side range [30, 110] */}
                        <YAxis
                          yAxisId="temp"
                          orientation="left"
                          hide
                          domain={[30, 110]}
                        />

                        <Tooltip content={<CustomSensorTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />

                        {visibleLines.bearing_vibration && (
                          <Line
                            yAxisId="vib"
                            type="monotone"
                            dataKey="bearing_vibration"
                            name="Vibration (mm/s)"
                            stroke="#f43f5e"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        )}

                        {visibleLines.gearbox_temp && (
                          <Line
                            yAxisId="temp"
                            type="monotone"
                            dataKey="gearbox_temp"
                            name="Gearbox Temp (°C)"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        )}

                        {visibleLines.power_output && (
                          <Line
                            yAxisId="power"
                            type="monotone"
                            dataKey="power_output"
                            name="Power Output (kW)"
                            stroke="#06b6d4"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* ── Chart 2: Aligned Anomaly Score Chart ───────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Anomaly Score Escalation</span>
                      <span className="text-xs font-mono font-normal text-purple-400">IsolationForest</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Synchronized x-axis directly connects mechanical deviation to ML risk escalation
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-amber-500 inline-block" /> Med: 0.56
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-orange-500 inline-block" /> High: 0.63
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-rose-500 inline-block" /> Crit: 0.70
                    </span>
                  </div>
                </div>

                <div className="h-44 w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 relative">
                  {historyData.length === 0 && !loadingHistory ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      No anomaly scores calculated yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={historyData}
                        syncId="technicianSync"
                        margin={{ top: 5, right: 30, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="formattedTime"
                          stroke="#64748b"
                          fontSize={10}
                          tickLine={false}
                          minTickGap={40}
                        />
                        <YAxis
                          stroke="#a855f7"
                          fontSize={10}
                          domain={[0.3, 0.8]}
                          tickFormatter={(v) => v.toFixed(2)}
                          width={36}
                        />

                        {/* Reference lines for risk thresholds */}
                        <ReferenceLine y={0.56} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.6} />
                        <ReferenceLine y={0.63} stroke="#f97316" strokeDasharray="3 3" opacity={0.6} />
                        <ReferenceLine y={0.70} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.6} />

                        <Tooltip content={<CustomScoreTooltip />} />

                        <Line
                          type="monotone"
                          dataKey="anomaly_score"
                          name="Anomaly Score"
                          stroke="#c084fc"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              Select a turbine from the maintenance queue to view real-time diagnostics and telemetry charts.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
