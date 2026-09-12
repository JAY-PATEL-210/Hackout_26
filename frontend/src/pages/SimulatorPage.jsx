import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = 'http://127.0.0.1:8000'
const TOTAL_DATASET_ROWS = 21600 // 4,320 timestamps * 5 turbines

export default function SimulatorPage() {
  const navigate = useNavigate()

  // Control state
  const [speed, setSpeed] = useState('10x')
  const [simStatus, setSimStatus] = useState('idle') // 'idle' | 'playing' | 'paused'
  const [hasStarted, setHasStarted] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState(null)
  const [isProcessingAction, setIsProcessingAction] = useState(false)
  const [apiOnline, setApiOnline] = useState(true)

  // Live telemetry state
  const [assets, setAssets] = useState([])
  const [rowsProcessed, setRowsProcessed] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(4320)
  const [simulatedTimestamp, setSimulatedTimestamp] = useState('2026-02-01 00:00:00')

  // Ref to hold current state for interval
  const isPlayingRef = useRef(false)
  isPlayingRef.current = simStatus === 'playing'

  // Fetch /assets and sync readout state
  const fetchTelemetry = async () => {
    try {
      // 1. Poll GET /assets (required by Phase 5 every 2 seconds)
      const assetRes = await fetch(`${API_BASE}/assets`)
      if (!assetRes.ok) throw new Error(`Assets HTTP ${assetRes.status}`)
      const assetData = await assetRes.json()
      setAssets(assetData)
      setApiOnline(true)

      // Extract headers if exposed
      const headerRows = assetRes.headers.get('X-Rows-Processed')
      const headerStep = assetRes.headers.get('X-Current-Step')
      const headerTotal = assetRes.headers.get('X-Total-Steps')
      const headerStatus = assetRes.headers.get('X-Simulation-Status')

      if (headerRows) setRowsProcessed(parseInt(headerRows, 10))
      if (headerStep) setCurrentStep(parseInt(headerStep, 10))
      if (headerTotal) setTotalSteps(parseInt(headerTotal, 10))
      if (headerStatus) {
        if (headerStatus === 'playing' || headerStatus === 'paused') {
          setSimStatus(headerStatus)
          setHasStarted(true)
        } else if (headerStatus === 'idle' || headerStatus === 'stopped') {
          setSimStatus('idle')
        }
      }

      // Also get primary timestamp from latest asset reading
      if (assetData && assetData.length > 0 && assetData[0].last_updated) {
        setSimulatedTimestamp(assetData[0].last_updated)
      }

      // 2. Fetch /simulate/status to get exact progression metrics
      try {
        const statusRes = await fetch(`${API_BASE}/simulate/status`)
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          if (statusData.rows_processed !== undefined) {
            setRowsProcessed(statusData.rows_processed)
          }
          if (statusData.current_step !== undefined) {
            setCurrentStep(statusData.current_step)
          }
          if (statusData.total_steps !== undefined) {
            setTotalSteps(statusData.total_steps)
          }
          if (statusData.simulated_timestamp) {
            setSimulatedTimestamp(statusData.simulated_timestamp)
          }
          if (statusData.is_playing) {
            setSimStatus('playing')
            setHasStarted(true)
          } else if (statusData.is_paused) {
            setSimStatus('paused')
            setHasStarted(true)
          } else {
            setSimStatus('idle')
          }
        }
      } catch {
        // Optional secondary endpoint fallback
      }
    } catch (err) {
      console.error('Failed to poll telemetry:', err)
      setApiOnline(false)
    }
  }

  // Poll GET /assets every 2 seconds
  useEffect(() => {
    fetchTelemetry() // initial fetch
    const timer = setInterval(() => {
      fetchTelemetry()
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  // Action: Run Simulation (POST /simulate/reset then GET /simulate/replay?speed=10x)
  const handleRunSimulation = async (selectedSpeed = speed) => {
    setIsProcessingAction(true)
    try {
      // Step 1: POST /simulate/reset
      const resetRes = await fetch(`${API_BASE}/simulate/reset`, {
        method: 'POST',
      })
      if (!resetRes.ok) throw new Error('Reset failed')

      // Step 2: GET /simulate/replay?speed=10x
      const replayRes = await fetch(
        `${API_BASE}/simulate/replay?speed=${selectedSpeed}`
      )
      if (!replayRes.ok) throw new Error('Replay start failed')
      const replayData = await replayRes.json()

      setSimStatus('playing')
      setHasStarted(true)
      setSpeed(selectedSpeed)
      if (replayData.current_step !== undefined) {
        setCurrentStep(replayData.current_step)
        setRowsProcessed(replayData.current_step * 5)
      }
      if (replayData.simulated_timestamp) {
        setSimulatedTimestamp(replayData.simulated_timestamp)
      }

      setConfirmationMessage(
        `Streaming live_input_dataset.csv at ${selectedSpeed} speed`
      )
      // Immediate telemetry refresh
      fetchTelemetry()
    } catch (err) {
      console.error('Error starting simulation:', err)
      setConfirmationMessage('Error launching simulation. Is backend running on port 8000?')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Action: Speed Change (1x, 10x, 100x)
  const handleSpeedChange = async (newSpeed) => {
    setSpeed(newSpeed)
    if (simStatus === 'playing') {
      try {
        const res = await fetch(`${API_BASE}/simulate/replay?speed=${newSpeed}`)
        if (res.ok) {
          setConfirmationMessage(
            `Streaming live_input_dataset.csv at ${newSpeed} speed`
          )
        }
      } catch (err) {
        console.error('Error adjusting speed:', err)
      }
    }
  }

  // Action: Pause Simulation (POST /simulate/pause)
  const handlePause = async () => {
    setIsProcessingAction(true)
    try {
      const res = await fetch(`${API_BASE}/simulate/pause`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Pause failed')
      setSimStatus('paused')
      setConfirmationMessage('Simulation paused. Click Resume or Run to continue.')
      fetchTelemetry()
    } catch (err) {
      console.error('Error pausing simulation:', err)
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Action: Resume Simulation
  const handleResume = async () => {
    setIsProcessingAction(true)
    try {
      const res = await fetch(`${API_BASE}/simulate/replay?speed=${speed}`)
      if (!res.ok) throw new Error('Resume failed')
      setSimStatus('playing')
      setConfirmationMessage(`Streaming live_input_dataset.csv resumed at ${speed} speed`)
      fetchTelemetry()
    } catch (err) {
      console.error('Error resuming simulation:', err)
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Identify turbines with High or Critical risk
  const highOrCriticalTurbines = assets.filter(
    (a) => a.risk_level === 'High' || a.risk_level === 'Critical'
  )

  const progressPercent = Math.min(
    100,
    Math.round((currentStep / Math.max(1, totalSteps)) * 1000) / 10
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner / Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
            🕹️
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                SCADA Simulator Control
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  simStatus === 'playing'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse'
                    : simStatus === 'paused'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    simStatus === 'playing'
                      ? 'bg-emerald-400'
                      : simStatus === 'paused'
                      ? 'bg-amber-400'
                      : 'bg-slate-500'
                  }`}
                ></span>
                {simStatus === 'playing'
                  ? `Active • ${speed}`
                  : simStatus === 'paused'
                  ? 'Paused'
                  : 'Ready'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Phase 5 live SCADA replay engine feeding predictive anomaly models.
            </p>
          </div>
        </div>

        {/* Prominent View Dashboard Button */}
        <div className="flex items-center gap-3">
          <button
            id="btn-view-dashboard"
            onClick={() => navigate('/user')}
            className={`group relative px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2.5 shadow-lg ${
              hasStarted
                ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] ring-2 ring-cyan-400/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <span>View Dashboard</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 ${
                hasStarted ? 'text-white' : 'text-slate-400'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
            {hasStarted && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Inline Offline/Error Banner */}
      {!apiOnline && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 backdrop-blur-sm shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>
              SCADA backend is offline or restarting on port 8000. Reconnecting automatically every 2s...
            </span>
          </div>
          <button
            type="button"
            onClick={fetchTelemetry}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition shrink-0 cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Confirmation Message Alert */}
      {confirmationMessage && (
        <div
          id="confirmation-banner"
          className="flex items-center justify-between p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 backdrop-blur-sm animate-fadeIn"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <span className="text-sm font-medium tracking-wide">
              {confirmationMessage}
            </span>
          </div>
          <button
            onClick={() => setConfirmationMessage(null)}
            className="text-xs text-cyan-400 hover:text-white px-2 py-1 rounded hover:bg-cyan-900/40 transition"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main SCADA Hardware Control Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Replay Control Console */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-mono text-xs font-semibold uppercase tracking-wider">
                  Command Panel
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                DATASET: live_input_dataset.csv
              </span>
            </div>

            {/* Playback Controls */}
            <div className="mt-6 space-y-6">
              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  id="btn-run-simulation"
                  onClick={() => handleRunSimulation(speed)}
                  disabled={isProcessingAction}
                  className="px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2.5 disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                    <path d="M4 4l12 6-12 6V4z" />
                  </svg>
                  <span>Run Simulation</span>
                </button>

                {simStatus === 'playing' ? (
                  <button
                    id="btn-pause-simulation"
                    onClick={handlePause}
                    disabled={isProcessingAction}
                    className="px-5 py-3.5 rounded-xl font-semibold text-sm bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                    </svg>
                    <span>Pause</span>
                  </button>
                ) : simStatus === 'paused' ? (
                  <button
                    id="btn-resume-simulation"
                    onClick={handleResume}
                    disabled={isProcessingAction}
                    className="px-5 py-3.5 rounded-xl font-semibold text-sm bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M4 4l12 6-12 6V4z" />
                    </svg>
                    <span>Resume</span>
                  </button>
                ) : null}
              </div>

              {/* Speed Selector */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span>Replay Speed Multiplier</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      (Adjust dynamically anytime)
                    </span>
                  </label>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    {speed}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Speed Selector">
                  {['1x', '10x', '100x'].map((s) => (
                    <button
                      key={s}
                      id={`speed-btn-${s}`}
                      type="button"
                      onClick={() => handleSpeedChange(s)}
                      className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-mono font-bold transition-all ${
                        speed === s
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 scale-[1.02]'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Flow Hint */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">1.</span> Click Run Simulation
            </span>
            <span>→</span>
            <span className="flex items-center gap-1.5">
              <span className="text-cyan-400 font-bold">2.</span> Watch Live Readouts
            </span>
            <span>→</span>
            <span className="flex items-center gap-1.5">
              <span className="text-sky-400 font-bold">3.</span> View Dashboard
            </span>
          </div>
        </div>

        {/* Right: Live Real-Time Telemetry Readout Deck */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Live SCADA Readout
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Polls GET /assets (2s)
            </span>
          </div>

          {/* Readout 1: Rows Processed */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-400">
                Rows Processed
              </span>
              <span className="text-xs font-mono text-cyan-400">
                {progressPercent}%
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                id="readout-rows-processed"
                className="text-2xl font-mono font-bold text-white tracking-tight"
              >
                {rowsProcessed.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-500">
                / {TOTAL_DATASET_ROWS.toLocaleString()} rows
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
              <div
                className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Readout 2: Current Simulated Timestamp */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-xs font-medium text-slate-400 block mb-1">
              Current Simulated Timestamp
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-slate-500 text-lg">🕒</span>
              <span
                id="readout-simulated-timestamp"
                className="text-xl font-mono font-bold text-emerald-400 tracking-tight"
              >
                {simulatedTimestamp || '—'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Step {currentStep} of {totalSteps} (10-min SCADA intervals)
            </span>
          </div>

          {/* Readout 3: High or Critical Risk Alert Readout */}
          <div
            id="readout-risk-alert"
            className={`p-4 rounded-xl border transition-all duration-300 ${
              highOrCriticalTurbines.length > 0
                ? 'bg-rose-950/40 border-rose-500/50 shadow-lg shadow-rose-950/30'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">
                High / Critical Risk Alarm
              </span>
              {highOrCriticalTurbines.length > 0 ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500 text-white animate-pulse">
                  Alert Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Nominal
                </span>
              )}
            </div>

            {highOrCriticalTurbines.length > 0 ? (
              <div className="space-y-2">
                {highOrCriticalTurbines.map((t) => (
                  <div
                    key={t.turbine_id}
                    className="p-2.5 rounded-lg bg-rose-900/30 border border-rose-500/30 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-rose-300">
                          Turbine {t.turbine_id}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-rose-500/30 text-rose-200 border border-rose-400/40">
                          {t.risk_level}
                        </span>
                      </div>
                      <p className="text-xs text-rose-200/80 mt-0.5 font-medium">
                        {t.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Anomaly</span>
                      <span className="text-xs font-mono font-bold text-rose-400">
                        {t.anomaly_score?.toFixed(3)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>No high or critical risk turbines detected at this timestep.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fleet Live Status Matrix (5 Turbines Quick View) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Fleet Telemetry Matrix</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                (5 Turbines Live)
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live updates refreshed every 2s directly from <code className="text-cyan-400">GET /assets</code>.
            </p>
          </div>
          <button
            onClick={fetchTelemetry}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Now</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {assets.map((asset) => {
            const isCritical = asset.risk_level === 'Critical'
            const isHigh = asset.risk_level === 'High'
            const isMedium = asset.risk_level === 'Medium'

            const badgeBg = isCritical
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              : isHigh
              ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
              : isMedium
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'

            const cardBorder = isCritical
              ? 'border-rose-500/50 bg-rose-950/15'
              : isHigh
              ? 'border-orange-500/40 bg-orange-950/15'
              : 'border-slate-800 bg-slate-950/60'

            return (
              <div
                key={asset.turbine_id}
                className={`p-4 rounded-xl border ${cardBorder} transition-all duration-200 hover:border-slate-700`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-white">
                    Turbine {asset.turbine_id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeBg}`}
                  >
                    {asset.risk_level}
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-[11px] text-slate-300 mt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Wind:</span>
                    <span>{asset.sensor_readings?.wind_speed?.toFixed(1)} m/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Power:</span>
                    <span>{asset.sensor_readings?.power_output?.toFixed(0)} kW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gearbox:</span>
                    <span
                      className={
                        asset.sensor_readings?.gearbox_temp > 75
                          ? 'text-rose-400 font-bold'
                          : ''
                      }
                    >
                      {asset.sensor_readings?.gearbox_temp?.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vibration:</span>
                    <span
                      className={
                        asset.sensor_readings?.bearing_vibration > 1.8
                          ? 'text-rose-400 font-bold'
                          : ''
                      }
                    >
                      {asset.sensor_readings?.bearing_vibration?.toFixed(2)} g
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-500">Score:</span>
                    <span className="text-cyan-400 font-bold">
                      {asset.anomaly_score?.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
