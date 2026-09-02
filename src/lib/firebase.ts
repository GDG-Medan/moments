import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFunctions, type Functions } from 'firebase/functions'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.appId,
)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null
let functions: Functions | null = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app)
  const region = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string) || 'us-central1'
  functions = getFunctions(app, region)
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase is not configured. Copy .env.example to .env and fill values.')
  return auth
}

export function getDb(): Firestore {
  if (!db) throw new Error('Firebase is not configured. Copy .env.example to .env and fill values.')
  return db
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) throw new Error('Firebase is not configured. Copy .env.example to .env and fill values.')
  return storage
}

export function getFirebaseFunctions(): Functions {
  if (!functions) throw new Error('Firebase is not configured. Copy .env.example to .env and fill values.')
  return functions
}

export type EventDoc = {
  title: string
  slug: string
  organizer_uid: string
  twibbon_path: string
  created_at: number
  is_active: boolean
}

export type MemberDoc = {
  display_name: string
  joined_at: number
  role: 'organizer' | 'member'
}

export type MomentDoc = {
  author_uid: string
  author_name: string
  media_url: string
  media_type: 'photo' | 'video'
  thumb_url: string | null
  caption: string
  hashtags: string[]
  twibbon_applied: boolean
  rating_sum: number
  rating_count: number
  is_highlight?: boolean
  ai_note?: string
  created_at: number
}

export type UserDoc = {
  display_name: string
  points: number
  created_at: number
}
