import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { scadaAudio } from '../utils/audioAlarm'

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

      if (assetData && assetData.length > 0 && assetData[0].last_updated) {
        setSimulatedTimestamp(assetData[0].last_updated)
      }

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

  // Real-time Firestore onSnapshot listeners
  useEffect(() => {
    fetchTelemetry()

    const unsubSim = onSnapshot(doc(db, 'simulation_state', 'current'), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data()
        if (d.status) {
          setSimStatus(d.status === 'running' ? 'playing' : d.status)
          if (d.status === 'running' || d.status === 'paused') setHasStarted(true)
        }
        if (d.speed) setSpeed(d.speed)
        if (d.current_row_index !== undefined) {
          setCurrentStep(d.current_row_index)
          setRowsProcessed(d.current_row_index * 5)
        }
        if (d.current_simulated_timestamp) {
          setSimulatedTimestamp(
            d.current_simulated_timestamp?.toDate
              ? d.current_simulated_timestamp.toDate().toLocaleString()
              : String(d.current_simulated_timestamp)
          )
        }
      }
    }, (err) => console.warn('[SimulatorPage] simulation_state listener fallback:', err))

    const unsubTurbines = onSnapshot(collection(db, 'turbines'), (snapshot) => {
      if (!snapshot.empty) {
        const turbineList = snapshot.docs.map((d) => {
          const data = d.data()
          return {
            turbine_id: data.turbine_id || parseInt(d.id, 10),
            risk_level: data.current_risk_level || 'Low',
            status: data.status || 'Running normally',
            last_updated: data.last_updated?.toDate ? data.last_updated.toDate().toLocaleString() : data.last_updated,
            anomaly_score: data.current_anomaly_score || 0,
            sensor_readings: data.latest_reading || {},
          }
        })
        turbineList.sort((a, b) => a.turbine_id - b.turbine_id)
        setAssets(turbineList)
        setApiOnline(true)
      }
    }, (err) => console.warn('[SimulatorPage] turbines listener fallback:', err))

    const timer = setInterval(() => {
      fetchTelemetry()
    }, 4000)

    return () => {
      unsubSim()
      unsubTurbines()
      clearInterval(timer)
    }
  }, [])

  // Action: Run Simulation
  const handleRunSimulation = async (selectedSpeed = speed) => {
    setIsProcessingAction(true)
    try {
      const resetRes = await fetch(`${API_BASE}/simulate/reset`, { method: 'POST' })
      if (!resetRes.ok) throw new Error('Reset failed')

      const replayRes = await fetch(`${API_BASE}/simulate/replay?speed=${selectedSpeed}`)
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

      setConfirmationMessage(`Streaming SCADA telemetry at ${selectedSpeed} speed`)
      fetchTelemetry()
    } catch (err) {
      console.error('Error starting simulation:', err)
      setConfirmationMessage('Error launching simulation. Is backend running on port 8000?')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Action: Speed Change
  const handleSpeedChange = async (newSpeed) => {
    setSpeed(newSpeed)
    if (simStatus === 'playing') {
      try {
        const res = await fetch(`${API_BASE}/simulate/replay?speed=${newSpeed}`)
        if (res.ok) {
          setConfirmationMessage(`Playback speed changed to ${newSpeed}`)
        }
      } catch (err) {
        console.error('Error adjusting speed:', err)
      }
    }
  }

  // Action: Pause Simulation
  const handlePause = async () => {
    setIsProcessingAction(true)
    try {
      const res = await fetch(`${API_BASE}/simulate/pause`, { method: 'POST' })
      if (!res.ok) throw new Error('Pause failed')
      setSimStatus('paused')
      setConfirmationMessage('Simulation paused. Click Resume to continue.')
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
      setConfirmationMessage(`Streaming SCADA telemetry resumed at ${speed} speed`)
      fetchTelemetry()
    } catch (err) {
      console.error('Error resuming simulation:', err)
    } finally {
      setIsProcessingAction(false)
    }
  }

  const highOrCriticalTurbines = assets.filter(
    (a) => a.risk_level === 'High' || a.risk_level === 'Critical'
  )

  // Acoustic alarm pulse on new critical detections during simulation replay
  const prevAlertCountRef = useRef(0)
  useEffect(() => {
    const currentAlertCount = highOrCriticalTurbines.length
    if (simStatus === 'playing' && currentAlertCount > 0 && currentAlertCount > prevAlertCountRef.current) {
      scadaAudio.playChime('critical')
    }
    prevAlertCountRef.current = currentAlertCount
  }, [highOrCriticalTurbines.length, simStatus])

  const progressPercent = Math.min(
    100,
    Math.round((currentStep / Math.max(1, totalSteps)) * 1000) / 10
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-manrope">
      {/* Top Banner / Breadcrumb Bar */}
      <div className="frosted-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-400 via-teal-500 to-emerald-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-sky-500/20 ring-1 ring-white/50 shrink-0">
              🕹️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold font-space text-slate-900 tracking-tight">
                  SCADA Simulator Control
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    simStatus === 'playing'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : simStatus === 'paused'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      simStatus === 'playing'
                        ? 'bg-emerald-500 animate-ping'
                        : simStatus === 'paused'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />
                  {simStatus === 'playing'
                    ? `Streaming • ${speed}`
                    : simStatus === 'paused'
                    ? 'Paused'
                    : 'Engine Ready'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 font-manrope">
                High-fidelity renewable energy sensor replay feeding live anomaly models.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              id="btn-view-dashboard"
              onClick={() => navigate('/user')}
              className={`group relative px-6 py-3 rounded-2xl font-bold text-sm font-space transition-all duration-300 flex items-center gap-2.5 shadow-md ${
                hasStarted
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sky-500/25 hover:shadow-sky-500/35 hover:scale-[1.02]'
                  : 'bg-white/90 hover:bg-white text-slate-700 border border-slate-200 shadow-sm'
              }`}
            >
              <span>View Control Room</span>
              <svg
                className={`w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 ${
                  hasStarted ? 'text-white' : 'text-slate-500'
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Inline Offline/Error Banner */}
      {!apiOnline && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-3 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>
              SCADA backend is offline or restarting on port 8000. Reconnecting automatically every 2s...
            </span>
          </div>
          <button
            type="button"
            onClick={fetchTelemetry}
            className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-xs font-bold transition shrink-0 cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Confirmation Message Alert */}
      {confirmationMessage && (
        <div
          id="confirmation-banner"
          className="flex items-center justify-between p-4 rounded-2xl bg-sky-50/90 border border-sky-200 text-sky-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
            </span>
            <span className="text-sm font-semibold tracking-wide">
              {confirmationMessage}
            </span>
          </div>
          <button
            onClick={() => setConfirmationMessage(null)}
            className="text-xs text-sky-700 hover:text-sky-900 px-2.5 py-1 rounded-lg hover:bg-sky-100 transition font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main SCADA Hardware Control Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Replay Control Console */}
        <div className="lg:col-span-7 frosted-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-sky-600 font-bold text-xs uppercase tracking-wider font-manrope">
                  Simulator Command Deck
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                SCADA Source: live_input_dataset.csv
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
                  className="px-7 py-3.5 rounded-2xl font-bold text-sm font-space bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2.5 disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                    <path d="M4 4l12 6-12 6V4z" />
                  </svg>
                  <span>Start SCADA Replay</span>
                </button>

                {simStatus === 'playing' ? (
                  <button
                    id="btn-pause-simulation"
                    onClick={handlePause}
                    disabled={isProcessingAction}
                    className="px-6 py-3.5 rounded-2xl font-bold text-sm font-space bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
                    className="px-6 py-3.5 rounded-2xl font-bold text-sm font-space bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M4 4l12 6-12 6V4z" />
                    </svg>
                    <span>Resume</span>
                  </button>
                ) : null}
              </div>

              {/* Speed Selector */}
              <div className="bg-white/70 border border-white/90 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2 font-manrope">
                    <span>Replay Acceleration Multiplier</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      (Adjust dynamically)
                    </span>
                  </label>
                  <span className="text-xs font-bold font-space text-sky-600 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200">
                    {speed}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Speed Selector">
                  {['1x', '10x', '100x'].map((s) => (
                    <button
                      key={s}
                      id={`speed-btn-${s}`}
                      type="button"
                      onClick={() => handleSpeedChange(s)}
                      className={`py-3 px-4 rounded-xl text-sm font-bold font-space transition-all cursor-pointer ${
                        speed === s
                          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-[1.02]'
                          : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
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
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 font-manrope gap-2">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-600 font-bold font-space">1.</span> Launch Replay
            </span>
            <span>→</span>
            <span className="flex items-center gap-1.5">
              <span className="text-sky-600 font-bold font-space">2.</span> Inspect Live Readouts
            </span>
            <span>→</span>
            <span className="flex items-center gap-1.5">
              <span className="text-indigo-600 font-bold font-space">3.</span> Switch to Control Room
            </span>
          </div>
        </div>

        {/* Right: Live Real-Time Telemetry Readout Deck */}
        <div className="lg:col-span-5 frosted-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 font-manrope">
                Live Sensor Readout
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Polls GET /assets (2s)
            </span>
          </div>

          {/* Readout 1: Rows Processed */}
          <div className="p-4 rounded-2xl bg-white/70 border border-white shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500 font-manrope">
                Rows Processed
              </span>
              <span className="text-xs font-bold font-space text-sky-600">
                {progressPercent}%
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                id="readout-rows-processed"
                className="text-2xl font-bold font-space text-slate-900 tracking-tight"
              >
                {rowsProcessed.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-manrope">
                / {TOTAL_DATASET_ROWS.toLocaleString()} rows
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3 border border-slate-200/50">
              <div
                className="bg-gradient-to-r from-sky-500 to-emerald-500 h-full transition-all duration-300 rounded-full shadow-sm"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Readout 2: Current Simulated Timestamp */}
          <div className="p-4 rounded-2xl bg-white/70 border border-white shadow-sm">
            <span className="text-xs font-bold text-slate-500 block mb-1 font-manrope">
              Simulated Telemetry Timestamp
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-slate-400 text-lg">🕒</span>
              <span
                id="readout-simulated-timestamp"
                className="text-xl font-bold font-space text-emerald-600 tracking-tight"
              >
                {simulatedTimestamp || '—'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1.5 block font-manrope">
              Timestep {currentStep} of {totalSteps} (10-minute intervals)
            </span>
          </div>

          {/* Readout 3: High or Critical Risk Alert Readout */}
          <div
            id="readout-risk-alert"
            className={`p-4 rounded-2xl border transition-all duration-300 ${
              highOrCriticalTurbines.length > 0
                ? 'bg-rose-50/90 border-rose-200 shadow-sm'
                : 'bg-white/70 border-white shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 font-manrope">
                SCADA Active Alarms
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => scadaAudio.testAlarm('critical')}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-space font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition cursor-pointer flex items-center gap-1 active:scale-95"
                  title="Audition acoustic alert chime"
                >
                  <span>🔊</span>
                  <span>Test Alarm</span>
                </button>
                {highOrCriticalTurbines.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500 text-white shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    Alert Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Nominal Fleet
                  </span>
                )}
              </div>
            </div>

            {highOrCriticalTurbines.length > 0 ? (
              <div className="space-y-2">
                {highOrCriticalTurbines.map((t) => (
                  <div
                    key={t.turbine_id}
                    className="p-3 rounded-xl bg-white/90 border border-rose-200 flex items-start justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-space text-slate-900">
                          Turbine {t.turbine_id}
                        </span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200">
                          {t.risk_level}
                        </span>
                      </div>
                      <p className="text-xs text-rose-700 mt-0.5 font-medium">
                        {t.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-manrope">Anomaly</span>
                      <span className="text-xs font-bold font-space text-rose-600">
                        {t.anomaly_score?.toFixed(3)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>All units operating within nominal sensor envelopes.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fleet Live Status Matrix (5 Turbines Quick View) */}
      <div className="frosted-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold font-space text-slate-900 flex items-center gap-2">
              <span>Telemetry Matrix</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                (5 Wind Units Live)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-manrope">
              Live updates refreshed every 2s directly from <code className="text-sky-600">GET /assets</code>.
            </p>
          </div>
          <button
            onClick={fetchTelemetry}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Telemetry</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {assets.map((asset) => {
            const isCritical = asset.risk_level === 'Critical'
            const isHigh = asset.risk_level === 'High'
            const isMedium = asset.risk_level === 'Medium'

            const badgeBg = isCritical
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : isHigh
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : isMedium
              ? 'bg-sky-50 text-sky-700 border-sky-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'

            const dotColor = isCritical
              ? 'bg-rose-500'
              : isHigh
              ? 'bg-amber-500'
              : isMedium
              ? 'bg-sky-500'
              : 'bg-emerald-500'

            const cardBorder = isCritical
              ? 'border-rose-300 bg-rose-50/40'
              : isHigh
              ? 'border-amber-300 bg-amber-50/40'
              : 'border-white/90 bg-white/70'

            return (
              <div
                key={asset.turbine_id}
                className={`p-4 rounded-2xl border ${cardBorder} shadow-sm transition-all duration-200 hover:shadow-md`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm font-space text-slate-900">
                    Turbine {asset.turbine_id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badgeBg}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    {asset.risk_level}
                  </span>
                </div>

                <div className="space-y-1.5 font-manrope text-xs text-slate-600 mt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Wind Speed:</span>
                    <span className="font-semibold">{asset.sensor_readings?.wind_speed?.toFixed(1) ?? '—'} m/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Power:</span>
                    <span className="font-semibold">{asset.sensor_readings?.power_output?.toFixed(0) ?? '—'} kW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gearbox:</span>
                    <span
                      className={
                        asset.sensor_readings?.gearbox_temp > 75
                          ? 'text-rose-600 font-bold'
                          : 'font-semibold'
                      }
                    >
                      {asset.sensor_readings?.gearbox_temp?.toFixed(1) ?? '—'} °C
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vibration:</span>
                    <span
                      className={
                        asset.sensor_readings?.bearing_vibration > 1.8
                          ? 'text-rose-600 font-bold'
                          : 'font-semibold'
                      }
                    >
                      {asset.sensor_readings?.bearing_vibration?.toFixed(2) ?? '—'} g
                    </span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-100">
                    <span className="text-slate-400">Anomaly:</span>
                    <span className="text-sky-600 font-bold font-space">
                      {asset.anomaly_score?.toFixed(3) ?? '0.000'}
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
