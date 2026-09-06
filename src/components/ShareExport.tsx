import { useEffect, useState } from 'react'
import { AspectCropEditor } from './AspectCropEditor'
import {
  ASPECT_PRESETS,
  DEFAULT_CROP,
  renderFramedPhotoFromUrl,
  type AspectPresetId,
  type CropState,
} from '../lib/frame'

type Props = {
  mediaUrl: string
  caption: string
  hashtags: string[]
  fileName?: string
  twibbonPath?: string
}

async function blobFromUrl(url: string): Promise<Blob> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.blob()
  } catch {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas unavailable'))
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob((b) => {
          if (!b) reject(new Error('Failed to encode image'))
          else resolve(b)
        }, 'image/jpeg', 0.92)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })
    return blob
  }
}

export function ShareExport({
  mediaUrl,
  caption,
  hashtags,
  fileName = 'gdg-moment.jpg',
  twibbonPath = '/twibbon/gdg-medan.svg',
}: Props) {
  const [status, setStatus] = useState<string | null>(null)
  const [openStudio, setOpenStudio] = useState(false)
  const [aspectId, setAspectId] = useState<AspectPresetId>('4:5')
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP)
  const [exportPreview, setExportPreview] = useState<string | null>(null)
  const [exportBlob, setExportBlob] = useState<Blob | null>(null)
  const [rendering, setRendering] = useState(false)

  const fullText = [caption, hashtags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')]
    .filter(Boolean)
    .join('\n\n')

  useEffect(() => {
    if (!openStudio) return
    let cancelled = false
    setRendering(true)
    void (async () => {
      try {
        const blob = await renderFramedPhotoFromUrl(mediaUrl, {
          aspectId,
          crop,
          twibbonUrl: aspectId === '1:1' ? twibbonPath : null,
        })
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setExportPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
        setExportBlob(blob)
      } catch (err) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : 'Failed to render export')
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openStudio, mediaUrl, aspectId, crop, twibbonPath])

  async function copyCaption() {
    await navigator.clipboard.writeText(fullText || mediaUrl)
    setStatus('Caption copied')
    window.setTimeout(() => setStatus(null), 1600)
  }

  async function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function downloadImage() {
    try {
      const blob = exportBlob ?? (await blobFromUrl(mediaUrl))
      const suffix = openStudio ? `-${aspectId.replace(':', 'x')}` : ''
      await downloadBlob(blob, fileName.replace(/\.jpg$/i, `${suffix}.jpg`))
      setStatus('Download started')
    } catch {
      window.open(mediaUrl, '_blank', 'noopener,noreferrer')
      setStatus('Opened image — long-press to save')
    }
    window.setTimeout(() => setStatus(null), 2200)
  }

  async function shareNative() {
    try {
      const blob = exportBlob ?? (await blobFromUrl(mediaUrl))
      const suffix = openStudio ? `-${aspectId.replace(':', 'x')}` : ''
      const name = fileName.replace(/\.jpg$/i, `${suffix}.jpg`)
      const file = new File([blob], name, { type: blob.type || 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: fullText || undefined,
          title: 'GDG Moments',
        })
        return
      }
      if (navigator.share) {
        await navigator.share({
          title: 'GDG Moments',
          text: fullText || 'Check out this GDG moment',
          url: mediaUrl,
        })
        return
      }
      await copyCaption()
      await downloadImage()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      try {
        if (navigator.share) {
          await navigator.share({
            title: 'GDG Moments',
            text: fullText || 'Check out this GDG moment',
            url: mediaUrl,
          })
          return
        }
      } catch {
        // fall through
      }
      await copyCaption()
      window.open(mediaUrl, '_blank', 'noopener,noreferrer')
      setStatus('Opened image as fallback')
      window.setTimeout(() => setStatus(null), 2200)
    }
  }

  async function quickExport(id: AspectPresetId) {
    setStatus('Preparing…')
    try {
      const blob = await renderFramedPhotoFromUrl(mediaUrl, {
        aspectId: id,
        crop: DEFAULT_CROP,
        twibbonUrl: id === '1:1' ? twibbonPath : null,
      })
      await downloadBlob(blob, fileName.replace(/\.jpg$/i, `-${id.replace(':', 'x')}.jpg`))
      setStatus(`Downloaded ${id}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed')
    }
    window.setTimeout(() => setStatus(null), 2200)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyCaption()}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Copy caption
        </button>
        <button
          type="button"
          onClick={() => void downloadImage()}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Download
        </button>
        <button
          type="button"
          onClick={() => void shareNative()}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
        >
          Share
        </button>
        <button
          type="button"
          onClick={() => setOpenStudio((v) => !v)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {openStudio ? 'Hide crop studio' : 'Crop / ratios'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ASPECT_PRESETS.filter((p) => p.id !== 'original').map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => void quickExport(preset.id)}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            title={`Quick download ${preset.hint}`}
          >
            ↓ {preset.label}
          </button>
        ))}
      </div>

      {openStudio && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Export studio
          </p>
          <AspectCropEditor
            imageUrl={mediaUrl}
            aspectId={aspectId}
            crop={crop}
            onAspectChange={(id) => {
              setAspectId(id)
              setCrop(DEFAULT_CROP)
            }}
            onCropChange={setCrop}
            twibbonUrl={twibbonPath}
          />
          {exportPreview && (
            <img
              src={exportPreview}
              alt="Export preview"
              className="mt-3 max-h-56 w-full rounded-lg object-contain bg-slate-100 dark:bg-slate-950"
            />
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={rendering || !exportBlob}
              onClick={() => void downloadImage()}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-[#FFD700] dark:text-slate-900"
            >
              {rendering ? 'Rendering…' : `Download ${aspectId}`}
            </button>
            <button
              type="button"
              disabled={rendering || !exportBlob}
              onClick={() => void shareNative()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Share {aspectId}
            </button>
          </div>
        </div>
      )}

      {status && <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p>}
    </div>
  )
}
