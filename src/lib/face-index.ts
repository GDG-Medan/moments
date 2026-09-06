import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getDb, type FaceDoc, type MomentDoc } from './firebase'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model'

type FaceApi = typeof import('@vladmandic/face-api')

let faceApiPromise: Promise<FaceApi> | null = null
let modelsReady: Promise<void> | null = null

async function getFaceApi(): Promise<FaceApi> {
  if (!faceApiPromise) {
    faceApiPromise = import('@vladmandic/face-api')
  }
  return faceApiPromise
}

export async function ensureFaceModels(): Promise<void> {
  const faceapi = await getFaceApi()
  if (!modelsReady) {
    modelsReady = (async () => {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
    })().catch((err) => {
      modelsReady = null
      throw err
    })
  }
  await modelsReady
}

async function detectAll(input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) {
  const faceapi = await getFaceApi()
  await ensureFaceModels()
  return faceapi.detectAllFaces(input).withFaceLandmarks().withFaceDescriptors()
}

export async function detectFacesFromImageUrl(imageUrl: string) {
  const faceapi = await getFaceApi()
  await ensureFaceModels()
  const img = await faceapi.fetchImage(imageUrl)
  return detectAll(img)
}

export async function detectFacesFromFile(file: Blob) {
  const faceapi = await getFaceApi()
  await ensureFaceModels()
  const img = await faceapi.bufferToImage(file as File)
  return detectAll(img)
}

async function clearFacesForMoment(eventId: string, momentId: string) {
  const snap = await getDocs(
    query(collection(getDb(), 'events', eventId, 'faces'), where('moment_id', '==', momentId)),
  )
  if (snap.empty) return
  const batch = writeBatch(getDb())
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

export async function indexMomentFaces(params: {
  eventId: string
  momentId: string
  mediaUrl: string
  mediaType: 'photo' | 'video'
  indexedByUid: string
}): Promise<number> {
  if (params.mediaType !== 'photo') {
    await updateDoc(doc(getDb(), 'events', params.eventId, 'moments', params.momentId), {
      face_indexed_at: Date.now(),
    })
    return 0
  }

  try {
    const detections = await detectFacesFromImageUrl(params.mediaUrl)
    await clearFacesForMoment(params.eventId, params.momentId)

    for (const det of detections) {
      const box = det.detection.box
      const face: FaceDoc = {
        moment_id: params.momentId,
        media_url: params.mediaUrl,
        descriptor: Array.from(det.descriptor),
        box: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
        created_at: Date.now(),
        indexed_by_uid: params.indexedByUid,
      }
      await addDoc(collection(getDb(), 'events', params.eventId, 'faces'), face)
    }

    await updateDoc(doc(getDb(), 'events', params.eventId, 'moments', params.momentId), {
      face_indexed_at: Date.now(),
    })
    return detections.length
  } catch (err) {
    try {
      await updateDoc(doc(getDb(), 'events', params.eventId, 'moments', params.momentId), {
        face_indexed_at: Date.now(),
      })
    } catch {
      // ignore secondary failure
    }
    throw err
  }
}

export async function backfillEventFaceIndex(params: {
  eventId: string
  indexedByUid: string
  onProgress?: (done: number, total: number) => void
}): Promise<void> {
  const momentsSnap = await getDocs(collection(getDb(), 'events', params.eventId, 'moments'))
  const pending = momentsSnap.docs.filter((d) => {
    const data = d.data() as MomentDoc
    return data.media_type === 'photo' && !data.face_indexed_at
  })

  let done = 0
  params.onProgress?.(done, pending.length)
  for (const m of pending) {
    const data = m.data() as MomentDoc
    try {
      await indexMomentFaces({
        eventId: params.eventId,
        momentId: m.id,
        mediaUrl: data.media_url,
        mediaType: data.media_type,
        indexedByUid: params.indexedByUid,
      })
    } catch {
      // continue other moments
    }
    done += 1
    params.onProgress?.(done, pending.length)
  }
}
