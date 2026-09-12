import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase/config'

const API_BASE = 'http://127.0.0.1:8000'

/* ─────────────────────────────────────────────────────────────────────────────
   Fixed credentials for pre-provisioned roles.
   Password must be ≥ 6 chars (Firebase requirement).
   These accounts are auto-created in Firebase on first login attempt.
───────────────────────────────────────────────────────────────────────────── */
const FIXED_ACCOUNTS = {
  technician: { email: 'technician@windguard.io', password: 'Tech@123' },
  manager:    { email: 'manager@windguard.io',    password: 'Mgr@1234' },
}

/* ── Role config ──────────────────────────────────────────────────────────── */
const ROLE_CONFIG = {
  user: {
    label: 'User',
    icon: '👤',
    expectedRole: 'user',
    redirectTo: '/user',
    allowSignup: true,
    borderClass: 'border-emerald-500/30',
    badgeClass:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    btnClass:    'from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500',
    tabActive:   'border-emerald-400 text-emerald-300',
  },
  technician: {
    label: 'Technician',
    icon: '🔧',
    expectedRole: 'technician',
    redirectTo: '/technician',
    allowSignup: false,
    borderClass: 'border-amber-500/30',
    badgeClass:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    btnClass:    'from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500',
    tabActive:   'border-amber-400 text-amber-300',
  },
  manager: {
    label: 'Manager',
    icon: '📊',
    expectedRole: 'manager',
    redirectTo: '/manager',
    allowSignup: false,
    borderClass: 'border-violet-500/30',
    badgeClass:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
    btnClass:    'from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500',
    tabActive:   'border-violet-400 text-violet-300',
  },
}

/* ── Friendly Firebase error messages ────────────────────────────────────── */
function friendlyError(code) {
  const map = {
    'auth/invalid-credential':     'Incorrect email or password. Please try again.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/user-not-found':         'Account not found. Please contact your administrator.',
    'auth/email-already-in-use':   'An account with this email already exists. Try logging in.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  }
  return map[code] || 'Authentication failed. Please check your credentials.'
}

/* ── Role from token claims or email pattern ─────────────────────────────── */
async function getRoleFromUser(firebaseUser) {
  try {
    const result = await firebaseUser.getIdTokenResult(true)
    if (result.claims?.role) return result.claims.role
  } catch (_) {}
  const email = firebaseUser.email?.toLowerCase() || ''
  if (email.includes('technician') || email === FIXED_ACCOUNTS.technician.email) return 'technician'
  if (email.includes('manager')    || email === FIXED_ACCOUNTS.manager.email)    return 'manager'
  return 'user'
}

/* ── Ensure fixed-role account exists in Firebase (auto-provision) ───────── */
async function ensureFixedAccount(role) {
  const acct = FIXED_ACCOUNTS[role]
  if (!acct) return
  try {
    // Try creating — if already exists Firebase throws email-already-in-use (fine)
    await createUserWithEmailAndPassword(auth, acct.email, acct.password)
  } catch (err) {
    if (err.code !== 'auth/email-already-in-use') {
      // Unexpected error — log but don't block login attempt
      console.warn('[RoleLoginPage] Auto-provision warning:', err.code)
    }
  }
  // Always sign out after the create attempt so we start fresh
  try { await auth.signOut() } catch (_) {}
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function RoleLoginPage() {
  const { role: roleParam } = useParams()
  const navigate = useNavigate()

  const config = ROLE_CONFIG[roleParam]
  if (!config) { navigate('/'); return null }

  const [tab, setTab]                     = useState('login')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [name, setName]                   = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                 = useState(null)
  const [loading, setLoading]             = useState(false)

  /* ── LOGIN ──────────────────────────────────────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // For fixed-role accounts, use the stored credentials regardless of input
    const fixed = FIXED_ACCOUNTS[roleParam]
    const loginEmail    = fixed ? fixed.email    : email.trim()
    const loginPassword = fixed ? fixed.password : password

    try {
      // Auto-provision the fixed account if it doesn't exist yet
      if (fixed) await ensureFixedAccount(roleParam)

      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword)
      const detectedRole = await getRoleFromUser(cred.user)

      if (detectedRole !== config.expectedRole) {
        await auth.signOut()
        setError(`This account has role "${detectedRole}", not "${config.expectedRole}".`)
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

  /* ── SIGN UP (User only) ─────────────────────────────────────────────────── */
  const handleSignup = async (e) => {
    e.preventDefault()
    setError(null)

    if (!name.trim())           { setError('Please enter your name.');               return }
    if (password.length < 6)    { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.');          return }

    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: name.trim() })

      // Call backend to set custom claim role="user" (graceful fail if no service account)
      try {
        await fetch(`${API_BASE}/auth/register-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: cred.user.uid }),
        })
        await cred.user.getIdToken(true)
      } catch (_) {}

      navigate(config.redirectTo)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  const isLogin = tab === 'login'
  const fixed   = FIXED_ACCOUNTS[roleParam]

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md">

        {/* Back link */}
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

          {/* Tabs (User only) */}
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

          {/* Error message */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── LOGIN FORM ────────────────────────────────────────────────── */}
          {isLogin && (
            <form onSubmit={handleLogin} className="space-y-5">
              {/* For fixed-role portals: no email/password fields shown */}
              {!fixed && (
                <>
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
                </>
              )}

              {/* Fixed-role portal: show a clean one-click button, no input fields */}
              {fixed && (
                <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-4 text-center space-y-1">
                  <p className="text-xs text-slate-400">Signing in as</p>
                  <p className="text-sm font-mono font-bold text-white">{fixed.email}</p>
                  <p className="text-xs text-slate-500">Pre-provisioned {config.label} account</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl bg-gradient-to-r ${config.btnClass} text-white font-bold text-sm tracking-wide transition shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Signing in…' : `Sign In as ${config.label}`}
              </button>
            </form>
          )}

          {/* ── SIGNUP FORM (User only) ───────────────────────────────────── */}
          {!isLogin && config.allowSignup && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text" required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email" required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password" required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Confirm Password</label>
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
                className={`w-full py-3 rounded-xl bg-gradient-to-r ${config.btnClass} text-white font-bold text-sm tracking-wide transition shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
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
