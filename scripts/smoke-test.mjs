/**
 * Production smoke test for GDG Moments (Auth → Event → Upload → Caption → Rate → Highlights).
 * Run: node scripts/smoke-test.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  increment,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  }
  return env
}

const env = loadEnv()
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const orgApp = initializeApp(firebaseConfig, 'organizer')
const memApp = initializeApp(firebaseConfig, 'member')

const orgAuth = getAuth(orgApp)
const memAuth = getAuth(memApp)
const orgDb = getFirestore(orgApp)
const memDb = getFirestore(memApp)
const orgStorage = getStorage(orgApp)
const orgFunctions = getFunctions(orgApp, env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1')

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function tinyPng() {
  const b64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  return Buffer.from(b64, 'base64')
}

const results = []

async function step(name, fn) {
  process.stdout.write(`• ${name}... `)
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail })
    console.log('OK' + (detail ? ` (${detail})` : ''))
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) })
    console.log('FAIL')
    console.error('  ', err instanceof Error ? err.message : err)
    throw err
  }
}

let organizer
let member
let eventId
let momentId
let mediaUrl

try {
  await step('Anonymous auth (organizer + member)', async () => {
    const [orgCred, memCred] = await Promise.all([
      signInAnonymously(orgAuth),
      signInAnonymously(memAuth),
    ])
    organizer = orgCred.user
    member = memCred.user
    return `${organizer.uid.slice(0, 6)}/${member.uid.slice(0, 6)}`
  })

  await step('Create user profiles', async () => {
    await setDoc(doc(orgDb, 'users', organizer.uid), {
      display_name: 'Smoke Organizer',
      points: 0,
      created_at: Date.now(),
    })
    await setDoc(doc(memDb, 'users', member.uid), {
      display_name: 'Smoke Member',
      points: 0,
      created_at: Date.now(),
    })
  })

  await step('Create event room', async () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let attempt = 0; attempt < 12; attempt += 1) {
      code = ''
      for (let i = 0; i < 4; i += 1) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)]
      }
      const existing = await getDoc(doc(orgDb, 'events', code))
      if (!existing.exists()) break
    }
    await setDoc(doc(orgDb, 'events', code), {
      title: 'Smoke Test Meetup',
      slug: 'smoke-test-meetup',
      organizer_uid: organizer.uid,
      twibbon_path: '/twibbon/gdg-medan.svg',
      created_at: Date.now(),
      is_active: true,
    })
    eventId = code
    await setDoc(doc(orgDb, 'events', eventId, 'members', organizer.uid), {
      display_name: 'Smoke Organizer',
      joined_at: Date.now(),
      role: 'organizer',
    })
    await setDoc(doc(memDb, 'events', eventId, 'members', member.uid), {
      display_name: 'Smoke Member',
      joined_at: Date.now(),
      role: 'member',
    })
    return eventId
  })

  await step('Upload photo to Storage', async () => {
    const path = `events/${eventId}/moments/${organizer.uid}/${Date.now()}.png`
    const storageRef = ref(orgStorage, path)
    await uploadBytes(storageRef, tinyPng(), { contentType: 'image/png' })
    mediaUrl = await getDownloadURL(storageRef)
    assert(mediaUrl.includes('firebasestorage'), 'unexpected media url')
    return 'uploaded'
  })

  await step('Create moment doc', async () => {
    const momentRef = await addDoc(collection(orgDb, 'events', eventId, 'moments'), {
      author_uid: organizer.uid,
      author_name: 'Smoke Organizer',
      media_url: mediaUrl,
      media_type: 'photo',
      thumb_url: null,
      caption: '',
      hashtags: [],
      twibbon_applied: false,
      rating_sum: 0,
      rating_count: 0,
      created_at: Date.now(),
    })
    momentId = momentRef.id
    await updateDoc(doc(orgDb, 'users', organizer.uid), { points: increment(5) })
    return momentId
  })

  await step('Callable generateCaption (Gemini)', async () => {
    const callable = httpsCallable(orgFunctions, 'generateCaption')
    const res = await callable({
      event_id: eventId,
      moment_id: momentId,
      image_url: mediaUrl,
      event_title: 'Smoke Test Meetup',
    })
    const data = res.data
    assert(data?.caption, 'empty caption')
    assert(Array.isArray(data.hashtags), 'missing hashtags')
    const snap = await getDoc(doc(orgDb, 'events', eventId, 'moments', momentId))
    assert(snap.data()?.caption, 'caption not persisted')
    return String(data.caption).slice(0, 60)
  })

  await step('Peer rating + points', async () => {
    await setDoc(doc(memDb, 'events', eventId, 'moments', momentId, 'ratings', member.uid), {
      score: 5,
      created_at: Date.now(),
    })
    await updateDoc(doc(memDb, 'events', eventId, 'moments', momentId), {
      rating_sum: increment(5),
      rating_count: increment(1),
    })
    await updateDoc(doc(memDb, 'users', organizer.uid), { points: increment(2) })
    const snap = await getDoc(doc(orgDb, 'events', eventId, 'moments', momentId))
    assert(snap.data()?.rating_count === 1, 'rating_count not updated')
    return '5★'
  })

  await step('Callable suggestHighlights (Gemini)', async () => {
    const callable = httpsCallable(orgFunctions, 'suggestHighlights')
    const res = await callable({ event_id: eventId })
    assert(Array.isArray(res.data?.suggestions), 'missing suggestions')
    return `${res.data.suggestions.length} suggestions`
  })

  await step('SPA deep link hosting rewrite', async () => {
    const res = await fetch(`https://gdg-moments.web.app/e/${eventId}`)
    assert(res.ok, `status ${res.status}`)
    const html = await res.text()
    assert(html.includes('root'), 'unexpected html')
    return String(res.status)
  })

  console.log('\nAll smoke checks passed.')
  console.log(`Event: https://gdg-moments.web.app/e/${eventId}`)
  process.exit(0)
} catch {
  console.log('\nSmoke test stopped on failure.')
  console.log(
    results
      .map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
      .join('\n'),
  )
  process.exit(1)
}
