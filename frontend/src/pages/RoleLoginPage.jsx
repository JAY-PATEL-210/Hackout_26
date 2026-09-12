import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

const API_BASE = 'http://127.0.0.1:8000'

/* ── Role config ─────────────────────────────────────────────────────────── */
const ROLE_CONFIG = {
  user: {
    label: 'User',
    icon: '👤',
    expectedRole: 'user',
    redirectTo: '/user',
    allowSignup: true,
    fixedEmail: null,
    fixedPassword: null,
    accent: 'cyan',
    borderClass: 'border-emerald-500/30',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    btnClass: 'from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500',
    tabActive: 'border-emerald-400 text-emerald-300',
  },
  technician: {
    label: 'Technician',
    icon: '🔧',
    expectedRole: 'technician',
    redirectTo: '/technician',
    allowSignup: false,
    hint: { email: 'tech123@gmail.com', password: '1234' },
    accent: 'amber',
    borderClass: 'border-amber-500/30',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    btnClass: 'from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500',
    tabActive: 'border-amber-400 text-amber-300',
  },
  manager: {
    label: 'Manager',
    icon: '📊',
    expectedRole: 'manager',
    redirectTo: '/manager',
    allowSignup: false,
    hint: { email: 'man123@gmail.com', password: '1234' },
    accent: 'violet',
    borderClass: 'border-violet-500/30',
    badgeClass: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    btnClass: 'from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500',
    tabActive: 'border-violet-400 text-violet-300',
  },
}

/* ── Friendly Firebase error messages ───────────────────────────────────── */
function friendlyError(code) {
  const map = {
    'auth/invalid-credential': 'Incorrect email or password. Please try again.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/user-not-found': 'No account found with that email address.',
    'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  }
  return map[code] || 'Authentication failed. Please check your credentials.'
}

export default function RoleLoginPage() {
  const { role: roleParam } = useParams()
  const navigate = useNavigate()
  const { } = useAuth()

  const config = ROLE_CONFIG[roleParam]

  // Redirect to landing if unknown role
  if (!config) {
    navigate('/')
    return null
  }

  const [tab, setTab] = useState('login')   // 'login' | 'signup'
  const [email, setEmail] = useState(config.hint?.email || '')
  const [password, setPassword] = useState(config.hint?.password || '')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  /* ── Get role from token claims or email fallback ──────────────────────── */
  const getRoleFromUser = async (firebaseUser) => {
    try {
      const tokenResult = await firebaseUser.getIdTokenResult(true)
      return tokenResult.claims?.role || emailFallbackRole(firebaseUser.email)
    } catch {
      return emailFallbackRole(firebaseUser.email)
    }
  }

  const emailFallbackRole = (email) => {
    if (!email) return 'user'
    const e = email.toLowerCase()
    if (e.includes('tech') || e === 'tech123@gmail.com') return 'technician'
    if (e.includes('man') || e === 'man123@gmail.com') return 'manager'
    return 'user'
  }

  /* ── LOGIN ──────────────────────────────────────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      const detectedRole = await getRoleFromUser(cred.user)

      if (detectedRole !== config.expectedRole) {
        await auth.signOut()
        setError(`This account has role "${detectedRole}", not "${config.expectedRole}". Please use the correct login page.`)
        setLoading(false)
        return
      }
      navigate(config.redirectTo)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  /* ── SIGN UP (User only) ────────────────────────────────────────────────── */
  const handleSignup = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }

    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: name.trim() })

      // Call backend to set custom claim role="user"
      try {
        await fetch(`${API_BASE}/auth/register-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: cred.user.uid }),
        })
        // Force token refresh to pick up the new claim
        await cred.user.getIdToken(true)
      } catch {
        // Backend may not have service account key — silently continue
        // Email-based fallback in AuthContext will assign role="user"
      }

      navigate(config.redirectTo)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  const isLogin = tab === 'login'

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md space-y-0">

        {/* Back to landing */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6 transition group">
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          Back to role selection
        </Link>

        {/* Card */}
        <div className={`bg-slate-900/90 border ${config.borderClass} rounded-3xl p-8 backdrop-blur-xl shadow-2xl`}>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">{config.icon}</div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {config.label} {isLogin ? 'Log In' : 'Sign Up'}
            </h2>
            <span className={`inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${config.badgeClass}`}>
              {config.label} Portal
            </span>
          </div>

          {/* Tabs (only for User role) */}
          {config.allowSignup && (
            <div className="flex border-b border-slate-800 mb-6">
              {['login', 'signup'].map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(null) }}
                  className={`flex-1 pb-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer capitalize ${
                    tab === t
                      ? `${config.tabActive} border-b-2`
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Credential hint for fixed-account roles */}
          {config.hint && (
            <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 space-y-0.5">
              <p className="font-semibold text-slate-300 mb-1">Demo credentials:</p>
              <p>Email: <span className="font-mono text-white">{config.hint.email}</span></p>
              <p>Password: <span className="font-mono text-white">{config.hint.password}</span></p>
            </div>
          )}

          {/* LOGIN FORM */}
          {isLogin && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email" required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password" required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full mt-2 py-3 rounded-xl bg-gradient-to-r ${config.btnClass} text-white font-bold text-sm tracking-wide transition shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Signing in…' : `Log In as ${config.label}`}
              </button>
            </form>
          )}

          {/* SIGNUP FORM (User only) */}
          {!isLogin && config.allowSignup && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text" required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email" required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password" required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password" required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full mt-2 py-3 rounded-xl bg-gradient-to-r ${config.btnClass} text-white font-bold text-sm tracking-wide transition shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Creating account…' : 'Create Account & Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
