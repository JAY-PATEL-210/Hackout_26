/**
 * audioAlarm.js
 * 
 * Synthesizes authentic control-room SCADA acoustic chimes using the native
 * browser Web Audio API (zero external audio files or dependencies required).
 */

class AudioManager {
  constructor() {
    this.ctx = null
    this.isMuted = localStorage.getItem('windguard_audio_muted') === 'true'
    this.listeners = new Set()
  }

  initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) {
        this.ctx = new AudioContext()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted
    localStorage.setItem('windguard_audio_muted', String(this.isMuted))
    this.notifyListeners()
    if (!this.isMuted) {
      this.playChime('info')
    }
    return this.isMuted
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notifyListeners() {
    this.listeners.forEach((fn) => fn(this.isMuted))
  }

  /**
   * Plays a synthesized industrial chime:
   * - 'critical': Attention-getting dual tone (880Hz -> 660Hz)
   * - 'warning': Single alert pulse (554Hz)
   * - 'info': Soft affirmative ping (1046Hz)
   */
  playChime(type = 'critical') {
    if (this.isMuted) return
    try {
      this.initContext()
      if (!this.ctx) return

      const now = this.ctx.currentTime

      if (type === 'critical') {
        // High urgency pulse 1
        const osc1 = this.ctx.createOscillator()
        const gain1 = this.ctx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(880, now) // A5
        gain1.gain.setValueAtTime(0.12, now)
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc1.connect(gain1)
        gain1.connect(this.ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.25)

        // High urgency pulse 2
        const osc2 = this.ctx.createOscillator()
        const gain2 = this.ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(659.25, now + 0.15) // E5
        gain2.gain.setValueAtTime(0.15, now + 0.15)
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
        osc2.connect(gain2)
        gain2.connect(this.ctx.destination)
        osc2.start(now + 0.15)
        osc2.stop(now + 0.45)
      } else if (type === 'warning') {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(554.37, now) // C#5
        gain.gain.setValueAtTime(0.08, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(now)
        osc.stop(now + 0.3)
      } else {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1046.5, now) // C6
        gain.gain.setValueAtTime(0.06, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(now)
        osc.stop(now + 0.2)
      }
    } catch (_) {
      // Audio autoplay policy fallback
    }
  }
}

export const scadaAudio = new AudioManager()
