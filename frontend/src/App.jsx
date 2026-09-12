import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import SimulatorPage from './pages/SimulatorPage'
import UserPanel from './pages/UserPanel'
import TechnicianPanel from './pages/TechnicianPanel'
import ManagerPanel from './pages/ManagerPanel'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* Top persistent navigation bar */}
        <Navbar />

        {/* Main Routed Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
          <Routes>
            <Route path="/" element={<SimulatorPage />} />
            <Route path="/user" element={<UserPanel />} />
            <Route path="/technician" element={<TechnicianPanel />} />
            <Route path="/manager" element={<ManagerPanel />} />
            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Persistent Footer */}
        <footer className="border-t border-slate-900/80 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
          WindGuard SCADA • Predictive Maintenance Platform • HackOut '26
        </footer>
      </div>
    </BrowserRouter>
  )
}
