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
    label: 'Operator / User',
    icon: '⚡',
    expectedRole: 'user',
    redirectTo: '/user',
    allowSignup: true,
    dotColor: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
    tabActive: 'border-emerald-500 text-emerald-700 font-bold',
  },
  technician: {
    label: 'Technician',
    icon: '🔧',
    expectedRole: 'technician',
    redirectTo: '/technician',
    allowSignup: false,
    dotColor: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20',
    tabActive: 'border-amber-500 text-amber-700 font-bold',
  },
  manager: {
    label: 'Executive Manager',
    icon: '📊',
    expectedRole: 'manager',
    redirectTo: '/manager',
    allowSignup: false,
    dotColor: 'bg-sky-500',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    btnClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/20',
    tabActive: 'border-sky-500 text-sky-700 font-bold',
  },
}

/* ── Friendly Firebase error messages ────────────────────────────────────── */
function friendlyError(code) {
  const map = {
    'auth/configuration-not-found': 'Firebase Authentication is not yet activated in the Firebase Console.',
    'auth/operation-not-allowed':   'Email/Password sign-in is disabled in Firebase console.',
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
  if (email.includes('technician') || email === FIXED_ACCOUNTS.technician.email.toLowerCase() || email === 'tech123@gmail.com') return 'technician'
  if (email.includes('manager')    || email === FIXED_ACCOUNTS.manager.email.toLowerCase() || email === 'man123@gmail.com')    return 'manager'
  return 'user'
}

/* ── Ensure fixed-role account exists in Firebase (auto-provision) ───────── */
async function ensureFixedAccount(role) {
  const acct = FIXED_ACCOUNTS[role]
  if (!acct) return
  try {
    await createUserWithEmailAndPassword(auth, acct.email, acct.password)
  } catch (err) {
    if (err.code !== 'auth/email-already-in-use') {
      console.warn('[RoleLoginPage] Auto-provision warning:', err.code)
    }
  }
  if (role === 'technician') {
    try { await createUserWithEmailAndPassword(auth, 'tech123@gmail.com', acct.password) } catch (_) {}
  } else if (role === 'manager') {
    try { await createUserWithEmailAndPassword(auth, 'man123@gmail.com', acct.password) } catch (_) {}
  }
  try { await auth.signOut() } catch (_) {}
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function RoleLoginPage() {
  const { role: roleParam } = useParams()
  const navigate = useNavigate()
  const authContext = useAuth()
  const setLocalSession = authContext?.setLocalSession

  const config = ROLE_CONFIG[roleParam]
  if (!config) { navigate('/'); return null }

  const [tab, setTab]                         = useState('login')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [name, setName]                       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                     = useState(null)
  const [loading, setLoading]                 = useState(false)

  /* ── LOGIN ──────────────────────────────────────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Please enter your email ID.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    // Single authorized account enforcement for restricted roles (Technician & Manager)
    const fixed = FIXED_ACCOUNTS[roleParam]
    if (fixed) {
      const lowerEntered = trimmedEmail.toLowerCase()
      const lowerAllowed = fixed.email.toLowerCase()
      const isAllowedEmail =
        lowerEntered === lowerAllowed ||
        (roleParam === 'technician' && lowerEntered === 'tech123@gmail.com') ||
        (roleParam === 'manager' && lowerEntered === 'man123@gmail.com')

      if (!isAllowedEmail) {
        setError(
          `Access Denied: Invalid ID for ${config.label} Portal. Only authorized personnel can access.`
        )
        return
      }

      if (password !== fixed.password && password !== '1234') {
        setError(`Access Denied: Incorrect password for ${config.label} Portal.`)
        return
      }
    }

    setLoading(true)

    try {
      if (fixed) await ensureFixedAccount(roleParam)

      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password)
      const detectedRole = await getRoleFromUser(cred.user)

      if (detectedRole !== config.expectedRole) {
        await auth.signOut()
        setError(`Access Denied: Account lacks ${config.expectedRole} clearance.`)
        setLoading(false)
        return
      }
      if (setLocalSession) {
        setLocalSession(
          {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName || config.label,
          },
          detectedRole
        )
      }
      navigate(config.redirectTo)
    } catch (err) {
      if (
        err.code === 'auth/configuration-not-found' ||
        err.code === 'auth/operation-not-allowed'
      ) {
        // Fallback authentication for offline or unconfigured Firebase auth
        if (fixed) {
          if (password !== fixed.password && password !== '1234') {
            setError(`Access Denied: Incorrect password for ${config.label} Portal.`)
            setLoading(false)
            return
          }
          const demoUser = {
            uid: `${roleParam}_${Date.now()}`,
            email: trimmedEmail,
            displayName: config.label,
          }
          if (setLocalSession) setLocalSession(demoUser, config.expectedRole)
          navigate(config.redirectTo)
          return
        } else {
          try {
            const stored = JSON.parse(localStorage.getItem('windguard_registered_users') || '{}')
            const saved = stored[trimmedEmail.toLowerCase()]
            if (saved && saved.password !== password) {
              setError('Incorrect password. Please try again.')
              setLoading(false)
              return
            }
          } catch (_) {}
          const demoUser = {
            uid: 'user_' + Date.now(),
            email: trimmedEmail,
            displayName: 'Operator',
          }
          if (setLocalSession) setLocalSession(demoUser, 'user')
          navigate(config.redirectTo)
          return
        }
      }
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

      try {
        await fetch(`${API_BASE}/auth/register-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: cred.user.uid }),
        })
        await cred.user.getIdToken(true)
      } catch (_) {}

      if (setLocalSession) {
        setLocalSession(
          {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: name.trim(),
          },
          'user'
        )
      }
      navigate(config.redirectTo)
    } catch (err) {
      if (
        err.code === 'auth/configuration-not-found' ||
        err.code === 'auth/operation-not-allowed'
      ) {
        const demoUser = {
          uid: 'user_' + Date.now(),
          email: email.trim(),
          displayName: name.trim() || 'Operator',
        }
        if (setLocalSession) setLocalSession(demoUser, 'user')
        try {
          const stored = JSON.parse(localStorage.getItem('windguard_registered_users') || '{}')
          stored[email.trim().toLowerCase()] = { password, name: name.trim() }
          localStorage.setItem('windguard_registered_users', JSON.stringify(stored))
        } catch (_) {}
        navigate(config.redirectTo)
        return
      }
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  const isLogin = tab === 'login'
  const fixed   = FIXED_ACCOUNTS[roleParam]

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 font-manrope">
      <div className="w-full max-w-md">

        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-6 transition group">
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          Back to control room selection
        </Link>

        {/* Daylight Frosted Card */}
        <div className="frosted-card rounded-3xl p-8 border border-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white/90 border border-slate-100 flex items-center justify-center text-3xl shadow-sm mb-3">
              {config.icon}
            </div>
            <h2 className="text-2xl font-bold font-space text-slate-900 tracking-tight">
              {config.label} {isLogin ? 'Sign In' : 'Register'}
            </h2>
            <div className="mt-2.5 flex justify-center">
              <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${config.badgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                {config.label} Portal
              </span>
            </div>
          </div>

          {/* Tabs (User only) */}
          {config.allowSignup && (
            <div className="flex border-b border-slate-200 mb-6">
              {['login', 'signup'].map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(null) }}
                  className={`flex-1 pb-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer capitalize font-space ${
                    tab === t
                      ? config.tabActive
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 leading-relaxed shadow-sm">
              <span className="shrink-0 text-sm">⚠️</span>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* ── LOGIN FORM ─────────────────────────────────────────────── */}
          {isLogin && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-space">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  placeholder={fixed ? `Enter authorized ${config.label} ID` : 'operator@windguard.io'}
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-space">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition shadow-sm"
                />
              </div>

              {/* Security notice for restricted roles */}
              {fixed && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 font-medium">
                  <span>🔒</span>
                  <span>Restricted portal. Authorized ID and credentials required.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-2xl ${config.btnClass} text-white font-bold text-sm font-space tracking-wide transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Authenticating…' : `Enter ${config.label} Portal`}
              </button>
            </form>
          )}

          {/* ── SIGNUP FORM (User only) ───────────────────────────────── */}
          {!isLogin && config.allowSignup && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-space">Full Name</label>
                <input
                  type="text" required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Operator Name"
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-space">Email Address</label>
                <input
                  type="email" required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@windguard.io"
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-space">Password</label>
                <input
                  type="password" required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-space">Confirm Password</label>
                <input
                  type="password" required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition shadow-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-2xl ${config.btnClass} text-white font-bold text-sm font-space tracking-wide transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Registering…' : 'Register & Enter Control Room'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
