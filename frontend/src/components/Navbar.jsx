import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { scadaAudio } from '../utils/audioAlarm'

export default function Navbar() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const [isMuted, setIsMuted] = useState(scadaAudio.isMuted)

  useEffect(() => {
    const unsub = scadaAudio.subscribe((muted) => setIsMuted(muted))
    return unsub
  }, [])

  const roleDashboard = {
    user: '/user',
    technician: '/technician',
    manager: '/manager',
  }

  const isOnLanding = location.pathname === '/'

  return (
    <header className="sticky top-0 z-50 frosted-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand Logo & Name */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-sky-600 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-space font-bold text-[#0f172a] text-base tracking-tight">
                  WindGuard
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 font-mono tracking-wider">
                  SCADA
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-manrope">
                Renewable Energy Control Room
              </p>
            </div>
          </NavLink>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            <NavLink
              to="/simulator"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border font-manrope ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 border-sky-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
                }`
              }
            >
              <span>🖥️</span>
              <span>SCADA Simulator</span>
            </NavLink>

            {user && role && roleDashboard[role] && (
              <NavLink
                to={roleDashboard[role]}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border font-manrope ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
                  }`
                }
              >
                <span>{role === 'user' ? '👤' : role === 'technician' ? '🔧' : '📊'}</span>
                <span>{role.charAt(0).toUpperCase() + role.slice(1)} Dashboard</span>
              </NavLink>
            )}
          </nav>

          {/* Authentication Status & Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Control-Room Audio Chime Alarm Mute/Unmute */}
            <button
              onClick={() => scadaAudio.toggleMute()}
              className={`p-2 rounded-xl text-xs transition border flex items-center gap-1.5 cursor-pointer font-manrope ${
                isMuted
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-200'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 shadow-2xs'
              }`}
              title={isMuted ? 'SCADA Alarm Chime: Muted (Click to Unmute)' : 'SCADA Alarm Chime: Active (Click to Mute)'}
            >
              <span className="text-sm">{isMuted ? '🔇' : '🔔'}</span>
              <span className="hidden lg:inline text-[11px] font-bold font-space">
                {isMuted ? 'Muted' : 'Alarm Active'}
              </span>
            </button>
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-space font-bold text-[#0f172a] truncate max-w-[160px]">
                    {user.displayName || user.email}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase font-bold self-end px-2 py-0.5 rounded-full border ${
                      role === 'manager'
                        ? 'text-violet-700 bg-violet-50 border-violet-200'
                        : role === 'technician'
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    {role || 'operator'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 transition cursor-pointer"
                  title="Sign out of current session"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              !isOnLanding && (
                <NavLink
                  to="/"
                  className="px-4 py-1.5 text-xs font-space font-bold rounded-xl bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-500/20 transition cursor-pointer"
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
