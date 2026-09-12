import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'

import LandingPage      from './pages/LandingPage'
import RoleLoginPage    from './pages/RoleLoginPage'
import SimulatorPage    from './pages/SimulatorPage'
import UserPanel        from './pages/UserPanel'
import TechnicianPanel  from './pages/TechnicianPanel'
import ManagerPanel     from './pages/ManagerPanel'
import AiCopilotModal   from './components/AiCopilotModal'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff]/50 to-[#ecfdf5]/40 text-[#0f172a] flex flex-col font-manrope selection:bg-sky-500/20 selection:text-sky-900 relative overflow-x-hidden">
          {/* Ambient blurred daylight color blooms */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            <div className="absolute top-[-10%] left-[10%] w-[650px] h-[550px] rounded-full ambient-glow-sky blur-3xl opacity-75" />
            <div className="absolute top-[35%] right-[-5%] w-[600px] h-[500px] rounded-full ambient-glow-mint blur-3xl opacity-65" />
            <div className="absolute bottom-[5%] left-[15%] w-[500px] h-[450px] rounded-full ambient-glow-amber blur-3xl opacity-45" />
          </div>

          <Navbar />

          <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
            <ErrorBoundary title="Platform Error">
              <Routes>

                {/* ── PUBLIC: Landing page — always shown, never auto-redirects ── */}
                <Route
                  path="/"
                  element={
                    <ErrorBoundary title="Landing Page Error">
                      <LandingPage />
                    </ErrorBoundary>
                  }
                />

                {/* ── PUBLIC: Role-specific login pages ── */}
                <Route
                  path="/login/:role"
                  element={
                    <ErrorBoundary title="Login Error">
                      <RoleLoginPage />
                    </ErrorBoundary>
                  }
                />

                {/* ── PUBLIC: Simulator — no auth required ── */}
                <Route
                  path="/simulator"
                  element={
                    <ErrorBoundary title="Simulator Error">
                      <SimulatorPage />
                    </ErrorBoundary>
                  }
                />

                {/* ── PROTECTED: User dashboard ── */}
                <Route
                  path="/user"
                  element={
                    <ErrorBoundary title="User Dashboard Error">
                      <ProtectedRoute requiredRole="user">
                        <UserPanel />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  }
                />

                {/* ── PROTECTED: Technician dashboard ── */}
                <Route
                  path="/technician"
                  element={
                    <ErrorBoundary title="Technician Dashboard Error">
                      <ProtectedRoute requiredRole="technician">
                        <TechnicianPanel />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  }
                />

                {/* ── PROTECTED: Manager dashboard ── */}
                <Route
                  path="/manager"
                  element={
                    <ErrorBoundary title="Manager Dashboard Error">
                      <ProtectedRoute requiredRole="manager">
                        <ManagerPanel />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  }
                />

                {/* ── Legacy /login redirect → landing ── */}
                <Route path="/login" element={<Navigate to="/" replace />} />

                {/* ── Catch-all ── */}
                <Route path="*" element={<Navigate to="/" replace />} />

              </Routes>
            </ErrorBoundary>
          </main>

          <footer className="relative z-10 border-t border-slate-200/80 bg-white/60 backdrop-blur-md py-4 text-center text-xs text-slate-500 font-manrope">
            WindGuard SCADA • Frosted Industrial Control Room • Renewable Asset Monitoring
          </footer>

          {/* Global AI SCADA Copilot Modal & Trigger */}
          <AiCopilotModal />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
