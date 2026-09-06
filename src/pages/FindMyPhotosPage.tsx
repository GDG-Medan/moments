import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { NavButton } from '../components/NavButton'
import { backfillEventFaceIndex, detectFacesFromFile, ensureFaceModels } from '../lib/face-index'
import { matchFacesToDescriptor, type FaceMatchResult } from '../lib/face-match'
import {
  FACE_FIND_CONSENT_VERSION,
  FACE_FIND_PRIVACY_BODY,
  FACE_FIND_PRIVACY_TITLE,
  hasValidFaceFindConsent,
} from '../lib/face-privacy'
import { normalizeEventCode, isValidEventCode } from '../lib/events'
import {
  getDb,
  type EventDoc,
  type FaceDoc,
  type MemberDoc,
  type UserDoc,
} from '../lib/firebase'

type Props = {
  user: User
  profile: UserDoc
}

type Phase = 'loading' | 'blocked' | 'consent' | 'search' | 'results'

export function FindMyPhotosPage({ user }: Props) {
  const params = useParams()
  const navigate = useNavigate()
  const eventId = normalizeEventCode(params.eventId ?? '')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<Phase>('loading')
  const [eventTitle, setEventTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [matches, setMatches] = useState<FaceMatchResult[]>([])
  const [consentChecked, setConsentChecked] = useState(false)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (!isValidEventCode(eventId)) {
      setError('Invalid event code')
      setPhase('blocked')
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const eventSnap = await getDoc(doc(getDb(), 'events', eventId))
        if (!eventSnap.exists()) {
          if (!cancelled) {
            setError('Event not found')
            setPhase('blocked')
          }
          return
        }
        const event = eventSnap.data() as EventDoc
        if (!cancelled) setEventTitle(event.title)

        const myMoments = await getDocs(
          query(
            collection(getDb(), 'events', eventId, 'moments'),
            where('author_uid', '==', user.uid),
          ),
        )
        if (myMoments.empty) {
          if (!cancelled) {
            setError('Upload at least one moment in this event before using Find photos of me.')
            setPhase('blocked')
          }
          return
        }

        const memberSnap = await getDoc(doc(getDb(), 'events', eventId, 'members', user.uid))
        const member = memberSnap.exists() ? (memberSnap.data() as MemberDoc) : null
        if (!cancelled) {
          setPhase(hasValidFaceFindConsent(member) ? 'search' : 'consent')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to open Find photos of me')
          setPhase('blocked')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [eventId, user.uid])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!cameraOn || !video || !stream) return
    video.srcObject = stream
    video.muted = true
    video.setAttribute('playsinline', 'true')
    void video.play().catch(() => undefined)
    return () => {
      video.srcObject = null
    }
  }, [cameraOn])

  async function acceptConsent() {
    if (!consentChecked) {
      setError('Please confirm you agree to the privacy notice.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setDoc(
        doc(getDb(), 'events', eventId, 'members', user.uid),
        {
          face_find_consent_at: Date.now(),
          face_find_consent_version: FACE_FIND_CONSENT_VERSION,
        },
        { merge: true },
      )
      setPhase('search')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save consent')
    } finally {
      setBusy(false)
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  async function startCamera() {
    setError(null)
    stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
      })
      streamRef.current = stream
      setCameraOn(true)
    } catch {
      setError('Camera unavailable. You can upload a selfie instead.')
    }
  }

  async function runMatchFromBlob(blob: Blob) {
    setBusy(true)
    setError(null)
    setStatus('Loading face models…')
    try {
      await ensureFaceModels()
      setStatus('Indexing event photos…')
      await backfillEventFaceIndex({
        eventId,
        indexedByUid: user.uid,
        onProgress: (done, total) => {
          if (total === 0) setStatus('Gallery already indexed')
          else setStatus(`Indexing photos ${done}/${total}…`)
        },
      })

      setStatus('Detecting your face…')
      const detections = await detectFacesFromFile(blob)
      if (detections.length === 0) {
        setError('No face detected in your selfie. Try better lighting and face the camera.')
        setPhase('search')
        return
      }

      const queryDescriptor = Array.from(detections[0]!.descriptor)
      setStatus('Searching gallery…')
      const facesSnap = await getDocs(collection(getDb(), 'events', eventId, 'faces'))
      const faces = facesSnap.docs.map((d) => d.data() as FaceDoc)
      const found = matchFacesToDescriptor(queryDescriptor, faces)
      setMatches(found)
      setPhase('results')
      stopCamera()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Face search failed')
      setPhase('search')
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  async function captureSelfie() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setError('Camera is still starting. Try again in a moment.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
    )
    if (!blob) return
    await runMatchFromBlob(blob)
  }

  function onFilePicked(files: FileList | null) {
    const file = files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      setError('Please choose a photo selfie')
      return
    }
    void runMatchFromBlob(file)
  }

  if (phase === 'loading') {
    return (
      <p className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">
        Opening Find photos of me…
      </p>
    )
  }

  if (phase === 'blocked') {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <div className="mt-4 flex justify-center gap-3">
          <NavButton to={isValidEventCode(eventId) ? `/e/${eventId}` : '/'}>← Back</NavButton>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="space-y-3">
        <NavButton to={`/e/${eventId}`}>← Event</NavButton>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Find photos of me</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {eventTitle} · Personalization after you contribute a moment
        </p>
      </div>

      {phase === 'consent' && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {FACE_FIND_PRIVACY_TITLE}
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {FACE_FIND_PRIVACY_BODY}
          </p>
          <label className="mt-5 flex items-start gap-3 text-sm text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
            />
            <span>
              I have read this notice and agree to face matching for Find My Photos in this event
              (consent {FACE_FIND_CONSENT_VERSION}).
            </span>
          </label>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void acceptConsent()}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Agree and continue'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/e/${eventId}`)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === 'search' && (
        <div className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Take a clear selfie or upload one. We only search photos already in this event room.
          </p>
          <div className="relative overflow-hidden rounded-xl bg-slate-950">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className={`aspect-square w-full object-cover ${cameraOn ? 'scale-x-[-1]' : 'hidden'}`}
            />
            {!cameraOn && (
              <div className="flex aspect-square items-center justify-center text-sm text-slate-400">
                Selfie preview
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {!cameraOn ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void startCamera()}
                className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white"
              >
                Open camera
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void captureSelfie()}
                className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Searching…' : 'Capture & search'}
              </button>
            )}
            <label className="flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-100">
              Upload selfie
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  onFilePicked(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {cameraOn && (
            <button
              type="button"
              onClick={stopCamera}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600"
            >
              Close camera
            </button>
          )}
          {status && <p className="text-sm text-slate-600 dark:text-slate-400">{status}</p>}
        </div>
      )}

      {phase === 'results' && (
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {matches.length === 0
                ? 'No confident matches yet. Try another selfie or wait until more photos are uploaded.'
                : `Found ${matches.length} photo${matches.length === 1 ? '' : 's'} that may include you.`}
            </p>
            <button
              type="button"
              onClick={() => {
                setMatches([])
                setPhase('search')
              }}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold dark:border-slate-600"
            >
              Search again
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {matches.map((m) => (
              <a
                key={m.moment_id}
                href={m.media_url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                <img src={m.media_url} alt="Matched moment" className="aspect-square w-full object-cover" />
                <p className="px-3 py-2 text-xs text-slate-500">
                  Confidence distance {m.distance.toFixed(2)} · Open
                </p>
              </a>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Prefer the main feed?{' '}
            <Link className="font-semibold text-blue-600" to={`/e/${eventId}`}>
              Back to event
            </Link>
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
