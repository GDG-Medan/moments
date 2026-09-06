import { isBrandTwibbon } from './fonts'
import { loadImageFromFile, type FilterPreset } from './media'
import { drawTwibbonChrome } from './twibbon-chrome'

const FILTER_CSS: Record<FilterPreset, string> = {
  none: 'none',
  vivid: 'contrast(1.15) saturate(1.35)',
  warm: 'sepia(0.25) saturate(1.2) brightness(1.05)',
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load overlay image'))
    img.src = url
  })
}

export async function applyTwibbon(
  file: File,
  twibbonUrl: string,
  options?: { maxEdge?: number; quality?: number; filter?: FilterPreset },
): Promise<Blob> {
  const maxEdge = options?.maxEdge ?? 1600
  const quality = options?.quality ?? 0.85
  const filter = options?.filter ?? 'none'

  const photo = await loadImageFromFile(file)

  const size = Math.min(maxEdge, Math.max(photo.width, photo.height, 1080))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  const scale = Math.max(size / photo.width, size / photo.height)
  const drawW = photo.width * scale
  const drawH = photo.height * scale
  const dx = (size - drawW) / 2
  const dy = (size - drawH) / 2

  ctx.filter = FILTER_CSS[filter]
  ctx.drawImage(photo, dx, dy, drawW, drawH)
  ctx.filter = 'none'

  if (isBrandTwibbon(twibbonUrl)) {
    await drawTwibbonChrome(ctx, size)
  } else {
    const overlay = await loadImageFromUrl(twibbonUrl)
    ctx.drawImage(overlay, 0, 0, size, size)
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  )
  if (!blob) throw new Error('Failed to apply twibbon')
  return blob
}
