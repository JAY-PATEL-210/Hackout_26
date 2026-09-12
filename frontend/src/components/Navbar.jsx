import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/')  // Always return to landing page on sign-out
  }

  // Role → nav destination after login
  const roleDashboard = {
    user: '/user',
    technician: '/technician',
    manager: '/manager',
  }

  const isOnLanding = location.pathname === '/'
  const isOnSimulator = location.pathname === '/simulator'

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">WindGuard</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                  SCADA
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Predictive Maintenance</p>
            </div>
          </NavLink>

          {/* Nav links — only show dashboard link when logged in */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink
              to="/simulator"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                  isActive
                    ? 'bg-slate-700/40 text-slate-200 border-slate-600'
                    : 'text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-800'
                }`
              }
            >
              🖥️ Simulator
            </NavLink>

            {user && role && roleDashboard[role] && (
              <NavLink
                to={roleDashboard[role]}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/60'
                  }`
                }
              >
                {role === 'user' && '👤'}
                {role === 'technician' && '🔧'}
                {role === 'manager' && '📊'}
                {' '}{role.charAt(0).toUpperCase() + role.slice(1)} Dashboard
              </NavLink>
            )}
          </nav>

          {/* Auth section */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-mono font-bold text-white truncate max-w-[150px]">
                    {user.displayName || user.email}
                  </span>
                  <span className={`text-[10px] font-mono uppercase font-bold self-end px-1.5 rounded border ${
                    role === 'manager'
                      ? 'text-violet-400 bg-violet-950/60 border-violet-800'
                      : role === 'technician'
                      ? 'text-amber-400 bg-amber-950/60 border-amber-800'
                      : 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
                  }`}>
                    {role || 'user'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/60 transition cursor-pointer"
                  title="Log out"
                >
                  Log Out
                </button>
              </div>
            ) : (
              !isOnLanding && (
                <NavLink
                  to="/"
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 transition shadow-sm"
                >
                  Select Role
                </NavLink>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
