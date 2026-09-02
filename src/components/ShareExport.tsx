import { useState } from 'react'

type Props = {
  mediaUrl: string
  caption: string
  hashtags: string[]
  fileName?: string
}

async function blobFromUrl(url: string): Promise<Blob> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.blob()
  } catch {
    // Fallback for Storage CORS / mobile Safari quirks: draw image onto canvas.
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

export function ShareExport({ mediaUrl, caption, hashtags, fileName = 'gdg-moment.jpg' }: Props) {
  const [status, setStatus] = useState<string | null>(null)
  const fullText = [caption, hashtags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')]
    .filter(Boolean)
    .join('\n\n')

  async function copyCaption() {
    await navigator.clipboard.writeText(fullText || mediaUrl)
    setStatus('Caption copied')
    window.setTimeout(() => setStatus(null), 1600)
  }

  async function downloadImage() {
    try {
      const blob = await blobFromUrl(mediaUrl)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setStatus('Download started')
    } catch {
      // Last resort on mobile: open the file so user can long-press save.
      window.open(mediaUrl, '_blank', 'noopener,noreferrer')
      setStatus('Opened image — long-press to save')
    }
    window.setTimeout(() => setStatus(null), 2200)
  }

  async function shareNative() {
    try {
      const blob = await blobFromUrl(mediaUrl)
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
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

  return (
    <div className="space-y-2">
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
          Download image
        </button>
        <button
          type="button"
          onClick={() => void shareNative()}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
        >
          Share
        </button>
      </div>
      {status && <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p>}
    </div>
  )
}
