import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (loginEmail, loginPassword, targetRole) => {
    setError(null)
    setLoading(true)
    try {
      await login(loginEmail, loginPassword)
      // Redirect based on target role
      if (targetRole === 'technician' || loginEmail.includes('tech')) {
        navigate('/technician')
      } else if (targetRole === 'manager' || loginEmail.includes('manager')) {
        navigate('/manager')
      } else {
        navigate('/')
      }
    } catch (err) {
      console.error('[LoginPage] Error:', err)
      setError(err.message || 'Failed to authenticate with Firebase.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    handleLogin(email, password)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-3xl shadow-inner mb-4">
            ⚡
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Predictive Maintenance Platform
          </h2>
          <p className="mt-2 text-xs text-slate-400 font-mono">
            Firebase Authentication & Role-Based Access Control
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Standard Form */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@windfarm.io"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm tracking-wide transition shadow-lg cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Operations Console'}
          </button>
        </form>

        {/* Quick Demo Access Bar */}
        <div className="pt-6 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              1-Click Demo Accounts
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              Hackathon Ready
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleLogin('user@windfarm.io', 'User123!', 'user')}
              className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 text-left transition flex items-center justify-between cursor-pointer group"
            >
              <div>
                <span className="font-bold text-emerald-400 block group-hover:text-emerald-300">
                  👤 Operator (User Role)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">user@windfarm.io</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Routes → /</span>
            </button>

            <button
              type="button"
              onClick={() => handleLogin('technician@windfarm.io', 'Tech123!', 'technician')}
              className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 text-left transition flex items-center justify-between cursor-pointer group"
            >
              <div>
                <span className="font-bold text-amber-400 block group-hover:text-amber-300">
                  🔧 Field Technician Role
                </span>
                <span className="text-[11px] text-slate-500 font-mono">technician@windfarm.io</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Routes → /technician</span>
            </button>

            <button
              type="button"
              onClick={() => handleLogin('manager@windfarm.io', 'Manager123!', 'manager')}
              className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/50 text-left transition flex items-center justify-between cursor-pointer group"
            >
              <div>
                <span className="font-bold text-purple-400 block group-hover:text-purple-300">
                  📊 Operations Manager Role
                </span>
                <span className="text-[11px] text-slate-500 font-mono">manager@windfarm.io</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Routes → /manager</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
