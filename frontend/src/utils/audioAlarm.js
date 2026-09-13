/**
 * audioAlarm.js
 * 
 * Synthesizes authentic control-room SCADA acoustic alarms & chimes using the native
 * browser Web Audio API (zero external audio files or network dependencies required).
 */

class AudioManager {
  constructor() {
    this.ctx = null
    this.isMuted = typeof window !== 'undefined' ? localStorage.getItem('windguard_audio_muted') === 'true' : false
    const savedVol = typeof window !== 'undefined' ? localStorage.getItem('windguard_audio_vol') : null
    this.volume = savedVol !== null ? Math.max(0.05, Math.min(1.0, parseFloat(savedVol))) : 0.8
    this.isSirenActive = false
    this.sirenInterval = null
    this.listeners = new Set()

    if (typeof window !== 'undefined') {
      this.setupAutoUnlock()
    }
  }

  setupAutoUnlock() {
    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('pointerdown', unlock, { passive: true, once: true })
    window.addEventListener('keydown', unlock, { passive: true, once: true })
    window.addEventListener('touchstart', unlock, { passive: true, once: true })
  }

  initContext() {
    if (typeof window === 'undefined') return null
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null

    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  setVolume(vol) {
    this.volume = Math.max(0.0, Math.min(1.0, Number(vol)))
    if (typeof window !== 'undefined') {
      localStorage.setItem('windguard_audio_vol', String(this.volume))
    }
    this.notifyListeners()
  }

  toggleMute() {
    this.isMuted = !this.isMuted
    if (typeof window !== 'undefined') {
      localStorage.setItem('windguard_audio_muted', String(this.isMuted))
    }
    if (this.isMuted && this.isSirenActive) {
      this.stopEmergencySiren()
    } else if (!this.isMuted) {
      this.playChime('info')
    }
    this.notifyListeners()
    return this.isMuted
  }

  subscribe(listener) {
    this.listeners.add(listener)
    // Send immediate initial state
    listener({
      isMuted: this.isMuted,
      volume: this.volume,
      isSirenActive: this.isSirenActive,
    })
    return () => this.listeners.delete(listener)
  }

  notifyListeners() {
    const state = {
      isMuted: this.isMuted,
      volume: this.volume,
      isSirenActive: this.isSirenActive,
    }
    this.listeners.forEach((fn) => fn(state))
  }

  /**
   * One-click test function: Unmutes and plays the authentic industrial siren chime immediately.
   */
  testAlarm(type = 'critical') {
    if (this.isMuted) {
      this.isMuted = false
      if (typeof window !== 'undefined') {
        localStorage.setItem('windguard_audio_muted', 'false')
      }
      this.notifyListeners()
    }
    return this.playChime(type)
  }

  /**
   * Continuous repeating emergency klaxon alarm for severe turbine incidents.
   * Auto-shuts off after 15 seconds to prevent operator fatigue.
   */
  startEmergencySiren() {
    if (this.isMuted) {
      this.isMuted = false
      if (typeof window !== 'undefined') {
        localStorage.setItem('windguard_audio_muted', 'false')
      }
    }
    this.isSirenActive = true
    this.notifyListeners()

    // Immediate first burst
    this.playChime('siren')

    clearInterval(this.sirenInterval)
    this.sirenInterval = setInterval(() => {
      if (!this.isSirenActive || this.isMuted) {
        this.stopEmergencySiren()
        return
      }
      this.playChime('siren')
    }, 1200)

    // Safety auto-stop after 15 seconds
    setTimeout(() => {
      if (this.isSirenActive) {
        this.stopEmergencySiren()
      }
    }, 15000)
  }

  stopEmergencySiren() {
    this.isSirenActive = false
    if (this.sirenInterval) {
      clearInterval(this.sirenInterval)
      this.sirenInterval = null
    }
    this.notifyListeners()
  }

  /**
   * Plays a synthesized industrial acoustic profile:
   * - 'critical': High-urgency resonant two-tone alarm (880Hz -> 659Hz + overtone)
   * - 'siren': Rapid-pulsing control-room klaxon horn (sweep 620Hz -> 960Hz)
   * - 'warning': Amber supervisory alert pulse (554Hz)
   * - 'info': Soft affirmative SCADA telemetry ping (1046Hz)
   */
  playChime(type = 'critical') {
    if (this.isMuted || this.volume <= 0) return Promise.resolve(false)

    try {
      const ctx = this.initContext()
      if (!ctx) return Promise.resolve(false)

      const now = ctx.currentTime
      const vol = this.volume

      if (type === 'critical') {
        // High urgency pulse 1 (880 Hz / A5)
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(880, now)
        gain1.gain.setValueAtTime(0.28 * vol, now)
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.32)
        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.32)

        // High urgency pulse 2 (659.25 Hz / E5)
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(659.25, now + 0.16)
        gain2.gain.setValueAtTime(0.32 * vol, now + 0.16)
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.58)
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start(now + 0.16)
        osc2.stop(now + 0.58)

        // High overtone resonance (1318.5 Hz / E6)
        const osc3 = ctx.createOscillator()
        const gain3 = ctx.createGain()
        osc3.type = 'triangle'
        osc3.frequency.setValueAtTime(1318.5, now + 0.20)
        gain3.gain.setValueAtTime(0.12 * vol, now + 0.20)
        gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.62)
        osc3.connect(gain3)
        gain3.connect(ctx.destination)
        osc3.start(now + 0.20)
        osc3.stop(now + 0.62)

      } else if (type === 'siren') {
        // Multi-frequency emergency warble sweep (620Hz -> 960Hz)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(620, now)
        osc.frequency.exponentialRampToValueAtTime(960, now + 0.25)
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.50)

        // Low-pass filter to smooth harshness into authentic horn tone
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(1600, now)

        gain.gain.setValueAtTime(0.24 * vol, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 0.52)

      } else if (type === 'warning') {
        // Double amber pulse (554.37 Hz / C#5)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(554.37, now)
        gain.gain.setValueAtTime(0.22 * vol, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.38)

      } else {
        // Affirmative telemetry ping (1046.5 Hz / C6)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1046.5, now)
        gain.gain.setValueAtTime(0.18 * vol, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.28)
      }

      return Promise.resolve(true)
    } catch (err) {
      console.warn('[audioAlarm] Web Audio API playback note:', err)
      return Promise.resolve(false)
    }
  }
}

export const scadaAudio = new AudioManager()
