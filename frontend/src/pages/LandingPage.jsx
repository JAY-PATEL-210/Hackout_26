import React from 'react'
import { useNavigate } from 'react-router-dom'

const ROLE_CARDS = [
  {
    role: 'user',
    label: 'User / Operator',
    icon: '⚡',
    description: 'Daylight control-room overview, live fleet health headline, real-time sensor anomaly monitor, and full renewable asset register.',
    badge: 'Live Operations',
    dot: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentBorder: 'hover:border-emerald-400',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
    route: '/login/user',
  },
  {
    role: 'technician',
    label: 'Technician',
    icon: '🔧',
    description: 'Sensor diagnostics, telemetry trend charts (vibration, temperature, power), root-cause explainers, and live work order logs.',
    badge: 'Maintenance Queue',
    dot: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    accentBorder: 'hover:border-amber-400',
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20',
    route: '/login/technician',
  },
  {
    role: 'manager',
    label: 'Executive Manager',
    icon: '📊',
    description: 'Fleet financial exposure, avoided catastrophic costs, AI model validation metrics (precision, recall, lead time), and risk distribution.',
    badge: 'Executive Analytics',
    dot: 'bg-sky-500',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    accentBorder: 'hover:border-sky-400',
    btnClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/20',
    route: '/login/manager',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-8 px-4 relative font-manrope">
      {/* Header */}
      <div className="text-center mb-12 relative max-w-2xl">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-sky-400 via-sky-500 to-indigo-600 flex items-center justify-center text-3xl shadow-xl shadow-sky-500/25 ring-2 ring-white mb-5 text-white">
          ⚡
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold font-space text-slate-900 tracking-tight">
          WindGuard SCADA
        </h1>
        <p className="mt-3 text-slate-600 text-base sm:text-lg font-medium leading-relaxed">
          Clean daylight industrial control-room dashboard for predictive renewable energy asset monitoring.
        </p>
        <div className="flex items-center justify-center gap-2.5 mt-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-space">
            Live SCADA Fleet · Hybrid Wind & Solar · AI Anomaly Detection
          </span>
        </div>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl relative">
        {ROLE_CARDS.map((card) => (
          <div
            key={card.role}
            onClick={() => navigate(card.route)}
            className={`frosted-card group relative flex flex-col justify-between p-7 sm:p-8 rounded-3xl border border-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)] hover:shadow-[0_20px_48px_rgba(15,23,42,0.09)] hover:-translate-y-1.5 transition-all duration-300 cursor-pointer ${card.accentBorder}`}
          >
            <div>
              {/* Badge with color dot + text label */}
              <div className="flex items-center justify-between mb-6">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${card.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${card.dot}`} />
                  {card.badge}
                </span>
                <span className="text-3xl p-2 rounded-2xl bg-white/80 border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                  {card.icon}
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-bold font-space text-slate-900 mb-2">
                {card.label}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                {card.description}
              </p>
            </div>

            {/* CTA Button */}
            <div className="mt-8 pt-4 border-t border-slate-100">
              <span className={`w-full text-center py-3 px-4 rounded-2xl text-sm font-bold font-space transition-all flex items-center justify-center gap-2 shadow-sm ${card.btnClass}`}>
                <span>Access Portal</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Simulator link */}
      <div className="mt-12 text-center">
        <button
          onClick={() => navigate('/simulator')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/80 hover:bg-white border border-white/90 shadow-sm text-slate-600 hover:text-slate-900 text-xs font-bold font-space transition-all cursor-pointer"
        >
          <span className="text-base">🕹️</span>
          <span>Open SCADA Simulator Controls</span>
          <span className="text-slate-400 font-normal font-manrope">— telemetry replay & engine speed</span>
        </button>
      </div>
    </div>
  )
}
