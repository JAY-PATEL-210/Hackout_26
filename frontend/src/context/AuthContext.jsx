import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../firebase/config'

const AuthContext = createContext(null)

/**
 * Determines a user's role using custom claims first, then email-based fallback.
 * This ensures the hackathon demo works even without a service-account key
 * (i.e., custom claims can't be set server-side without serviceAccountKey.json).
 */
function deriveRole(user, claims) {
  // 1. Honour custom claims if present
  if (claims?.role) return claims.role

  // 2. Email-based fallback for provisioned accounts
  const email = user?.email?.toLowerCase() || ''
  if (email === 'technician@windguard.io' || email.includes('technician') || email === 'tech123@gmail.com') return 'technician'
  if (email === 'manager@windguard.io'    || email.includes('manager')    || email === 'man123@gmail.com')    return 'manager'

  // 3. Everything else is a regular user
  return 'user'
}

export function AuthProvider({ children }) {
  // Initialize from localStorage if available (for demo fallback or quick reload)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('windguard_user_session')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [role, setRole] = useState(() => {
    try {
      return localStorage.getItem('windguard_user_role') || null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        try {
          const tokenResult = await currentUser.getIdTokenResult(true)
          const detected = deriveRole(currentUser, tokenResult.claims)
          setRole(detected)
          localStorage.setItem('windguard_user_role', detected)
        } catch {
          const detected = deriveRole(currentUser, {})
          setRole(detected)
          localStorage.setItem('windguard_user_role', detected)
        }
        try {
          localStorage.setItem(
            'windguard_user_session',
            JSON.stringify({
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
            })
          )
        } catch (_) {}
      }
    })
    return () => unsubscribe()
  }, [])

  const setLocalSession = (userObj, roleStr) => {
    setUser(userObj)
    setRole(roleStr)
    try {
      localStorage.setItem('windguard_user_session', JSON.stringify(userObj))
      localStorage.setItem('windguard_user_role', roleStr)
    } catch (_) {}
  }

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const logout = async () => {
    try { await signOut(auth) } catch (_) {}
    setUser(null)
    setRole(null)
    try {
      localStorage.removeItem('windguard_user_session')
      localStorage.removeItem('windguard_user_role')
    } catch (_) {}
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, setLocalSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
