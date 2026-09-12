import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps a route so only authenticated users with the correct role can access it.
 * Redirects to "/" (landing) if unauthenticated or wrong role.
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()

  // While Firebase is resolving auth state, show a minimal spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-xs">Verifying session…</p>
        </div>
      </div>
    )
  }

  // Not logged in → send to role-specific login if requiredRole, otherwise landing
  if (!user) {
    return <Navigate to={requiredRole ? `/login/${requiredRole}` : "/"} replace />
  }

  // Logged in but wrong role → send to the specific role login page
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={`/login/${requiredRole}`} replace />
  }

  return children
}
