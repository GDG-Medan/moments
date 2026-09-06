import { isBrandTwibbon } from './fonts'
import { loadImageFromFile, type FilterPreset } from './media'
import { drawTwibbonChrome } from './twibbon-chrome'

export type AspectPresetId = 'original' | '1:1' | '4:5' | '9:16' | '16:9'

export type AspectPreset = {
  id: AspectPresetId
  label: string
  hint: string
  /** null = keep source aspect */
  ratio: number | null
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: 'original', label: 'Original', hint: 'Keep source', ratio: null },
  { id: '1:1', label: '1:1', hint: 'IG / feed square', ratio: 1 },
  { id: '4:5', label: '4:5', hint: 'IG portrait', ratio: 4 / 5 },
  { id: '9:16', label: '9:16', hint: 'Stories / Reels', ratio: 9 / 16 },
  { id: '16:9', label: '16:9', hint: 'Landscape', ratio: 16 / 9 },
]

export type CropState = {
  /** 1 = cover fit, higher = zoom in */
  zoom: number
  /** -1..1 pan inside available overflow */
  panX: number
  /** -1..1 pan inside available overflow */
  panY: number
}

export const DEFAULT_CROP: CropState = { zoom: 1, panX: 0, panY: 0 }

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
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

export function getPreset(id: AspectPresetId): AspectPreset {
  return ASPECT_PRESETS.find((p) => p.id === id) ?? ASPECT_PRESETS[0]!
}

export function outputSizeForRatio(
  ratio: number | null,
  sourceW: number,
  sourceH: number,
  maxEdge = 1600,
): { width: number; height: number } {
  if (!ratio) {
    const scale = Math.min(1, maxEdge / Math.max(sourceW, sourceH))
    return {
      width: Math.max(1, Math.round(sourceW * scale)),
      height: Math.max(1, Math.round(sourceH * scale)),
    }
  }

  if (ratio >= 1) {
    const width = Math.min(maxEdge, 1600)
    const height = Math.max(1, Math.round(width / ratio))
    return { width, height }
  }

  const height = Math.min(maxEdge, 1600)
  const width = Math.max(1, Math.round(height * ratio))
  return { width, height }
}

/** Cover-fit draw rect with zoom + pan into an output frame. */
export function computeCoverDraw(
  sourceW: number,
  sourceH: number,
  frameW: number,
  frameH: number,
  crop: CropState,
): { dx: number; dy: number; dw: number; dh: number } {
  const zoom = Math.max(1, Math.min(3, crop.zoom))
  const baseScale = Math.max(frameW / sourceW, frameH / sourceH)
  const scale = baseScale * zoom
  const dw = sourceW * scale
  const dh = sourceH * scale

  const maxOffsetX = Math.max(0, (dw - frameW) / 2)
  const maxOffsetY = Math.max(0, (dh - frameH) / 2)
  const panX = Math.max(-1, Math.min(1, crop.panX))
  const panY = Math.max(-1, Math.min(1, crop.panY))

  const dx = (frameW - dw) / 2 + panX * maxOffsetX
  const dy = (frameH - dh) / 2 + panY * maxOffsetY
  return { dx, dy, dw, dh }
}

export type FrameRenderOptions = {
  aspectId: AspectPresetId
  crop?: CropState
  filter?: FilterPreset
  twibbonUrl?: string | null
  maxEdge?: number
  quality?: number
}

export async function renderFramedPhotoFromFile(
  file: File,
  options: FrameRenderOptions,
): Promise<Blob> {
  const img = await loadImageFromFile(file)
  return renderFramedPhotoFromImage(img, options)
}

export async function renderFramedPhotoFromUrl(
  url: string,
  options: FrameRenderOptions,
): Promise<Blob> {
  const img = await loadImageFromUrl(url)
  return renderFramedPhotoFromImage(img, options)
}

export async function renderFramedPhotoFromImage(
  photo: HTMLImageElement,
  options: FrameRenderOptions,
): Promise<Blob> {
  const preset = getPreset(options.aspectId)
  const crop = options.crop ?? DEFAULT_CROP
  const filter = options.filter ?? 'none'
  const maxEdge = options.maxEdge ?? 1600
  const quality = options.quality ?? 0.88

  const { width, height } = outputSizeForRatio(preset.ratio, photo.width, photo.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, width, height)

  const draw = computeCoverDraw(photo.width, photo.height, width, height, crop)
  ctx.filter = FILTER_CSS[filter]
  ctx.drawImage(photo, draw.dx, draw.dy, draw.dw, draw.dh)
  ctx.filter = 'none'

  // Twibbon is designed square — apply only on 1:1 frames.
  if (options.twibbonUrl && preset.id === '1:1') {
    if (isBrandTwibbon(options.twibbonUrl)) {
      await drawTwibbonChrome(ctx, Math.min(width, height))
    } else {
      const overlay = await loadImageFromUrl(options.twibbonUrl)
      ctx.drawImage(overlay, 0, 0, width, height)
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  )
  if (!blob) throw new Error('Failed to render framed photo')
  return blob
}
