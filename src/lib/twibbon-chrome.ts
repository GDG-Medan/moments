import { ensureGoogleSansReady, googleSansCanvasFont } from './fonts'

/**
 * Draw GDG Moments twibbon chrome (border + footer) with Google Sans labels.
 * Matches the default SVG frame, but uses brand fonts for generated exports.
 */
export async function drawTwibbonChrome(
  ctx: CanvasRenderingContext2D,
  size: number,
): Promise<void> {
  await ensureGoogleSansReady()

  const inset = Math.round(size * (24 / 1080))
  const stroke = Math.max(8, Math.round(size * (28 / 1080)))
  const radius = Math.round(size * (48 / 1080))
  const barH = Math.round(size * (200 / 1080))
  const barY = size - barH

  const gradient = ctx.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, '#4285F4')
  gradient.addColorStop(0.33, '#EA4335')
  gradient.addColorStop(0.66, '#FBBC04')
  gradient.addColorStop(1, '#34A853')

  ctx.save()
  ctx.strokeStyle = gradient
  ctx.lineWidth = stroke
  roundRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, radius)
  ctx.stroke()

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
  ctx.fillRect(0, barY, size, barH)

  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = googleSansCanvasFont(Math.round(size * (64 / 1080)), 700)
  ctx.fillText('GDG Moments', size / 2, barY + barH * 0.42)

  ctx.fillStyle = '#CBD5E1'
  ctx.font = googleSansCanvasFont(Math.round(size * (32 / 1080)), 400)
  ctx.fillText('Google Developer Groups', size / 2, barY + barH * 0.72)
  ctx.restore()
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
