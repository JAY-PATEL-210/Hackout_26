import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
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

        {/* Main Routed Content protected by Global Error Boundary */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
          <ErrorBoundary title="Platform System Error">
            <Routes>
              <Route
                path="/"
                element={
                  <ErrorBoundary title="Simulator View Error">
                    <SimulatorPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/user"
                element={
                  <ErrorBoundary title="User Fleet View Error">
                    <UserPanel />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/technician"
                element={
                  <ErrorBoundary title="Technician View Error">
                    <TechnicianPanel />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/manager"
                element={
                  <ErrorBoundary title="Manager View Error">
                    <ManagerPanel />
                  </ErrorBoundary>
                }
              />
              {/* Fallback redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>

        {/* Persistent Footer */}
        <footer className="border-t border-slate-900/80 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
          WindGuard SCADA • Predictive Maintenance Platform • HackOut '26
        </footer>
      </div>
    </BrowserRouter>
  )
}
