import React from 'react'

export default function TechnicianPanel() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-lg">
            🔧
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Technician Panel
            </h1>
            <p className="text-sm text-slate-400">
              Prioritized maintenance queue, diagnostic sensor charts, and "why flagged" analysis.
            </p>
          </div>
        </div>

        <div className="mt-6 p-6 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Route</p>
              <p className="text-lg font-mono font-bold text-white mt-0.5">/technician</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Placeholder Ready for Phase 9
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-4 leading-relaxed">
            This view will render an urgency-sorted field task queue from{' '}
            <code className="text-amber-300">GET /assets/:id/queue-priority</code>, detailed time-series charts (Recharts)
            for bearing vibration, gearbox temp, and power, plus calculated baseline deviation explanations.
          </p>
        </div>
      </div>
    </div>
  )
}
