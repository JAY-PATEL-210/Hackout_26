import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { path: '/', label: 'Simulator', badge: 'Control' },
  { path: '/user', label: 'User View', badge: 'Operator' },
  { path: '/technician', label: 'Technician View', badge: 'Maintenance' },
  { path: '/manager', label: 'Manager View', badge: 'Executive' },
]

export default function Navbar() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-cyan-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">
                  WindGuard
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                  FIRESTORE LIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Predictive Maintenance Platform</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`
                }
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Auth Status & User Controls */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-mono font-bold text-white truncate max-w-[140px]">
                    {user.email}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase font-bold self-end px-1.5 py-0.2 rounded border ${
                      role === 'manager'
                        ? 'text-purple-400 bg-purple-950/60 border-purple-800'
                        : role === 'technician'
                        ? 'text-amber-400 bg-amber-950/60 border-amber-800'
                        : 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
                    }`}
                  >
                    {role || 'User'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
                  title="Log out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 transition shadow-sm"
              >
                Sign In
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
