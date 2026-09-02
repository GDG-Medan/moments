import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import { getDb, getFirebaseAuth, isFirebaseConfigured, type UserDoc } from '../lib/firebase'

export type AuthState = {
  user: User | null
  profile: UserDoc | null
  loading: boolean
  configured: boolean
  ensureProfile: (displayName: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserDoc | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const snap = await getDoc(doc(getDb(), 'users', user.uid))
    setProfile(snap.exists() ? (snap.data() as UserDoc) : null)
  }, [user])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }

    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, async (next) => {
      if (!next) {
        try {
          await signInAnonymously(auth)
        } catch (error) {
          console.error(error)
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
        return
      }

      setUser(next)
      const snap = await getDoc(doc(getDb(), 'users', next.uid))
      setProfile(snap.exists() ? (snap.data() as UserDoc) : null)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  async function ensureProfile(displayName: string) {
    if (!user) throw new Error('Not signed in')
    const trimmed = displayName.trim()
    if (!trimmed) throw new Error('Display name is required')

    const ref = doc(getDb(), 'users', user.uid)
    const existing = await getDoc(ref)
    if (existing.exists()) {
      await setDoc(ref, { display_name: trimmed }, { merge: true })
    } else {
      const data: UserDoc = {
        display_name: trimmed,
        points: 0,
        created_at: Date.now(),
      }
      await setDoc(ref, data)
    }
    const snap = await getDoc(ref)
    setProfile(snap.exists() ? (snap.data() as UserDoc) : null)
  }

  return {
    user,
    profile,
    loading,
    configured: isFirebaseConfigured,
    ensureProfile,
    refreshProfile,
  }
}
