import React from 'react'
import { useNavigate } from 'react-router-dom'

const ROLE_CARDS = [
  {
    role: 'user',
    label: 'User',
    icon: '👤',
    description: 'Monitor live turbine status and receive real-time health alerts for your assigned assets.',
    accent: 'from-emerald-500/20 to-emerald-600/10',
    border: 'border-emerald-500/30 hover:border-emerald-400/60',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    glow: 'hover:shadow-emerald-500/10',
    btn: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30',
    route: '/login/user',
  },
  {
    role: 'technician',
    label: 'Technician',
    icon: '🔧',
    description: 'Access the maintenance queue, inspect sensor diagnostics, and manage work orders by priority.',
    accent: 'from-amber-500/20 to-amber-600/10',
    border: 'border-amber-500/30 hover:border-amber-400/60',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    glow: 'hover:shadow-amber-500/10',
    btn: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30',
    route: '/login/technician',
  },
  {
    role: 'manager',
    label: 'Manager',
    icon: '📊',
    description: 'View fleet-wide financial exposure, AI model validation metrics, and strategic risk distribution.',
    accent: 'from-violet-500/20 to-violet-600/10',
    border: 'border-violet-500/30 hover:border-violet-400/60',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    glow: 'hover:shadow-violet-500/10',
    btn: 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border-violet-500/30',
    route: '/login/manager',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-10 px-4 relative">

      {/* Background decorative glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-[300px] h-[200px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="text-center mb-12 relative">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center text-4xl shadow-2xl shadow-cyan-500/30 mb-5">
          ⚡
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">
          WindGuard SCADA
        </h1>
        <p className="mt-2 text-slate-400 text-base">
          Predictive Maintenance Platform — select your role to continue
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-mono font-semibold">LIVE · Firebase Firestore · AI-Powered</span>
        </div>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl relative">
        {ROLE_CARDS.map((card) => (
          <button
            key={card.role}
            onClick={() => navigate(card.route)}
            className={`group relative flex flex-col items-center gap-4 p-8 rounded-3xl border bg-gradient-to-b ${card.accent} ${card.border} backdrop-blur-sm shadow-xl ${card.glow} hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 cursor-pointer text-left`}
          >
            {/* Role badge */}
            <span className={`self-start px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${card.badge}`}>
              {card.label}
            </span>

            {/* Icon */}
            <div className="text-5xl my-2">{card.icon}</div>

            {/* Text */}
            <div className="flex-1 text-center">
              <h2 className="text-xl font-extrabold text-white mb-2">{card.label} Dashboard</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{card.description}</p>
            </div>

            {/* CTA */}
            <span className={`mt-2 w-full text-center py-2.5 px-4 rounded-xl border text-sm font-bold transition-all ${card.btn} group-hover:scale-[1.02]`}>
              Enter as {card.label} →
            </span>
          </button>
        ))}
      </div>

      {/* Simulator link — visually distinct, separate from role cards */}
      <div className="mt-12 relative">
        <div className="flex items-center gap-3 before:flex-1 before:h-px before:bg-slate-800 after:flex-1 after:h-px after:bg-slate-800 text-slate-600 text-xs uppercase tracking-widest font-semibold mb-4">
          Admin
        </div>
        <button
          onClick={() => navigate('/simulator')}
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/60 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-sm font-medium transition-all duration-150 cursor-pointer shadow-sm"
        >
          <span className="text-base">🖥️</span>
          <span>Simulator / Admin Panel</span>
          <span className="text-xs font-mono text-slate-600 ml-1">— no login required</span>
        </button>
      </div>
    </div>
  )
}
