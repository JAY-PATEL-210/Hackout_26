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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
          <Navbar />

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
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

          <footer className="border-t border-slate-900/80 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
            WindGuard SCADA • Predictive Maintenance Platform • HackOut '26
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
