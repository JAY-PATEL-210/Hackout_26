import React from 'react'

export default function SimulatorPage() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-lg">
            🎮
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Simulator / Control Page
            </h1>
            <p className="text-sm text-slate-400">
              Live SCADA streaming control center and replay management.
            </p>
          </div>
        </div>

        <div className="mt-6 p-6 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Route</p>
              <p className="text-lg font-mono font-bold text-white mt-0.5">/</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Placeholder Ready for Phase 7
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-4 leading-relaxed">
            This page will host the simulation replay controls (1x, 10x, 100x speeds), reset/pause actions,
            and real-time streaming readouts from <code className="text-cyan-300">live_input_dataset.csv</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
