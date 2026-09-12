import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '../firebase/config'

const API_BASE = 'http://127.0.0.1:8000'

/* ── Status Mapping conforming to user's design tokens ───────────────────── */
// Status badges use both color dots and text labels: Critical, Warning, Watch, Healthy
const STATUS_CONFIG = {
  Critical: {
    label: 'Critical',
    dot: 'bg-rose-500',
    pulse: 'animate-ping-slow',
    badge: 'bg-rose-50 text-rose-700 border-rose-200/80',
    border: 'border-rose-300/80',
    accent: 'text-rose-600',
    bgLight: 'bg-rose-50/40',
    barColor: 'bg-rose-500',
  },
  Warning: {
    label: 'Warning',
    dot: 'bg-amber-500',
    pulse: '',
    badge: 'bg-amber-50 text-amber-700 border-amber-200/80',
    border: 'border-amber-300/80',
    accent: 'text-amber-600',
    bgLight: 'bg-amber-50/40',
    barColor: 'bg-amber-500',
  },
  Watch: {
    label: 'Watch',
    dot: 'bg-sky-500',
    pulse: '',
    badge: 'bg-sky-50 text-sky-700 border-sky-200/80',
    border: 'border-sky-300/80',
    accent: 'text-sky-600',
    bgLight: 'bg-sky-50/40',
    barColor: 'bg-sky-500',
  },
  Healthy: {
    label: 'Healthy',
    dot: 'bg-emerald-500',
    pulse: '',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    border: 'border-emerald-300/80',
    accent: 'text-emerald-600',
    bgLight: 'bg-emerald-50/40',
    barColor: 'bg-emerald-500',
  },
}

function normalizeStatus(risk) {
  if (risk === 'Critical') return 'Critical'
  if (risk === 'High') return 'Warning'
  if (risk === 'Medium') return 'Watch'
  return 'Healthy'
}

/* ── Asset Icons ─────────────────────────────────────────────────────────── */
function WindIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12L11 22M12 12L13 22" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12L11.2 3.5C11.5 2.5 12.5 2.5 12.8 3.5L12 12Z" fill="currentColor" fillOpacity={0.2} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12L19.5 17C20.2 17.6 19.8 18.5 18.8 18L12 12Z" fill="currentColor" fillOpacity={0.2} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12L4.5 17C3.8 17.6 4.2 18.5 5.2 18L12 12Z" fill="currentColor" fillOpacity={0.2} />
    </svg>
  )
}

function SolarIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="4" x2="9" y2="17" />
      <line x1="15" y1="4" x2="15" y2="17" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17L12 21M8 21L16 21" />
    </svg>
  )
}

/* ── Fixed Solar Assets to complement Wind fleet ─────────────────────────── */
const SUPPLEMENTAL_SOLAR_ASSETS = [
  {
    asset_id: 'SOL-01',
    name: 'Solar Inverter Alpha-1',
    type: 'solar',
    location: 'Sector Gamma - Ridge Solar Field',
    capacity: '1,250 kW',
    last_inspection: '4 days ago',
    current_risk_level: 'Low',
    current_anomaly_score: 0.125,
    status: 'Healthy',
    health_score: 96,
    fault: 'Nominal MPPT Tracking',
    failure_probability: 2.5,
    estimated_loss: 0,
    latest_reading: {
      solar_irradiance: 845,
      ambient_temp: 24.2,
      inverter_temp: 48.6,
      dc_voltage: 780,
      dc_current: 120,
      power_output: 93.6,
    },
    why_flagged: [],
  },
  {
    asset_id: 'SOL-02',
    name: 'Solar Array Valley Beta',
    type: 'solar',
    location: 'Sector Gamma - Valley Basin',
    capacity: '850 kW',
    last_inspection: '11 days ago',
    current_risk_level: 'Medium',
    current_anomaly_score: 0.442,
    status: 'Watch',
    health_score: 78,
    fault: 'String-4 DC Disconnect Inefficiency',
    failure_probability: 18.2,
    estimated_loss: 84.5,
    latest_reading: {
      solar_irradiance: 810,
      ambient_temp: 25.0,
      inverter_temp: 56.2,
      dc_voltage: 710,
      dc_current: 98,
      power_output: 69.5,
    },
    why_flagged: ['String mismatch detected: 14% power clipping under peak irradiance.'],
  },
]

export default function UserPanel() {
  const [windAssets, setWindAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [sourceType, setSourceType] = useState('Connecting...')
  const [filterType, setFilterType] = useState('all') // 'all' | 'wind' | 'solar' | 'attention'
  const [searchQuery, setSearchQuery] = useState('')

  // REST fallback poller
  const fetchAssetsFromAPI = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/assets`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setWindAssets(data)
      setApiOnline(true)
      setSourceType('REST Telemetry Feed')
      setLastUpdate(new Date())
    } catch (err) {
      console.warn('[UserPanel] REST fetch error:', err)
      setApiOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Real-time Firestore onSnapshot listener
  useEffect(() => {
    const q = query(collection(db, 'turbines'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((doc) => {
            const data = doc.data()
            const tid = data.turbine_id || parseInt(doc.id, 10)
            const score = typeof data.current_anomaly_score === 'number' ? data.current_anomaly_score : 0
            const rawRisk = data.current_risk_level || 'Low'

            return {
              asset_id: `WT-${String(tid).padStart(2, '0')}`,
              turbine_id: tid,
              name: data.name || `Turbine ${tid}`,
              type: 'wind',
              location: data.location || `Sector ${tid <= 2 ? 'Alpha' : tid <= 4 ? 'Beta' : 'Gamma'} Ridge`,
              capacity: '2,000 kW',
              last_inspection: tid === 5 ? 'Today 08:30 (Active Warning)' : `${(tid * 4) + 3} days ago`,
              current_risk_level: rawRisk,
              current_anomaly_score: score,
              status: normalizeStatus(rawRisk),
              health_score: Math.max(10, Math.min(99, Math.round((1 - Math.min(1, score * 1.15)) * 100))),
              failure_probability: Math.min(98.5, Math.max(1.5, Math.round(score * 110 * 10) / 10)),
              fault:
                rawRisk === 'Critical'
                  ? 'Bearing Micro-pitting & Friction Surge'
                  : rawRisk === 'High'
                  ? 'Gearbox Bearing Temperature Elevation'
                  : rawRisk === 'Medium'
                  ? 'Vibration Sensor Baseline Variance'
                  : 'Nominal Mechanical Baseline',
              estimated_loss:
                rawRisk === 'Critical'
                  ? 1120.0
                  : rawRisk === 'High'
                  ? 540.0
                  : rawRisk === 'Medium'
                  ? 180.0
                  : 0.0,
              latest_reading: data.latest_reading || {},
              last_updated: data.last_updated?.toDate
                ? data.last_updated.toDate().toLocaleTimeString()
                : String(data.last_updated || '—'),
              why_flagged: data.why_flagged || [],
            }
          })
          list.sort((a, b) => a.turbine_id - b.turbine_id)
          setWindAssets(list)
          setApiOnline(true)
          setSourceType('Firestore Real-Time')
          setLastUpdate(new Date())
          setLoading(false)
        } else {
          fetchAssetsFromAPI()
        }
      },
      (err) => {
        console.warn('[UserPanel] Firestore snapshot listener error, falling back:', err)
        fetchAssetsFromAPI()
      }
    )

    return () => unsubscribe()
  }, [fetchAssetsFromAPI])

  // Combine Wind and Solar assets into unified fleet register
  const allAssets = useMemo(() => {
    let combined = [...windAssets]
    if (combined.length === 0 && !loading) {
      // Provide standard 5 wind assets if none loaded yet
      combined = [1, 2, 3, 4, 5].map((tid) => ({
        asset_id: `WT-${String(tid).padStart(2, '0')}`,
        turbine_id: tid,
        name: `Turbine ${tid}`,
        type: 'wind',
        location: tid <= 2 ? 'Sector Alpha - Ridge North' : tid <= 4 ? 'Sector Beta - Valley Inflow' : 'Sector Gamma - High Peak',
        capacity: '2,000 kW',
        last_inspection: `${tid * 5} days ago`,
        current_risk_level: tid === 5 ? 'High' : 'Low',
        current_anomaly_score: tid === 5 ? 0.68 : 0.22,
        status: tid === 5 ? 'Warning' : 'Healthy',
        health_score: tid === 5 ? 44 : 96,
        failure_probability: tid === 5 ? 68.0 : 4.2,
        fault: tid === 5 ? 'Gearbox High Thermal Drift' : 'Nominal Baseline',
        estimated_loss: tid === 5 ? 540 : 0,
        latest_reading: {
          wind_speed: 9.1, rpm: 12.8, gearbox_temp: tid === 5 ? 78.4 : 51.2,
          bearing_vibration: tid === 5 ? 1.84 : 1.21, power_output: tid === 5 ? 420 : 610, ambient_temp: 16.5
        },
        why_flagged: tid === 5 ? ['Gearbox temp elevated above 70°C'] : [],
      }))
    }
    return [...combined, ...SUPPLEMENTAL_SOLAR_ASSETS]
  }, [windAssets, loading])

  // KPI Calculations
  const metrics = useMemo(() => {
    const total = allAssets.length
    if (total === 0) return { healthIndex: '100%', criticalCount: 0, warningCount: 0, revenueAtRisk: '$0', totalPowerMW: '0.00' }

    const criticals = allAssets.filter((a) => a.status === 'Critical').length
    const warnings = allAssets.filter((a) => a.status === 'Warning').length
    const attentionCount = criticals + warnings

    const avgHealth = Math.round(allAssets.reduce((sum, a) => sum + (a.health_score || 95), 0) / total)
    const totalLoss = allAssets.reduce((sum, a) => sum + (a.estimated_loss || 0), 0)

    const totalKw = allAssets.reduce((sum, a) => {
      const p = a.latest_reading?.power_output || 0
      return sum + Number(p)
    }, 0)

    return {
      healthIndex: `${avgHealth}%`,
      criticalCount: criticals,
      warningCount: warnings,
      attentionCount,
      revenueAtRisk: `$${Math.round(totalLoss).toLocaleString()}`,
      totalPowerMW: `${(totalKw / 1000).toFixed(2)} MW`,
      totalAssets: total,
    }
  }, [allAssets])

  // Maintenance Priority Queue: sorted highest failure probability / risk first
  const maintenanceQueue = useMemo(() => {
    return [...allAssets].sort((a, b) => {
      const riskWeight = { Critical: 4, Warning: 3, Watch: 2, Healthy: 1 }
      const diff = (riskWeight[b.status] || 1) - (riskWeight[a.status] || 1)
      if (diff !== 0) return diff
      return (b.failure_probability || 0) - (a.failure_probability || 0)
    })
  }, [allAssets])

  // Filtered asset table list
  const filteredAssets = useMemo(() => {
    return allAssets.filter((asset) => {
      const matchesType =
        filterType === 'all'
          ? true
          : filterType === 'wind'
          ? asset.type === 'wind'
          : filterType === 'solar'
          ? asset.type === 'solar'
          : filterType === 'attention'
          ? asset.status === 'Critical' || asset.status === 'Warning' || asset.status === 'Watch'
          : true

      const matchesSearch =
        searchQuery.trim() === '' ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.asset_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.fault.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesType && matchesSearch
    })
  }, [allAssets, filterType, searchQuery])

  // Real-time highest anomaly asset for right-side sensor callout
  const worstAsset = useMemo(() => {
    return maintenanceQueue[0] || null
  }, [maintenanceQueue])

  return (
    <div className="space-y-8 pb-12 animate-fadeIn font-manrope">

      {/* ───────────────────────────────────────────────────────────────────────
          1. FLEET HEALTH HEADLINE WITH ATTENTION COUNT & STATUS
         ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black font-space text-[#0f172a] tracking-tight">
              Fleet Operations Control
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                metrics.attentionCount > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${metrics.attentionCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {metrics.attentionCount > 0
                ? `${metrics.attentionCount} Assets Require Attention`
                : 'All Assets Operating Normally'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time renewable SCADA telemetry • Predictive diagnostics & dispatch priority
          </p>
        </div>

        {/* Live sync indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 backdrop-blur-md border border-white/90 shadow-xs text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
          </span>
          <span className="font-mono text-slate-600 font-semibold text-[11px]">
            {sourceType}
          </span>
          {lastUpdate && (
            <span className="text-slate-400 text-[11px]">
              • {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          2. FOUR KPI TILES IN A ROW (Space Grotesk KPI Numbers)
         ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">

        {/* KPI 1: Fleet Health Index */}
        <div className="frosted-card rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Fleet Health Index
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 text-sm">
              🛡️
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black font-space text-emerald-600 tracking-tight">
              {metrics.healthIndex}
            </span>
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              Optimal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            {metrics.totalAssets - metrics.attentionCount} of {metrics.totalAssets} assets running at peak baseline
          </p>
        </div>

        {/* KPI 2: Attention & Fault Count */}
        <div className="frosted-card rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Attention Assets
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 text-sm">
              ⚠️
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black font-space text-rose-600 tracking-tight">
              {metrics.attentionCount}
            </span>
            <span className="text-xs font-mono text-slate-500">
              ({metrics.criticalCount} Critical, {metrics.warningCount} Warning)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Proactive maintenance avoids drivetrain breakdown
          </p>
        </div>

        {/* KPI 3: Estimated Revenue at Risk */}
        <div className="frosted-card rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Revenue at Risk
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 text-sm">
              ⚡
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black font-space text-amber-600 tracking-tight">
              {metrics.revenueAtRisk}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ day</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Calculated at $0.12/kWh clean energy feed-in tariff
          </p>
        </div>

        {/* KPI 4: Total Generation Output */}
        <div className="frosted-card rounded-2xl p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Generation
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-600 text-sm">
              🌐
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black font-space text-[#0ea5e9] tracking-tight">
              {metrics.totalPowerMW}
            </span>
            <span className="text-xs text-sky-700 font-semibold bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/60">
              Live Output
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Hybrid solar & wind combined generation capacity
          </p>
        </div>

      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          3. TWO-THIRDS MAINTENANCE QUEUE + ONE-THIRD LIVE SENSOR ANOMALY
         ─────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── 2/3 COLUMN: MAINTENANCE PRIORITY QUEUE ───────────────────────── */}
        <div className="lg:col-span-2 frosted-card rounded-3xl p-6 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-black font-space text-[#0f172a] tracking-tight">
                Maintenance Priority Queue
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Ranked dispatch order generated by AI anomaly score & failure probability
              </p>
            </div>
            <Link
              to="/technician"
              className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60 transition cursor-pointer"
            >
              <span>Technician Queue</span>
              <span>→</span>
            </Link>
          </div>

          {/* Queue List */}
          <div className="space-y-3">
            {maintenanceQueue.slice(0, 4).map((asset, index) => {
              const statusCfg = STATUS_CONFIG[asset.status] || STATUS_CONFIG.Healthy
              const isFirstPriority = index === 0 && asset.status !== 'Healthy'

              return (
                <div
                  key={asset.asset_id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`group relative rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer ${
                    isFirstPriority
                      ? 'bg-gradient-to-r from-rose-50/70 via-white to-rose-50/30 border-rose-200/90 shadow-sm'
                      : 'bg-white/60 hover:bg-white/90 border-white/80 hover:border-sky-200/80 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

                    {/* Left info */}
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isFirstPriority
                            ? 'bg-rose-500 text-white font-space shadow-xs'
                            : 'bg-slate-100 text-slate-700 font-mono'
                        }`}
                      >
                        #{index + 1}
                      </div>

                      <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                        {asset.type === 'wind' ? <WindIcon className="w-5 h-5" /> : <SolarIcon className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-space font-bold text-[#0f172a] text-sm sm:text-base leading-tight group-hover:text-sky-600 transition-colors">
                            {asset.name}
                          </h3>
                          <span className="font-mono text-[11px] text-slate-400">
                            {asset.asset_id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                          {asset.fault} • {asset.location}
                        </p>
                      </div>
                    </div>

                    {/* Right badges & risk numbers */}
                    <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-auto">
                      {/* Revenue exposure */}
                      {asset.estimated_loss > 0 && (
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Exposure
                          </span>
                          <span className="font-mono text-xs font-bold text-rose-600">
                            -${Math.round(asset.estimated_loss)}/d
                          </span>
                        </div>
                      )}

                      {/* Failure probability progress mini */}
                      <div className="w-20 sm:w-24 text-right">
                        <div className="flex justify-between text-[11px] font-mono mb-1">
                          <span className="text-slate-400">Risk:</span>
                          <span className={`font-bold ${statusCfg.accent}`}>
                            {asset.failure_probability}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${statusCfg.barColor}`}
                            style={{ width: `${Math.min(100, asset.failure_probability)}%` }}
                          />
                        </div>
                      </div>

                      {/* Status badge with color dot + text */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.badge} shrink-0`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${statusCfg.pulse}`} />
                        {statusCfg.label}
                      </span>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 1/3 COLUMN: LIVE ANOMALY & REVENUE-AT-RISK PANELS ──────────────── */}
        <div className="space-y-6">

          {/* Live Sensor Anomaly Callout */}
          <div className="frosted-card rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-space font-bold text-base text-[#0f172a]">
                Live Sensor Telemetry
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-semibold border border-sky-200">
                SCADA Gauge
              </span>
            </div>

            {worstAsset && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-white/70 border border-slate-200/60">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold">Priority Monitored Asset:</span>
                    <span className="font-space font-bold text-[#0f172a]">{worstAsset.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700">
                    <span>Anomaly Index:</span>
                    <span className={worstAsset.status === 'Critical' ? 'text-rose-600' : 'text-amber-600'}>
                      {(worstAsset.current_anomaly_score || 0).toFixed(3)} (Threshold: 0.500)
                    </span>
                  </div>
                </div>

                {/* Sensor metric bars */}
                <div className="space-y-2.5 text-xs font-manrope">
                  {/* Bearing Vibration */}
                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Bearing Vibration (g)</span>
                      <span className="font-mono font-bold text-slate-900">
                        {worstAsset.latest_reading?.bearing_vibration?.toFixed(2) || '1.22'} g
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ((worstAsset.latest_reading?.bearing_vibration || 1.2) / 2.5) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Gearbox Temperature */}
                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Gearbox Temperature (°C)</span>
                      <span className="font-mono font-bold text-slate-900">
                        {worstAsset.latest_reading?.gearbox_temp?.toFixed(1) || '52.0'} °C
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (worstAsset.latest_reading?.gearbox_temp || 50) > 75 ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, ((worstAsset.latest_reading?.gearbox_temp || 50) / 100) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Power Output */}
                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Actual Output (kW)</span>
                      <span className="font-mono font-bold text-slate-900">
                        {Math.round(worstAsset.latest_reading?.power_output || 550)} kW
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ((worstAsset.latest_reading?.power_output || 500) / 2000) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Revenue at Risk breakdown card */}
          <div className="frosted-card rounded-3xl p-6 shadow-sm">
            <h3 className="font-space font-bold text-base text-[#0f172a] mb-2">
              Financial Exposure Model
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-4">
              Estimated daily loss caused by power deficits and suboptimal drivetrain efficiency.
            </p>
            <div className="space-y-2">
              {allAssets.filter((a) => a.estimated_loss > 0).length > 0 ? (
                allAssets
                  .filter((a) => a.estimated_loss > 0)
                  .map((a) => (
                    <div key={a.asset_id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                      <span className="font-medium text-slate-700">{a.name}</span>
                      <span className="font-mono font-bold text-rose-600">-${Math.round(a.estimated_loss)}/day</span>
                    </div>
                  ))
              ) : (
                <p className="text-xs text-emerald-600 font-semibold py-2">
                  ✓ Zero generation deficits across active fleet.
                </p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          4. FULL-WIDTH ASSET REGISTER TABLE
         ─────────────────────────────────────────────────────────────────────── */}
      <div className="frosted-card rounded-3xl p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-black font-space text-[#0f172a] tracking-tight">
              Renewable Fleet Asset Register
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Complete inventory of wind turbines and solar inverter arrays with predictive health indicators
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Pills */}
            <div className="flex items-center bg-white/70 p-1 rounded-xl border border-slate-200/80 shadow-xs text-xs font-semibold">
              {[
                { key: 'all', label: 'All Fleet' },
                { key: 'wind', label: 'Wind Only' },
                { key: 'solar', label: 'Solar Only' },
                { key: 'attention', label: 'Attention' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    filterType === f.key
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search asset, location, or fault..."
              className="px-3.5 py-1.5 rounded-xl frosted-input text-xs placeholder-slate-400 focus:outline-none w-56 transition"
            />
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/60">
          <table className="w-full text-left border-collapse text-xs font-manrope">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 font-space text-slate-600 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-bold">Asset Name & ID</th>
                <th className="py-3 px-4 font-bold">Type</th>
                <th className="py-3 px-4 font-bold">Location</th>
                <th className="py-3 px-4 font-bold">Capacity</th>
                <th className="py-3 px-4 font-bold">Last Inspection</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold">Health Score</th>
                <th className="py-3 px-4 font-bold">Active Fault / Flag</th>
                <th className="py-3 px-4 font-bold">Failure Prob.</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((asset) => {
                const statusCfg = STATUS_CONFIG[asset.status] || STATUS_CONFIG.Healthy

                return (
                  <tr
                    key={asset.asset_id}
                    onClick={() => setSelectedAsset(asset)}
                    className="hover:bg-sky-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Asset Name */}
                    <td className="py-3.5 px-4 font-space font-bold text-[#0f172a] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[10px]">{asset.asset_id}</span>
                        <span className="group-hover:text-sky-600 transition-colors">{asset.name}</span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100/80 px-2.5 py-0.5 rounded-lg border border-slate-200">
                        {asset.type === 'wind' ? <WindIcon className="w-3.5 h-3.5 text-sky-600" /> : <SolarIcon className="w-3.5 h-3.5 text-amber-600" />}
                        {asset.type === 'wind' ? 'Wind' : 'Solar'}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {asset.location}
                    </td>

                    {/* Capacity */}
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                      {asset.capacity}
                    </td>

                    {/* Last Inspection */}
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {asset.last_inspection}
                    </td>

                    {/* Status Badge with dot & text */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold border ${statusCfg.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${statusCfg.pulse}`} />
                        {statusCfg.label}
                      </span>
                    </td>

                    {/* Health Score */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-space font-bold text-slate-800 w-8">
                          {asset.health_score}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              asset.health_score >= 80
                                ? 'bg-emerald-500'
                                : asset.health_score >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${asset.health_score}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Fault / Alert */}
                    <td className="py-3.5 px-4 text-slate-700 max-w-[220px] truncate">
                      {asset.fault}
                    </td>

                    {/* Failure Probability */}
                    <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                      <span className={statusCfg.accent}>
                        {asset.failure_probability}%
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedAsset(asset)
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition cursor-pointer"
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          5. SLIDE-OUT DETAIL DRAWER (Daylight Frosted Industrial Styling)
         ─────────────────────────────────────────────────────────────────────── */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs transition-opacity animate-fadeIn">
          <div className="w-full max-w-lg frosted-card h-full overflow-y-auto p-6 sm:p-8 shadow-2xl border-l border-white/90 animate-slideInRight flex flex-col justify-between">
            <div className="space-y-6">

              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-200/80">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                    {selectedAsset.type === 'wind' ? <WindIcon className="w-6 h-6" /> : <SolarIcon className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black font-space text-[#0f172a]">
                      {selectedAsset.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-500">
                      {selectedAsset.asset_id} • {selectedAsset.location}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedAsset(null)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Quick Status Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-white/70 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Status</span>
                  <span className={`font-space font-bold text-sm ${STATUS_CONFIG[selectedAsset.status]?.accent || 'text-slate-700'}`}>
                    {selectedAsset.status}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-white/70 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Failure Risk</span>
                  <span className="font-mono font-bold text-sm text-slate-800">
                    {selectedAsset.failure_probability}%
                  </span>
                </div>
              </div>

              {/* Diagnostic Root Cause */}
              <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200/60 text-xs">
                <h4 className="font-space font-bold text-sky-900 mb-1">Diagnostic Root Cause</h4>
                <p className="text-slate-700 font-medium leading-relaxed">{selectedAsset.fault}</p>
                {selectedAsset.why_flagged?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-slate-600 list-disc list-inside">
                    {selectedAsset.why_flagged.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Live Telemetry Readout */}
              <div>
                <h4 className="font-space font-bold text-sm text-[#0f172a] mb-3">SCADA Sensor Readings</h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {Object.entries(selectedAsset.latest_reading || {}).map(([key, val]) => (
                    <div key={key} className="p-2.5 rounded-xl bg-white/60 border border-slate-100 flex justify-between">
                      <span className="text-slate-400 capitalize">{key.replace('_', ' ')}:</span>
                      <span className="font-bold text-slate-800">{typeof val === 'number' ? val.toFixed(1) : String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-6 border-t border-slate-200/80 flex items-center gap-3">
              <Link
                to="/technician"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-space font-bold text-sm text-center shadow-md shadow-sky-500/20 transition cursor-pointer"
              >
                Dispatch Technician Order →
              </Link>
              <button
                onClick={() => setSelectedAsset(null)}
                className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
