import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { suggestHighlights, type HighlightSuggestion } from '../lib/ai'
import { normalizeEventCode, isValidEventCode } from '../lib/events'
import { getDb, type EventDoc, type MomentDoc, type UserDoc } from '../lib/firebase'
import { averageRating } from '../lib/points'
import { markHighlight } from '../lib/ratings'
import { NavButton } from '../components/NavButton'
import { RatingStars } from '../components/RatingStars'
import { ShareExport } from '../components/ShareExport'

type Props = {
  user: User
  profile: UserDoc
  onPointsMaybeChanged: () => void
}

const COLLAGE_SPAN = [
  'sm:col-span-2 sm:row-span-2',
  'sm:col-span-1 sm:row-span-1',
  'sm:col-span-1 sm:row-span-2',
  'sm:col-span-1 sm:row-span-1',
  'sm:col-span-2 sm:row-span-1',
  'sm:col-span-1 sm:row-span-1',
  'sm:col-span-1 sm:row-span-1',
  'sm:col-span-2 sm:row-span-1',
]

export function HighlightsPage({ user, profile, onPointsMaybeChanged }: Props) {
  const params = useParams()
  const eventId = normalizeEventCode(params.eventId ?? '')
  const [event, setEvent] = useState<EventDoc | null>(null)
  const [moments, setMoments] = useState<Array<{ id: string; data: MomentDoc }>>([])
  const [suggestions, setSuggestions] = useState<HighlightSuggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isValidEventCode(eventId)) {
      setError('Invalid event code')
      return
    }
    void (async () => {
      const snap = await getDoc(doc(getDb(), 'events', eventId))
      if (!snap.exists()) {
        setError('Event not found')
        return
      }
      const data = snap.data() as EventDoc
      setEvent(data)
      if (data.organizer_uid !== user.uid) {
        setError('Only the organizer can open highlights.')
        return
      }
      const q = query(
        collection(getDb(), 'events', eventId, 'moments'),
        orderBy('created_at', 'desc'),
      )
      const docs = await getDocs(q)
      setMoments(docs.docs.map((d) => ({ id: d.id, data: d.data() as MomentDoc })))
    })()
  }, [eventId, user.uid])

  async function runSuggest() {
    if (!eventId) return
    setBusy(true)
    setError(null)
    try {
      const result = await suggestHighlights(eventId)
      setSuggestions(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Highlight suggestion failed')
    } finally {
      setBusy(false)
    }
  }

  async function promote(momentId: string, reason: string) {
    await markHighlight({ eventId, momentId, aiNote: reason })
    onPointsMaybeChanged()
    setMoments((prev) =>
      prev.map((m) =>
        m.id === momentId ? { ...m, data: { ...m.data, is_highlight: true, ai_note: reason } } : m,
      ),
    )
  }

  if (error && !event) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <div className="mt-4 flex justify-center">
          <NavButton to="/">← Home</NavButton>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <p className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">Loading highlights…</p>
    )
  }

  const ranked = [...moments].sort((a, b) => {
    const avgA = averageRating(a.data.rating_sum, a.data.rating_count)
    const avgB = averageRating(b.data.rating_sum, b.data.rating_count)
    if (avgB !== avgA) return avgB - avgA
    return b.data.rating_count - a.data.rating_count
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap gap-2">
        <NavButton to={`/e/${eventId}`}>← Back to event</NavButton>
        <NavButton to="/">← Home</NavButton>
      </div>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50">Amplify highlights</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        {event.title} · Organizer {profile.display_name}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={runSuggest}
          disabled={busy}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {busy ? 'Asking Gemini…' : 'Suggest top moments with Gemini'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {suggestions.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">AI suggestions</h2>
          {suggestions.map((s) => {
            const moment = moments.find((m) => m.id === s.moment_id)
            if (!moment) return null
            return (
              <div
                key={s.moment_id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row dark:border-slate-700 dark:bg-slate-900"
              >
                <img
                  src={moment.data.media_url}
                  alt=""
                  className="h-28 w-28 rounded-xl object-cover"
                />
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-slate-900 dark:text-slate-50">{moment.data.author_name}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{s.amplify_caption}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.reason}</p>
                  <ShareExport
                    mediaUrl={moment.data.media_url}
                    caption={s.amplify_caption}
                    hashtags={moment.data.hashtags ?? []}
                  />
                  <button
                    type="button"
                    onClick={() => void promote(s.moment_id, s.reason)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#FFD700] dark:text-slate-900"
                  >
                    Mark as highlight (+points)
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Community collage
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Full photos in a compact mixed-ratio collage
        </p>
        <div className="mt-4 grid auto-rows-[7rem] grid-cols-2 gap-2 sm:auto-rows-[9rem] sm:grid-cols-4">
          {ranked.slice(0, 8).map((item, index) => {
            const avg = averageRating(item.data.rating_sum, item.data.rating_count)
            return (
              <div
                key={item.id}
                className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 ${COLLAGE_SPAN[index % COLLAGE_SPAN.length]}`}
              >
                <img
                  src={item.data.media_url}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2">
                  <p className="truncate text-xs font-medium text-white">{item.data.author_name}</p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <RatingStars value={avg} readOnly size="sm" />
                    <span className="text-[10px] text-white/80">
                      {avg > 0 ? avg.toFixed(1) : '—'} · {item.data.rating_count}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
