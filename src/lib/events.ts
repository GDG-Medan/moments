import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDb, type EventDoc, type MemberDoc } from './firebase'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export function normalizeEventCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  // New rooms use 4-char codes; keep longer IDs for legacy rooms.
  return cleaned
}

export function isValidEventCode(code: string): boolean {
  return code.length === 4 || code.length >= 16
}

export function generateEventCode(): string {
  let code = ''
  for (let i = 0; i < 4; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]!
  }
  return code
}

async function allocateEventCode(): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const code = generateEventCode()
    const snap = await getDoc(doc(getDb(), 'events', code))
    if (!snap.exists()) return code
  }
  throw new Error('Could not allocate a unique event code. Try again.')
}

export async function createEvent(params: {
  title: string
  organizerUid: string
  displayName: string
}): Promise<string> {
  const title = params.title.trim()
  if (!title) throw new Error('Event title is required')

  const code = await allocateEventCode()
  const eventData: EventDoc = {
    title,
    slug: slugify(title) || 'event',
    organizer_uid: params.organizerUid,
    twibbon_path: '/twibbon/gdg-medan.svg',
    created_at: Date.now(),
    is_active: true,
  }

  await setDoc(doc(getDb(), 'events', code), eventData)
  const member: MemberDoc = {
    display_name: params.displayName,
    joined_at: Date.now(),
    role: 'organizer',
  }
  await setDoc(doc(getDb(), 'events', code, 'members', params.organizerUid), member)
  return code
}

export async function joinEvent(params: {
  eventId: string
  uid: string
  displayName: string
}): Promise<void> {
  const eventId = normalizeEventCode(params.eventId)
  if (!isValidEventCode(eventId)) throw new Error('Enter a 4-character event code')

  const eventSnap = await getDoc(doc(getDb(), 'events', eventId))
  if (!eventSnap.exists()) throw new Error('Event not found')

  const memberRef = doc(getDb(), 'events', eventId, 'members', params.uid)
  const existing = await getDoc(memberRef)
  if (existing.exists()) {
    await setDoc(memberRef, { display_name: params.displayName }, { merge: true })
    return
  }

  const event = eventSnap.data() as EventDoc
  const member: MemberDoc = {
    display_name: params.displayName,
    joined_at: Date.now(),
    role: event.organizer_uid === params.uid ? 'organizer' : 'member',
  }
  await setDoc(memberRef, member)
}
