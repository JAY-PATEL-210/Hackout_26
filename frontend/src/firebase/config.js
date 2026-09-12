import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyALhDfQh3ekvWgnTmfPIZMb9zrj1Ytur28',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'hackout-26.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'hackout-26',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'hackout-26.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '70364416083',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:70364416083:web:4037c680d5ef97f3639ea6',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-Z7WN4XVB7K',
}

// Initialize Firebase (singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const db = getFirestore(app)
const auth = getAuth(app)

export { app, db, auth, firebaseConfig }
