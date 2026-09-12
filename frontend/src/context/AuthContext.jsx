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
  if (email === 'technician@windguard.io' || email.includes('technician')) return 'technician'
  if (email === 'manager@windguard.io'    || email.includes('manager'))    return 'manager'

  // 3. Everything else is a regular user
  return 'user'
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [role, setRole]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        try {
          const tokenResult = await currentUser.getIdTokenResult(true)
          setRole(deriveRole(currentUser, tokenResult.claims))
        } catch {
          setRole(deriveRole(currentUser, {}))
        }
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const logout = async () => {
    await signOut(auth)
    setUser(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
