import type { FaceDoc } from './firebase'

/** face-api Euclidean distance; lower is more similar. */
export const FACE_MATCH_MAX_DISTANCE = 0.55

export type FaceMatchResult = {
  moment_id: string
  media_url: string
  distance: number
}

function euclidean(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < a.length; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    sum += d * d
  }
  return Math.sqrt(sum)
}

export function matchFacesToDescriptor(
  queryDescriptor: number[],
  faces: FaceDoc[],
  maxDistance = FACE_MATCH_MAX_DISTANCE,
): FaceMatchResult[] {
  const bestByMoment = new Map<string, FaceMatchResult>()

  for (const face of faces) {
    const distance = euclidean(queryDescriptor, face.descriptor)
    if (distance > maxDistance) continue
    const prev = bestByMoment.get(face.moment_id)
    if (!prev || distance < prev.distance) {
      bestByMoment.set(face.moment_id, {
        moment_id: face.moment_id,
        media_url: face.media_url,
        distance,
      })
    }
  }

  return [...bestByMoment.values()].sort((a, b) => a.distance - b.distance)
}
