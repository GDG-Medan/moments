export type FilterPreset = 'none' | 'vivid' | 'warm'

const FILTER_CSS: Record<FilterPreset, string> = {
  none: 'none',
  vivid: 'contrast(1.15) saturate(1.35)',
  warm: 'sepia(0.25) saturate(1.2) brightness(1.05)',
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

export async function compressImage(
  file: File,
  options?: { maxEdge?: number; quality?: number; filter?: FilterPreset },
): Promise<Blob> {
  const maxEdge = options?.maxEdge ?? 1600
  const quality = options?.quality ?? 0.7
  const filter = options?.filter ?? 'none'

  const img = await loadImageFromFile(file)
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.filter = FILTER_CSS[filter]
  ctx.drawImage(img, 0, 0, width, height)
  ctx.filter = 'none'

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  )
  if (!blob) throw new Error('Failed to compress image')
  return blob
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}
