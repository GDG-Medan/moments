import type { User } from 'firebase/auth'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEvent, normalizeEventCode, isValidEventCode } from '../lib/events'
import type { UserDoc } from '../lib/firebase'

type Props = {
  user: User
  profile: UserDoc
}

export function HomePage({ user, profile }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const eventId = await createEvent({
        title,
        organizerUid: user.uid,
        displayName: profile.display_name,
      })
      navigate(`/e/${eventId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setBusy(false)
    }
  }

  function onJoin(e: FormEvent) {
    e.preventDefault()
    const code = normalizeEventCode(joinCode)
    if (code.length !== 4) {
      setError('Enter a 4-character event code')
      return
    }
    if (!isValidEventCode(code)) {
      setError('Enter a 4-character event code')
      return
    }
    navigate(`/e/${code}`)
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-2">
      <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          GDG Moments
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-50">
          Scan. Capture. Amplify.
        </h1>
        <p className="max-w-xl text-lg text-slate-600 dark:text-slate-300">
          Turn live GDG event energy into branded community stories. Members capture moments, Gemini
          writes captions, peers rate contributions, organizers amplify highlights.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Signed in as <span className="font-medium text-slate-800 dark:text-slate-200">{profile.display_name}</span>{' '}
          · {profile.points} pts
        </p>
      </section>

      <section className="space-y-4">
        <form
          onSubmit={onCreate}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Create event room</h2>
          <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="title">
            Event title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            placeholder="GDG Medan Meetup #12"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create room + QR'}
          </button>
        </form>

        <form
          onSubmit={onJoin}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Join with event code</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">4 characters · letters & numbers</p>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(normalizeEventCode(e.target.value))}
            maxLength={4}
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-2xl uppercase tracking-[0.35em] text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            placeholder="GDGX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Join room
          </button>
        </form>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>
    </div>
  )
}
