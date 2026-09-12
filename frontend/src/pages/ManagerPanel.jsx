import React from 'react'

export default function ManagerPanel() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 text-lg">
            📊
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Manager Panel
            </h1>
            <p className="text-sm text-slate-400">
              Fleet-wide business metrics, revenue-at-risk calculations, and model validation reporting.
            </p>
          </div>
        </div>

        <div className="mt-6 p-6 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Route</p>
              <p className="text-lg font-mono font-bold text-white mt-0.5">/manager</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Placeholder Ready for Phase 10
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-4 leading-relaxed">
            This view will render fleet risk breakdown donut/bar charts, total financial revenue at risk from{' '}
            <code className="text-violet-300">GET /fleet/summary</code>, and verified ML performance metrics
            (detection lead time, precision, recall, safety backstop breakdown).
          </p>
        </div>
      </div>
    </div>
  )
}
