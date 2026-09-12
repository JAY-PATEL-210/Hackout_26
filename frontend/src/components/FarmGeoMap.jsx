import React, { useState } from 'react'

export default function FarmGeoMap({ assets = [], onSelectAsset }) {
  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [filterType, setFilterType] = useState('all') // 'all' | 'wind' | 'solar' | 'alarm'

  // Map coordinates and layout definition for the farm
  const mapNodes = [
    { id: 'WT-01', x: 220, y: 130, sector: 'Sector Alpha - Ridge North', elevation: '1,420m', type: 'wind' },
    { id: 'WT-02', x: 380, y: 180, sector: 'Sector Alpha - Ridge Center', elevation: '1,390m', type: 'wind' },
    { id: 'WT-03', x: 190, y: 310, sector: 'Sector Beta - Valley Inflow', elevation: '980m', type: 'wind' },
    { id: 'WT-04', x: 360, y: 350, sector: 'Sector Beta - Valley Outflow', elevation: '920m', type: 'wind' },
    { id: 'WT-05', x: 530, y: 220, sector: 'Sector Gamma - High Peak', elevation: '1,560m', type: 'wind' },
    { id: 'PV-01', x: 670, y: 320, sector: 'Sector Delta - South Plain', elevation: '740m', type: 'solar' },
    { id: 'PV-02', x: 790, y: 360, sector: 'Sector Delta - South Plain', elevation: '720m', type: 'solar' },
    { id: 'PV-03', x: 730, y: 160, sector: 'Sector Epsilon - West Plateau', elevation: '810m', type: 'solar' },
  ]

  // Merge with live asset data
  const combinedNodes = mapNodes.map((node) => {
    const live = assets.find((a) => a.id === node.id) || {}
    return {
      ...node,
      ...live,
    }
  })

  // Filter nodes
  const filteredNodes = combinedNodes.filter((node) => {
    if (filterType === 'wind') return node.type === 'wind'
    if (filterType === 'solar') return node.type === 'solar'
    if (filterType === 'alarm') return node.status === 'Critical' || node.status === 'Warning'
    return true
  })

  const selectedAsset = combinedNodes.find((n) => n.id === selectedAssetId)

  return (
    <div className="frosted-card rounded-3xl p-6 sm:p-8 border border-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)] relative overflow-hidden font-manrope">
      {/* Top Header Bar & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sm shadow-xs">
              🗺️
            </span>
            <h2 className="text-xl font-bold font-space text-slate-900 tracking-tight">
              Interactive SCADA Farm Topology
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Vector GIS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-manrope">
            Geospatial terrain layout of wind turbines on ridge contours and solar arrays on southern plains.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 p-1 bg-white/80 rounded-2xl border border-slate-200 shadow-xs self-start sm:self-auto">
          {[
            { key: 'all', label: 'All Assets (8)' },
            { key: 'wind', label: 'Wind Turbines (5)' },
            { key: 'solar', label: 'Solar Arrays (3)' },
            { key: 'alarm', label: 'Active Alarms (2)' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer font-space ${
                filterType === f.key
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main SVG Interactive Map Canvas */}
      <div className="relative w-full h-[480px] sm:h-[540px] rounded-2xl bg-gradient-to-b from-[#f0f9ff]/60 via-[#ecfdf5]/40 to-[#f8fafc] border border-slate-200/80 overflow-hidden shadow-inner">
        <svg
          viewBox="0 0 920 480"
          className="w-full h-full select-none"
          onClick={() => setSelectedAssetId(null)}
        >
          <defs>
            {/* Soft terrain gradient fills */}
            <linearGradient id="ridgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.04" />
            </linearGradient>

            <linearGradient id="valleyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
            </linearGradient>

            <linearGradient id="solarPlainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>

            {/* Pulsing beacon glow filters */}
            <filter id="glowCritical" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glowHealthy" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* ── Background Topography Contours ───────────────────────────────── */}
          {/* Ridge Sector Alpha (North/Highland) */}
          <path
            d="M 50 40 Q 250 20 450 60 T 650 30 L 620 220 Q 420 200 240 240 Z"
            fill="url(#ridgeGradient)"
            stroke="#bae6fd"
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />
          <text x="70" y="70" fill="#0284c7" fontSize="11" fontWeight="700" opacity="0.65" fontFamily="sans-serif">
            ▲ SECTOR ALPHA (RIDGE ELEVATION 1,400M)
          </text>

          {/* Valley Sector Beta (Lowland Wind Funnel) */}
          <path
            d="M 60 250 Q 260 240 460 280 T 640 260 L 590 420 Q 380 440 120 410 Z"
            fill="url(#valleyGradient)"
            stroke="#a7f3d0"
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />
          <text x="80" y="380" fill="#059669" fontSize="11" fontWeight="700" opacity="0.65" fontFamily="sans-serif">
            ▼ SECTOR BETA (CANYON FUNNEL 950M)
          </text>

          {/* Solar Plain Sector Delta (Flat Southfield) */}
          <path
            d="M 630 180 Q 780 120 900 150 L 900 450 Q 760 460 630 430 Z"
            fill="url(#solarPlainGradient)"
            stroke="#fde68a"
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />
          <text x="680" y="440" fill="#d97706" fontSize="11" fontWeight="700" opacity="0.75" fontFamily="sans-serif">
            ☀️ SECTOR DELTA (SOLAR PLAINS)
          </text>

          {/* Wind Streamline Vectors (Gentle ambient wind flow) */}
          <g opacity="0.35" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="6 8">
            <path d="M 30 160 Q 250 140 500 180 T 890 190" />
            <path d="M 40 220 Q 280 200 520 240 T 890 260" />
            <path d="M 20 330 Q 260 300 480 340 T 890 350" />
          </g>

          {/* Grid Connectors between Assets */}
          <g stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.6">
            <line x1="220" y1="130" x2="380" y2="180" />
            <line x1="380" y1="180" x2="530" y2="220" />
            <line x1="190" y1="310" x2="360" y2="350" />
            <line x1="360" y1="350" x2="530" y2="220" />
            <line x1="530" y1="220" x2="670" y2="320" />
            <line x1="670" y1="320" x2="790" y2="360" />
            <line x1="670" y1="320" x2="730" y2="160" />
          </g>

          {/* ── Render Asset Nodes ─────────────────────────────────────────── */}
          {filteredNodes.map((node) => {
            const isSelected = selectedAssetId === node.id
            const isCritical = node.status === 'Critical'
            const isWarning = node.status === 'Warning'
            const isWatch = node.status === 'Watch'

            const statusColor = isCritical
              ? '#ef4444'
              : isWarning
              ? '#f59e0b'
              : isWatch
              ? '#0ea5e9'
              : '#10b981'

            const pulseRing = isCritical
              ? 'animate-ping'
              : isWarning
              ? 'animate-pulse'
              : ''

            // Rotation animation duration based on wind speed (faster wind = faster blade spin)
            const windSpeed = node.telemetry?.wind_speed || 8.5
            const bladeSpinDuration = Math.max(1.2, (24 / Math.max(2, windSpeed)).toFixed(1))

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedAssetId(node.id)
                }}
                className="cursor-pointer transition-transform hover:scale-110"
              >
                {/* Outer Status Radar Ring */}
                {(isCritical || isWarning) && (
                  <circle
                    cx="0"
                    cy="0"
                    r="24"
                    fill={statusColor}
                    opacity="0.25"
                    className={pulseRing}
                  />
                )}

                {/* Base Node Circle */}
                <circle
                  cx="0"
                  cy="0"
                  r={isSelected ? 22 : 18}
                  fill="#ffffff"
                  stroke={isSelected ? '#0284c7' : statusColor}
                  strokeWidth={isSelected ? 3 : 2}
                  filter={isCritical ? 'url(#glowCritical)' : 'url(#glowHealthy)'}
                />

                {/* Wind Turbine SVG Icon or Solar Array SVG Icon */}
                {node.type === 'wind' ? (
                  <g transform="translate(0, 0)">
                    {/* Mast */}
                    <line x1="0" y1="0" x2="0" y2="11" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
                    {/* Nacelle */}
                    <circle cx="0" cy="0" r="3.2" fill="#0f172a" />
                    {/* Rotating Blades */}
                    <g className="origin-center" style={{ animation: `spin ${bladeSpinDuration}s linear infinite` }}>
                      <line x1="0" y1="0" x2="0" y2="-12" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
                      <line x1="0" y1="0" x2="10.4" y2="6" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
                      <line x1="0" y1="0" x2="-10.4" y2="6" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
                    </g>
                  </g>
                ) : (
                  <g transform="translate(-8, -8)">
                    {/* Solar PV Module */}
                    <rect x="0" y="0" width="16" height="16" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
                    <line x1="8" y1="0" x2="8" y2="16" stroke="#d97706" strokeWidth="1" />
                    <line x1="0" y1="8" x2="16" y2="8" stroke="#d97706" strokeWidth="1" />
                  </g>
                )}

                {/* Status Dot Pill Badge */}
                <circle
                  cx="12"
                  cy="-12"
                  r="5"
                  fill={statusColor}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* Asset Label Text */}
                <text
                  x="0"
                  y="28"
                  textAnchor="middle"
                  fill="#0f172a"
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="sans-serif"
                  className="drop-shadow-xs pointer-events-none"
                >
                  {node.id}
                </text>
                <text
                  x="0"
                  y="39"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="sans-serif"
                  className="pointer-events-none"
                >
                  {node.capacity}
                </text>
              </g>
            )
          })}
        </svg>

        {/* ── Interactive Floating Telemetry Popup on Selected Asset ─────────── */}
        {selectedAsset && (
          <div
            className="absolute z-30 bottom-4 left-4 right-4 sm:right-auto sm:w-96 frosted-card rounded-2xl p-5 border border-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.12)] animate-fadeIn"
            style={{ backdropFilter: 'blur(24px)' }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base font-space text-slate-900">
                    {selectedAsset.name || selectedAsset.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedAsset.status === 'Critical'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : selectedAsset.status === 'Warning'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : selectedAsset.status === 'Watch'
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        selectedAsset.status === 'Critical'
                          ? 'bg-rose-500 animate-ping'
                          : selectedAsset.status === 'Warning'
                          ? 'bg-amber-500'
                          : selectedAsset.status === 'Watch'
                          ? 'bg-sky-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    {selectedAsset.status || 'Healthy'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedAsset.sector} · Elev: {selectedAsset.elevation}
                </p>
              </div>

              <button
                onClick={() => setSelectedAssetId(null)}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Diagnostic Alert Callout */}
            {selectedAsset.fault && selectedAsset.fault !== 'None' && (
              <div className="p-2.5 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-700 text-xs mb-3 flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <span className="font-semibold">{selectedAsset.fault}</span>
              </div>
            )}

            {/* Real-time Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {selectedAsset.type === 'wind' ? 'Wind Speed' : 'Solar Irradiance'}
                </span>
                <span className="text-sm font-bold font-space text-slate-900">
                  {selectedAsset.type === 'wind'
                    ? `${selectedAsset.telemetry?.wind_speed?.toFixed(1) || '8.8'} m/s`
                    : `${selectedAsset.telemetry?.irradiance || '840'} W/m²`}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Active Power Output
                </span>
                <span className="text-sm font-bold font-space text-emerald-600">
                  {selectedAsset.telemetry?.power?.toFixed(0) || '540'} kW
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {selectedAsset.type === 'wind' ? 'Gearbox Temp' : 'Inverter Temp'}
                </span>
                <span
                  className={`text-sm font-bold font-space ${
                    (selectedAsset.telemetry?.temp || 50) > 75 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {selectedAsset.telemetry?.temp?.toFixed(1) || '50.2'} °C
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {selectedAsset.type === 'wind' ? 'Bearing Vibration' : 'DC Current'}
                </span>
                <span
                  className={`text-sm font-bold font-space ${
                    (selectedAsset.telemetry?.vibration || 1.2) > 1.8 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {selectedAsset.type === 'wind'
                    ? `${selectedAsset.telemetry?.vibration?.toFixed(2) || '1.22'} g`
                    : `${selectedAsset.telemetry?.dc_current || '2150'} A`}
                </span>
              </div>
            </div>

            {/* Inspect / Action Button */}
            <button
              onClick={() => {
                if (onSelectAsset) onSelectAsset(selectedAsset)
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs font-space transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Inspect Full Diagnostics & History</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Map Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Healthy (Nominal)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span>Watch / Minor</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Warning (Pitch Drift)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-rose-600 font-bold">Critical (Gearbox Spike)</span>
          </span>
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          Click any turbine or inverter on map to inspect real-time sensor stream
        </span>
      </div>
    </div>
  )
}
