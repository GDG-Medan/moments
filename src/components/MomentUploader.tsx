import { addDoc, collection, doc, increment, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { useEffect, useRef, useState } from 'react'
import { getDb, getFirebaseStorage, type MomentDoc } from '../lib/firebase'
import {
  compressImage,
  isImageFile,
  isVideoFile,
  type FilterPreset,
} from '../lib/media'
import { POINTS_UPLOAD } from '../lib/points'
import { applyTwibbon } from '../lib/twibbon'

type Props = {
  eventId: string
  twibbonPath: string
  uid: string
  displayName: string
  onUploaded: () => void
}

const FILTER_CSS: Record<FilterPreset, string> = {
  none: 'none',
  vivid: 'contrast(1.15) saturate(1.35)',
  warm: 'sepia(0.25) saturate(1.2) brightness(1.05)',
}

type Draft =
  | { kind: 'photo'; previewUrl: string; file: File }
  | { kind: 'video'; previewUrl: string; file: File }

export function MomentUploader({ eventId, twibbonPath, uid, displayName, onUploaded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [filter, setFilter] = useState<FilterPreset>('vivid')
  const [useTwibbon, setUseTwibbon] = useState(true)
  const [cameraOn, setCameraOn] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [processedPreview, setProcessedPreview] = useState<string | null>(null)
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Attach stream after <video> is mounted (fixes blank preview on mobile/desktop).
  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!cameraOn || !video || !stream) return

    video.srcObject = stream
    video.muted = true
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')

    const play = async () => {
      try {
        await video.play()
      } catch {
        // Autoplay can fail until a later gesture; stream is still visible after play() from capture tap.
      }
    }
    void play()

    return () => {
      video.srcObject = null
    }
  }, [cameraOn, facingMode])

  useEffect(() => {
    if (!draft || draft.kind !== 'photo') {
      setProcessedPreview(null)
      setProcessedBlob(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const blob = useTwibbon
          ? await applyTwibbon(draft.file, twibbonPath, { filter })
          : await compressImage(draft.file, { filter })
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setProcessedPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
        setProcessedBlob(blob)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to process preview')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [draft, filter, useTwibbon, twibbonPath])

  function releaseStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function stopCamera() {
    releaseStream()
    setCameraOn(false)
  }

  async function startCamera(mode: 'user' | 'environment' = facingMode) {
    setError(null)
    releaseStream()
    setCameraOn(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      })
      streamRef.current = stream
      setFacingMode(mode)
      // Mount video first; effect attaches srcObject.
      setCameraOn(true)
    } catch {
      setError('Camera permission denied or unavailable. You can still pick a file.')
      setCameraOn(false)
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current
    if (!video) return

    // Wait a frame if metadata not ready yet.
    if (!video.videoWidth) {
      await new Promise<void>((resolve) => {
        const onReady = () => {
          video.removeEventListener('loadeddata', onReady)
          resolve()
        }
        video.addEventListener('loadeddata', onReady)
        window.setTimeout(() => resolve(), 800)
      })
    }
    if (!video.videoWidth) {
      setError('Camera is still starting. Try Capture again in a moment.')
      return
    }

    const canvas = document.createElement('canvas')
    const size = Math.min(Math.max(video.videoWidth, video.videoHeight), 1600)
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scale = Math.max(size / video.videoWidth, size / video.videoHeight)
    const drawW = video.videoWidth * scale
    const drawH = video.videoHeight * scale
    const dx = (size - drawW) / 2
    const dy = (size - drawH) / 2

    if (facingMode === 'user') {
      ctx.translate(size, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, dx, dy, drawW, drawH)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
    )
    if (!blob) return
    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
    setDraft({
      kind: 'photo',
      file,
      previewUrl: URL.createObjectURL(blob),
    })
    stopCamera()
  }

  function onFilePicked(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setError(null)
    if (isVideoFile(file)) {
      setDraft({ kind: 'video', file, previewUrl: URL.createObjectURL(file) })
      stopCamera()
      return
    }
    if (!isImageFile(file)) {
      setError('Please choose a photo or video')
      return
    }
    setDraft({ kind: 'photo', file, previewUrl: URL.createObjectURL(file) })
    stopCamera()
  }

  function discardDraft() {
    if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl)
    if (processedPreview) URL.revokeObjectURL(processedPreview)
    setDraft(null)
    setProcessedPreview(null)
    setProcessedBlob(null)
    setProgress(null)
  }

  async function confirmUpload() {
    if (!draft) return
    setBusy(true)
    setError(null)
    setProgress('Uploading…')
    try {
      let blob: Blob
      let mediaType: 'photo' | 'video'
      let twibbonApplied = false
      let contentType: string
      let extension: string

      if (draft.kind === 'video') {
        blob = draft.file
        mediaType = 'video'
        contentType = draft.file.type || 'video/mp4'
        extension = 'mp4'
      } else {
        blob = processedBlob ?? (await compressImage(draft.file, { filter }))
        mediaType = 'photo'
        twibbonApplied = useTwibbon
        contentType = 'image/jpeg'
        extension = 'jpg'
      }

      const path = `events/${eventId}/moments/${uid}/${Date.now()}.${extension}`
      const storageRef = ref(getFirebaseStorage(), path)
      await uploadBytes(storageRef, blob, { contentType })
      const mediaUrl = await getDownloadURL(storageRef)

      const moment: MomentDoc = {
        author_uid: uid,
        author_name: displayName,
        media_url: mediaUrl,
        media_type: mediaType,
        thumb_url: null,
        caption: '',
        hashtags: [],
        twibbon_applied: twibbonApplied,
        rating_sum: 0,
        rating_count: 0,
        created_at: Date.now(),
      }

      await addDoc(collection(getDb(), 'events', eventId, 'moments'), moment)
      await updateDoc(doc(getDb(), 'users', uid), { points: increment(POINTS_UPLOAD) })
      discardDraft()
      onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 dark:border-slate-600 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Capture a moment</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Live camera with filters. Edit locally, then confirm before upload.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(['none', 'vivid', 'warm'] as FilterPreset[]).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setFilter(preset)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              filter === preset
                ? 'bg-slate-900 text-white dark:bg-[#FFD700] dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={useTwibbon}
          onChange={(e) => setUseTwibbon(e.target.checked)}
        />
        Apply GDG twibbon (photos)
      </label>

      {!draft && (
        <div className="mt-4 space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-slate-950">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className={`aspect-square w-full bg-black object-cover ${
                cameraOn ? (facingMode === 'user' ? 'scale-x-[-1]' : '') : 'hidden'
              }`}
              style={{ filter: FILTER_CSS[filter] }}
            />
            {!cameraOn && (
              <div className="flex aspect-square items-center justify-center text-sm text-slate-400">
                Camera preview
              </div>
            )}
            {cameraOn && useTwibbon && (
              <img
                src={twibbonPath}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {!cameraOn ? (
              <button
                type="button"
                onClick={() => void startCamera('user')}
                className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Open camera
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void captureFromCamera()}
                className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Capture
              </button>
            )}
            <button
              type="button"
              onClick={() => void startCamera(facingMode === 'user' ? 'environment' : 'user')}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Flip camera
            </button>
          </div>

          {cameraOn && (
            <button
              type="button"
              onClick={stopCamera}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
            >
              Close camera
            </button>
          )}

          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            Choose from gallery
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                onFilePicked(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}

      {draft && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Review before upload</p>
          {draft.kind === 'video' ? (
            <video
              src={draft.previewUrl}
              controls
              className="aspect-square w-full rounded-xl bg-black object-contain"
            />
          ) : (
            <img
              src={processedPreview || draft.previewUrl}
              alt="Preview"
              className="aspect-square w-full rounded-xl object-cover"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={discardDraft}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              Retake
            </button>
            <button
              type="button"
              disabled={busy || (draft.kind === 'photo' && !processedBlob)}
              onClick={() => void confirmUpload()}
              className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? progress || 'Uploading…' : 'Confirm upload'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
