import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Listen to auth state changes and extract role claim
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        try {
          // Force refresh token to get latest custom claims
          const tokenResult = await currentUser.getIdTokenResult(true)
          const customRole = tokenResult.claims?.role

          // Fallback based on email if custom claim is not yet assigned
          const detectedRole =
            customRole ||
            (currentUser.email?.includes('tech')
              ? 'technician'
              : currentUser.email?.includes('manager')
              ? 'manager'
              : 'user')

          setRole(detectedRole)
        } catch (err) {
          console.error('[AuthContext] Error getting token claims:', err)
          setRole('user')
        }
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password)
  }

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
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
