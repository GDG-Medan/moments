/**
 * Optional demo seed — run after Firebase Admin credentials are available.
 *
 * Usage (from moments/):
 *   set GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json
 *   node scripts/seed-demo.mjs
 *
 * Creates one active demo event titled "GDG Moments Demo Room".
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(resolve(process.cwd(), 'functions/package.json'))
const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const keyPath = resolve(process.cwd(), 'serviceAccount.json')
if (!existsSync(keyPath)) {
  console.error('Missing serviceAccount.json in moments/. Download from Firebase console.')
  process.exit(1)
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))),
  })
}

const db = getFirestore()
const organizerUid = process.env.DEMO_ORGANIZER_UID || 'demo-organizer'

const eventRef = await db.collection('events').add({
  title: 'GDG Moments Demo Room',
  slug: 'gdg-moments-demo-room',
  organizer_uid: organizerUid,
  twibbon_path: '/twibbon/gdg-medan.svg',
  created_at: Date.now(),
  is_active: true,
})

await db.doc(`events/${eventRef.id}/members/${organizerUid}`).set({
  display_name: 'Demo Organizer',
  joined_at: Date.now(),
  role: 'organizer',
})

console.log('Seeded demo event:', eventRef.id)
console.log(`Join path: /e/${eventRef.id}`)
