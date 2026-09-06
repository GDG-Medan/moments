import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ASPECT_PRESETS,
  DEFAULT_CROP,
  computeCoverDraw,
  getPreset,
  type AspectPresetId,
  type CropState,
} from '../lib/frame'
import { isBrandTwibbon } from '../lib/fonts'
import { drawTwibbonChrome } from '../lib/twibbon-chrome'

type Props = {
  imageUrl: string
  aspectId: AspectPresetId
  crop: CropState
  onAspectChange: (id: AspectPresetId) => void
  onCropChange: (crop: CropState) => void
  cssFilter?: string
  twibbonUrl?: string | null
}

const FILTER_TO_CANVAS: Record<string, string> = {
  none: 'none',
  'contrast(1.15) saturate(1.35)': 'contrast(1.15) saturate(1.35)',
  'sepia(0.25) saturate(1.2) brightness(1.05)': 'sepia(0.25) saturate(1.2) brightness(1.05)',
}

export function AspectCropEditor({
  imageUrl,
  aspectId,
  crop,
  onAspectChange,
  onCropChange,
  cssFilter = 'none',
  twibbonUrl,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const photoRef = useRef<HTMLImageElement | null>(null)
  const overlayRef = useRef<HTMLImageElement | null>(null)
  const [ready, setReady] = useState(false)
  const [natural, setNatural] = useState({ w: 1, h: 1 })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originPanX: number
    originPanY: number
  } | null>(null)

  const preset = getPreset(aspectId)
  const aspectStyle =
    preset.ratio == null
      ? { aspectRatio: `${natural.w} / ${natural.h}` }
      : { aspectRatio: String(preset.ratio) }

  useEffect(() => {
    let cancelled = false
    const photo = new Image()
    photo.crossOrigin = 'anonymous'
    photo.onload = () => {
      if (cancelled) return
      photoRef.current = photo
      setNatural({ w: photo.naturalWidth || 1, h: photo.naturalHeight || 1 })
      setReady(true)
    }
    photo.src = imageUrl

    if (twibbonUrl) {
      const overlay = new Image()
      overlay.crossOrigin = 'anonymous'
      overlay.onload = () => {
        if (!cancelled) overlayRef.current = overlay
      }
      overlay.src = twibbonUrl
    } else {
      overlayRef.current = null
    }

    return () => {
      cancelled = true
    }
  }, [imageUrl, twibbonUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    const viewport = viewportRef.current
    const photo = photoRef.current
    if (!canvas || !viewport || !photo || !ready) return

    let cancelled = false
    let paintToken = 0

    const paint = () => {
      const token = ++paintToken
      void (async () => {
        const rect = viewport.getBoundingClientRect()
        const width = Math.max(1, Math.round(rect.width * window.devicePixelRatio))
        const height = Math.max(1, Math.round(rect.height * window.devicePixelRatio))
        canvas.width = width
        canvas.height = height
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`

        const ctx = canvas.getContext('2d')
        if (!ctx || cancelled || token !== paintToken) return
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, width, height)

        const draw = computeCoverDraw(photo.naturalWidth, photo.naturalHeight, width, height, crop)
        ctx.filter = FILTER_TO_CANVAS[cssFilter] ?? cssFilter
        ctx.drawImage(photo, draw.dx, draw.dy, draw.dw, draw.dh)
        ctx.filter = 'none'

        if (twibbonUrl && aspectId === '1:1') {
          if (isBrandTwibbon(twibbonUrl)) {
            await drawTwibbonChrome(ctx, Math.min(width, height))
          } else if (overlayRef.current?.complete) {
            ctx.drawImage(overlayRef.current, 0, 0, width, height)
          }
        }
      })()
    }

    paint()
    const observer = new ResizeObserver(() => paint())
    observer.observe(viewport)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [aspectId, crop, cssFilter, ready, twibbonUrl, imageUrl, natural.w, natural.h])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!viewportRef.current) return
    viewportRef.current.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originPanX: crop.panX,
      originPanY: crop.panY,
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const viewport = viewportRef.current
    const photo = photoRef.current
    if (!drag || drag.pointerId !== e.pointerId || !viewport || !photo) return

    const rect = viewport.getBoundingClientRect()
    const draw = computeCoverDraw(photo.naturalWidth, photo.naturalHeight, rect.width, rect.height, {
      ...crop,
      panX: 0,
      panY: 0,
    })
    const maxOffsetX = Math.max(1, (draw.dw - rect.width) / 2)
    const maxOffsetY = Math.max(1, (draw.dh - rect.height) / 2)
    const nextPanX = Math.max(-1, Math.min(1, drag.originPanX + (e.clientX - drag.startX) / maxOffsetX))
    const nextPanY = Math.max(-1, Math.min(1, drag.originPanY + (e.clientY - drag.startY) / maxOffsetY))
    onCropChange({ ...crop, panX: nextPanX, panY: nextPanY })
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ASPECT_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onAspectChange(item.id)
              onCropChange(DEFAULT_CROP)
            }}
            className={`rounded-full px-3 py-1.5 text-left text-xs font-semibold ${
              aspectId === item.id
                ? 'bg-slate-900 text-white dark:bg-[#FFD700] dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
            title={item.hint}
          >
            <span className="block">{item.label}</span>
            <span className="block text-[10px] font-medium opacity-80">{item.hint}</span>
          </button>
        ))}
      </div>

      <div
        ref={viewportRef}
        className="relative w-full touch-none overflow-hidden rounded-xl bg-slate-950"
        style={aspectStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-[10px] text-white">
          Drag to reposition
        </p>
      </div>

      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
        Zoom {crop.zoom.toFixed(2)}x
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => onCropChange({ ...crop, zoom: Number(e.target.value) })}
          className="mt-1 w-full accent-blue-600"
        />
      </label>

      {twibbonUrl && aspectId !== '1:1' && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Twibbon overlays apply on 1:1. Other ratios export a clean crop for IG/Stories.
        </p>
      )}
    </div>
  )
}
