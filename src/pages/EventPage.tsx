import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { EventQrCard } from '../components/EventQrCard'
import { MomentCard } from '../components/MomentCard'
import { MomentUploader } from '../components/MomentUploader'
import { NavButton } from '../components/NavButton'
import { joinEvent, normalizeEventCode, isValidEventCode } from '../lib/events'
import { getDb, type EventDoc, type MomentDoc, type UserDoc } from '../lib/firebase'

type Props = {
  user: User
  profile: UserDoc
  onPointsMaybeChanged: () => void
}

export function EventPage({ user, profile, onPointsMaybeChanged }: Props) {
  const params = useParams()
  const eventId = normalizeEventCode(params.eventId ?? '')
  const [event, setEvent] = useState<(EventDoc & { id: string }) | null>(null)
  const [moments, setMoments] = useState<Array<{ id: string; data: MomentDoc }>>([])
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isValidEventCode(eventId)) {
      setError('Invalid event code')
      setLoading(false)
      return
    }
    let cancelled = false

    async function bootstrap() {
      setLoading(true)
      setError(null)
      try {
        const snap = await getDoc(doc(getDb(), 'events', eventId))
        if (!snap.exists()) {
          setError('Event not found')
          setEvent(null)
          return
        }
        const data = snap.data() as EventDoc
        if (!cancelled) {
          setEvent({ ...data, id: snap.id })
        }
        await joinEvent({
          eventId,
          uid: user.uid,
          displayName: profile.display_name,
        })
        if (!cancelled) setJoined(true)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to join event')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [eventId, user.uid, profile.display_name])

  useEffect(() => {
    if (!eventId || !joined) return
    const q = query(
      collection(getDb(), 'events', eventId, 'moments'),
      orderBy('created_at', 'desc'),
    )
    return onSnapshot(q, (snap) => {
      setMoments(
        snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as MomentDoc,
        })),
      )
    })
  }, [eventId, joined])

  if (loading) {
    return (
      <p className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">Opening event room…</p>
    )
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-red-600 dark:text-red-400">{error || 'Event unavailable'}</p>
        <div className="mt-4 flex justify-center">
          <NavButton to="/">← Home</NavButton>
        </div>
      </div>
    )
  }

  const isOrganizer = event.organizer_uid === user.uid
  const hasContributed = moments.some((m) => m.data.author_uid === user.uid)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <NavButton to="/">← Home</NavButton>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">{event.title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Code <span className="font-mono font-semibold tracking-widest text-[#B45309] dark:text-[#FFD700]">{event.id}</span>
            {' · '}
            {profile.display_name} · {profile.points} pts
            {isOrganizer ? ' · Organizer' : ' · Member'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasContributed && (
            <NavButton to={`/e/${event.id}/find-me`}>Find photos of me →</NavButton>
          )}
          {isOrganizer && (
            <NavButton to={`/e/${event.id}/highlights`}>Highlights →</NavButton>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 lg:order-1">
          <MomentUploader
            eventId={event.id}
            twibbonPath={event.twibbon_path || '/twibbon/gdg-medan.svg'}
            uid={user.uid}
            displayName={profile.display_name}
            onUploaded={() => {
              onPointsMaybeChanged()
            }}
          />
          <EventQrCard eventId={event.id} title={event.title} defaultOpen={isOrganizer} />
        </div>

        <div className="space-y-4 lg:order-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Live moments</h2>
          {moments.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              No moments yet. Be the first to capture the vibe.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {moments.map((item) => (
                <MomentCard
                  key={item.id}
                  eventId={event.id}
                  eventTitle={event.title}
                  momentId={item.id}
                  moment={item.data}
                  currentUid={user.uid}
                  onUpdated={onPointsMaybeChanged}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
