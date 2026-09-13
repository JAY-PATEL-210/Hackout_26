import React, { useState, useEffect, useRef } from 'react'
import { scadaAudio } from '../utils/audioAlarm'

export default function AudioAlarmController() {
  const [audioState, setAudioState] = useState({
    isMuted: scadaAudio.isMuted,
    volume: scadaAudio.volume,
    isSirenActive: scadaAudio.isSirenActive,
  })
  const [isOpen, setIsOpen] = useState(false)
  const [lastPlayedTone, setLastPlayedTone] = useState(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    const unsub = scadaAudio.subscribe((state) => {
      setAudioState(state)
    })
    return unsub
  }, [])

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside)
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [isOpen])

  const handleTestTone = (type, label) => {
    setLastPlayedTone(label)
    scadaAudio.testAlarm(type)
    setTimeout(() => {
      setLastPlayedTone(null)
    }, 800)
  }

  const handleToggleSiren = () => {
    if (audioState.isSirenActive) {
      scadaAudio.stopEmergencySiren()
    } else {
      scadaAudio.startEmergencySiren()
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <div className="flex items-center gap-1.5">
        {/* Quick 1-Click Test Alarm Button */}
        <button
          onClick={() => handleTestTone('critical', 'Critical Dual-Tone')}
          className="px-2.5 py-1.5 rounded-xl text-xs font-space font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300/80 shadow-2xs transition-all duration-150 flex items-center gap-1.5 cursor-pointer active:scale-95"
          title="Instantly audition SCADA industrial alarm chime"
        >
          <span className="text-sm animate-pulse">🔊</span>
          <span className="hidden sm:inline">Test Alarm</span>
        </button>

        {/* Mute & Audio Control Center Popover Trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-2 rounded-xl text-xs transition border flex items-center gap-1.5 cursor-pointer font-manrope ${
            audioState.isMuted
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-200'
              : audioState.isSirenActive
              ? 'bg-rose-500 text-white border-rose-600 shadow-md animate-bounce'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 shadow-2xs'
          }`}
          title="SCADA Acoustic Alarm Center"
        >
          <span className="text-sm">
            {audioState.isMuted ? '🔇' : audioState.isSirenActive ? '🚨' : '🔔'}
          </span>
          <span className="hidden xl:inline text-[11px] font-bold font-space">
            {audioState.isMuted
              ? 'Muted'
              : audioState.isSirenActive
              ? 'SIREN ACTIVE'
              : 'Alarm Active'}
          </span>
        </button>
      </div>

      {/* Frosted SCADA Alarm Control Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl p-4 z-50 animate-fadeIn font-manrope">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                📢
              </div>
              <div>
                <h4 className="text-xs font-space font-bold text-slate-900">
                  SCADA Acoustic Alarm Center
                </h4>
                <p className="text-[10px] text-slate-500 font-mono">
                  Web Audio Synthesizer • Low Latency
                </p>
              </div>
            </div>
            <button
              onClick={() => scadaAudio.toggleMute()}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition ${
                audioState.isMuted
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {audioState.isMuted ? 'Unmute' : 'Mute'}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="py-3 border-b border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-600 font-medium">Master Alarm Volume</span>
              <span className="font-mono font-bold text-slate-900">
                {Math.round(audioState.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={audioState.volume}
              onChange={(e) => scadaAudio.setVolume(parseFloat(e.target.value))}
              disabled={audioState.isMuted}
              className="w-full accent-sky-500 cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Audition Preset Chimes */}
          <div className="py-3 border-b border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 font-space">
              Audition SCADA Sound Profiles
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTestTone('critical', 'Critical Dual-Tone')}
                className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-rose-800 text-left transition cursor-pointer active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-space">🚨 Critical Dual-Tone</span>
                  <span className="text-[10px] text-rose-600 font-mono">880/659Hz</span>
                </div>
                <p className="text-[10px] text-rose-600/90 mt-0.5">Two-tone farm hazard</p>
              </button>

              <button
                onClick={() => handleTestTone('siren', 'Emergency Klaxon')}
                className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/80 text-amber-800 text-left transition cursor-pointer active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-space">📢 Klaxon Sweep</span>
                  <span className="text-[10px] text-amber-600 font-mono">Warble</span>
                </div>
                <p className="text-[10px] text-amber-600/90 mt-0.5">Pulsing siren horn</p>
              </button>

              <button
                onClick={() => handleTestTone('warning', 'Warning Alert')}
                className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/60 hover:bg-sky-100/80 text-sky-800 text-left transition cursor-pointer active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-space">⚠️ Warning Pulse</span>
                  <span className="text-[10px] text-sky-600 font-mono">554Hz</span>
                </div>
                <p className="text-[10px] text-sky-600/90 mt-0.5">Cautionary telemetry</p>
              </button>

              <button
                onClick={() => handleTestTone('info', 'Affirmative Ping')}
                className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 text-left transition cursor-pointer active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-space">ℹ️ SCADA Ping</span>
                  <span className="text-[10px] text-emerald-600 font-mono">1046Hz</span>
                </div>
                <p className="text-[10px] text-emerald-600/90 mt-0.5">Telemetry confirmation</p>
              </button>
            </div>
            {lastPlayedTone && (
              <p className="text-center text-[11px] font-mono text-emerald-600 font-bold mt-2 animate-fadeIn">
                Playing tone: {lastPlayedTone} ✓
              </p>
            )}
          </div>

          {/* Continuous Emergency Siren Control */}
          <div className="pt-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-space font-bold text-slate-900 block">
                Continuous Klaxon Alarm
              </span>
              <span className="text-[10px] text-slate-500">
                Auto-silences after 15s
              </span>
            </div>
            <button
              onClick={handleToggleSiren}
              className={`px-3 py-1.5 rounded-xl text-xs font-space font-bold transition cursor-pointer flex items-center gap-1.5 ${
                audioState.isSirenActive
                  ? 'bg-rose-600 text-white animate-pulse shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{audioState.isSirenActive ? '⏹ Stop Siren' : '▶ Start Siren'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
