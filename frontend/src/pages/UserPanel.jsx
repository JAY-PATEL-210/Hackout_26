import React, { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://127.0.0.1:8000'

/* ── Risk-level colour mapping ───────────────────────────────────────────── */
const RISK_COLORS = {
  Low: {
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    glow: 'shadow-emerald-500/10',
    dot: 'bg-emerald-400',
    accent: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    gradient: 'from-emerald-500/10 to-transparent',
  },
  Medium: {
    bg: 'bg-amber-950/20',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    glow: 'shadow-amber-500/10',
    dot: 'bg-amber-400',
    accent: 'text-amber-400',
    ring: 'ring-amber-500/20',
    gradient: 'from-amber-500/10 to-transparent',
  },
  High: {
    bg: 'bg-orange-950/25',
    border: 'border-orange-500/50',
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    glow: 'shadow-orange-500/15',
    dot: 'bg-orange-400',
    accent: 'text-orange-400',
    ring: 'ring-orange-500/25',
    gradient: 'from-orange-500/10 to-transparent',
  },
  Critical: {
    bg: 'bg-rose-950/30',
    border: 'border-rose-500/60',
    badge: 'bg-rose-500/25 text-rose-400 border-rose-500/50',
    glow: 'shadow-rose-500/20',
    dot: 'bg-rose-400',
    accent: 'text-rose-400',
    ring: 'ring-rose-500/30',
    gradient: 'from-rose-500/10 to-transparent',
  },
}

const FALLBACK = RISK_COLORS.Low

function riskColors(level) {
  return RISK_COLORS[level] || FALLBACK
}

/* ── Wind turbine SVG icon ───────────────────────────────────────────────── */
function TurbineIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Tower */}
      <line x1="12" y1="12" x2="11" y2="22" />
      <line x1="12" y1="12" x2="13" y2="22" />
      {/* Hub */}
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      {/* Blade 1 – up */}
      <path d="M12 12 L11.2 3.5 Q12 2.5 12.8 3.5 Z" fill="currentColor" opacity="0.85" />
      {/* Blade 2 – lower-right */}
      <path d="M12 12 L19 17.2 Q19.2 18.3 18 17.8 Z" fill="currentColor" opacity="0.85" />
      {/* Blade 3 – lower-left */}
      <path d="M12 12 L5 17.2 Q4.8 18.3 6 17.8 Z" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

/* ── Turbine Card component ──────────────────────────────────────────────── */
function TurbineCard({ asset, onClick }) {
  const c = riskColors(asset.risk_level)
  const isCritical = asset.risk_level === 'Critical'

  return (
    <button
      type="button"
      onClick={() => onClick(asset)}
      className={`
        group relative text-left w-full
        rounded-2xl border ${c.border} ${c.bg}
        p-5 sm:p-6
        backdrop-blur-sm
        shadow-lg ${c.glow}
        ring-1 ${c.ring}
        transition-all duration-300 ease-out
        hover:scale-[1.025] hover:shadow-xl
        hover:ring-2 hover:brightness-110
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
        cursor-pointer
        ${isCritical ? 'animate-pulse-subtle' : ''}
      `}
    >
      {/* Gradient accent strip at top */}
      <div
        className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${c.gradient}`}
      />

      {/* Header: icon + name + badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg} border ${c.border}`}
          >
            <TurbineIcon className={`w-5 h-5 ${c.accent}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight leading-tight">
              Turbine {asset.turbine_id}
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              ID-{String(asset.turbine_id).padStart(3, '0')}
            </span>
          </div>
        </div>

        {/* Risk badge */}
        <span
          className={`
            inline-flex items-center gap-1.5
            px-2.5 py-1 rounded-full
            text-[11px] font-bold uppercase tracking-wider
            border ${c.badge}
            transition-colors duration-300
          `}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${isCritical ? 'animate-ping-slow' : ''}`} />
          {asset.risk_level}
        </span>
      </div>

      {/* Status string – from backend */}
      <p className="text-sm text-slate-300 leading-relaxed min-h-[2.5rem]">
        {asset.status}
      </p>

      {/* Bottom timestamp */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-mono">
          {asset.last_updated || '—'}
        </span>
        <span
          className="text-[10px] text-slate-500 group-hover:text-cyan-400 transition-colors flex items-center gap-1"
        >
          Details
          <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </button>
  )
}

/* ── Detail Panel (slide-out) ────────────────────────────────────────────── */
function TurbineDetailPanel({ asset, onClose }) {
  if (!asset) return null
  const c = riskColors(asset.risk_level)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-slate-900/95 border-l border-slate-700 shadow-2xl animate-slideInRight overflow-y-auto">
        {/* Header */}
        <div className={`p-6 border-b border-slate-800 ${c.bg}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.bg} border ${c.border}`}>
                <TurbineIcon className={`w-6 h-6 ${c.accent}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Turbine {asset.turbine_id}
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  ID-{String(asset.turbine_id).padStart(3, '0')}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${c.badge}`}
          >
            <span className={`w-2 h-2 rounded-full ${c.dot}`} />
            {asset.risk_level} Risk
          </span>
        </div>

        {/* Status section */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Current Status
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/50 rounded-xl p-4 border border-slate-800">
              {asset.status}
            </p>
          </div>

          {/* Key metrics */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Key Readings
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Anomaly Score',
                  value: asset.anomaly_score?.toFixed(3) ?? '—',
                  accent: c.accent,
                },
                {
                  label: 'Wind Speed',
                  value: `${asset.sensor_readings?.wind_speed?.toFixed(1) ?? '—'} m/s`,
                  accent: 'text-cyan-400',
                },
                {
                  label: 'Power Output',
                  value: `${asset.sensor_readings?.power_output?.toFixed(0) ?? '—'} kW`,
                  accent: 'text-sky-400',
                },
                {
                  label: 'Gearbox Temp',
                  value: `${asset.sensor_readings?.gearbox_temp?.toFixed(1) ?? '—'} °C`,
                  accent:
                    asset.sensor_readings?.gearbox_temp > 75
                      ? 'text-rose-400'
                      : 'text-slate-300',
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="bg-slate-950/60 rounded-xl p-3 border border-slate-800"
                >
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    {metric.label}
                  </span>
                  <span className={`text-lg font-mono font-bold ${metric.accent}`}>
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Last updated */}
          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 font-mono">
            Last updated: {asset.last_updated || '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Fleet summary bar ───────────────────────────────────────────────────── */
function FleetSummaryBar({ assets }) {
  const counts = { Low: 0, Medium: 0, High: 0, Critical: 0 }
  assets.forEach((a) => {
    counts[a.risk_level] = (counts[a.risk_level] || 0) + 1
  })

  const pills = [
    { level: 'Low', label: 'Healthy', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    { level: 'Medium', label: 'Warning', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    { level: 'High', label: 'High Risk', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    { level: 'Critical', label: 'Critical', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pills.map((p) => (
        <span
          key={p.level}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${p.color}`}
        >
          <span className="font-mono font-bold">{counts[p.level]}</span>
          {p.label}
        </span>
      ))}
    </div>
  )
}

/* ── Main UserPanel ──────────────────────────────────────────────────────── */
export default function UserPanel() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(true)
  const [lastPoll, setLastPoll] = useState(null)
  const [selectedAsset, setSelectedAsset] = useState(null)

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/assets`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAssets(data)
      setApiOnline(true)
      setLastPoll(new Date())
    } catch (err) {
      console.error('Failed to poll /assets:', err)
      setApiOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll every 2 seconds
  useEffect(() => {
    fetchAssets()
    const timer = setInterval(fetchAssets, 2000)
    return () => clearInterval(timer)
  }, [fetchAssets])

  // Keep detail panel updated with latest data if open
  useEffect(() => {
    if (selectedAsset) {
      const updated = assets.find((a) => a.turbine_id === selectedAsset.turbine_id)
      if (updated) setSelectedAsset(updated)
    }
  }, [assets])

  const hasAlerts = assets.some(
    (a) => a.risk_level === 'High' || a.risk_level === 'Critical'
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 via-cyan-500 to-emerald-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/30">
              👥
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Fleet Overview
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${hasAlerts
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${hasAlerts ? 'bg-rose-400' : 'bg-emerald-400'
                      }`}
                  />
                  {hasAlerts ? 'Alerts Active' : 'All Normal'}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Operator dashboard — live fleet health at a glance.
              </p>
            </div>
          </div>

          {/* API status + poll indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800 text-xs">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${apiOnline ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${apiOnline ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                />
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {apiOnline ? 'Live' : 'Offline'} • 2s poll
              </span>
            </div>
          </div>
        </div>

        {/* Fleet summary pills */}
        {assets.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800/60">
            <FleetSummaryBar assets={assets} />
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && assets.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm font-medium">Connecting to SCADA backend…</span>
          </div>
        </div>
      )}

      {/* Inline Offline/Error Banner */}
      {!apiOnline && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 backdrop-blur-sm shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>
              Backend API temporarily unreachable on port 8000. Reconnecting automatically every 2s...
            </span>
          </div>
          <button
            type="button"
            onClick={fetchAssets}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition shrink-0 cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Offline empty warning */}
      {!apiOnline && assets.length === 0 && !loading && (
        <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-center">
          <p className="text-rose-300 text-sm font-medium">
            Unable to reach backend on port 8000. Start the API server and run a simulation.
          </p>
        </div>
      )}

      {/* Turbine Card Grid */}
      {assets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <TurbineCard
              key={asset.turbine_id}
              asset={asset}
              onClick={setSelectedAsset}
            />
          ))}
        </div>
      )}

      {/* Last polled timestamp */}
      {lastPoll && (
        <div className="text-center">
          <span className="text-[10px] text-slate-600 font-mono">
            Last polled: {lastPoll.toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Detail panel overlay */}
      {selectedAsset && (
        <TurbineDetailPanel
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  )
}
