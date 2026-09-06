import { VertexAI } from '@google-cloud/vertexai'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'gdg-moments'
// Gemini 3.1 Flash-Lite is served on global / multi-region endpoints, not us-central1.
// https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-lite
const VERTEX_LOCATION = 'global'
// @google-cloud/vertexai@1.12.0 prefixes location onto the host (`global-aiplatform...`),
// which 404s HTML and surfaces as "Unexpected token '<'". Override to the real global host.
// https://github.com/googleapis/nodejs-vertexai/issues/539
const VERTEX_API_ENDPOINT = 'aiplatform.googleapis.com'
const VERTEX_MODEL = 'gemini-3.1-flash-lite'

type CaptionRequest = {
  event_id?: string
  moment_id?: string
  image_url?: string
  event_title?: string
}

type HighlightRequest = {
  event_id?: string
}

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.')
  return uid
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Model did not return JSON')
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
}

function getVertexModel() {
  const vertex = new VertexAI({
    project: PROJECT_ID,
    location: VERTEX_LOCATION,
    apiEndpoint: VERTEX_API_ENDPOINT,
  })
  return vertex.getGenerativeModel({ model: VERTEX_MODEL })
}

export const generateCaption = onCall({ cors: true }, async (request) => {
  requireAuth(request.auth?.uid)
  const data = request.data as CaptionRequest
  const eventId = String(data.event_id ?? '')
  const momentId = String(data.moment_id ?? '')
  const imageUrl = String(data.image_url ?? '')
  const eventTitle = String(data.event_title ?? 'GDG event')

  if (!eventId || !momentId || !imageUrl) {
    throw new HttpsError('invalid-argument', 'event_id, moment_id, and image_url are required.')
  }

  const db = getFirestore()
  const momentRef = db.doc(`events/${eventId}/moments/${momentId}`)
  const momentSnap = await momentRef.get()
  if (!momentSnap.exists) throw new HttpsError('not-found', 'Moment not found.')

  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) throw new HttpsError('internal', 'Unable to fetch moment image.')
  const buffer = Buffer.from(await imageRes.arrayBuffer())
  const contentType = imageRes.headers.get('content-type') || 'image/jpeg'

  const prompt = `You help Google Developer Groups organizers amplify event moments.
Event title: ${eventTitle}
Write an engaging English social caption (max 280 characters) and 4-6 hashtags without # symbols.
Return ONLY JSON: {"caption":"...","hashtags":["..."]}`

  let text = ''
  try {
    const model = getVertexModel()
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: buffer.toString('base64'),
                mimeType: contentType,
              },
            },
          ],
        },
      ],
    })
    text = result.response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gemini request failed'
    throw new HttpsError('internal', message)
  }

  const parsed = parseJsonObject(text)
  const caption = String(parsed.caption ?? '').trim()
  const hashtags = Array.isArray(parsed.hashtags)
    ? parsed.hashtags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean)
    : []

  if (!caption) throw new HttpsError('internal', 'Empty caption from model.')

  await momentRef.update({ caption, hashtags })
  return { caption, hashtags }
})

export const suggestHighlights = onCall({ cors: true }, async (request) => {
  requireAuth(request.auth?.uid)
  const data = request.data as HighlightRequest
  const eventId = String(data.event_id ?? '')
  if (!eventId) throw new HttpsError('invalid-argument', 'event_id is required.')

  const db = getFirestore()
  const eventSnap = await db.doc(`events/${eventId}`).get()
  if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.')
  const event = eventSnap.data() as { organizer_uid?: string; title?: string }
  if (event.organizer_uid !== request.auth?.uid) {
    throw new HttpsError('permission-denied', 'Only the organizer can request highlights.')
  }

  const momentsSnap = await db
    .collection(`events/${eventId}/moments`)
    .orderBy('created_at', 'desc')
    .limit(20)
    .get()

  const moments = momentsSnap.docs.map((d) => {
    const m = d.data()
    const ratingCount = Number(m.rating_count ?? 0)
    const ratingSum = Number(m.rating_sum ?? 0)
    const avg = ratingCount > 0 ? ratingSum / ratingCount : 0
    return {
      id: d.id,
      author_name: String(m.author_name ?? ''),
      media_url: String(m.media_url ?? ''),
      media_type: String(m.media_type ?? 'photo'),
      caption: String(m.caption ?? ''),
      rating_avg: avg,
      rating_count: ratingCount,
    }
  })

  if (moments.length === 0) {
    return { suggestions: [] }
  }

  const ranked = [...moments].sort((a, b) => {
    if (b.rating_avg !== a.rating_avg) return b.rating_avg - a.rating_avg
    return b.rating_count - a.rating_count
  })

  const candidates = ranked.slice(0, 8)
  const prompt = `You are helping a GDG organizer pick amplify-ready event highlights.
Event: ${event.title ?? 'GDG event'}
Candidates JSON:
${JSON.stringify(
  candidates.map(({ id, author_name, caption, rating_avg, rating_count, media_type }) => ({
    id,
    author_name,
    caption,
    rating_avg,
    rating_count,
    media_type,
  })),
  null,
  2,
)}

Pick up to 5 best moment ids for social amplification.
Return ONLY JSON:
{"suggestions":[{"moment_id":"...","amplify_caption":"...","reason":"..."}]}`

  let text = ''
  try {
    const model = getVertexModel()
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    text = result.response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gemini request failed'
    throw new HttpsError('internal', message)
  }

  const parsed = parseJsonObject(text)
  const raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  const suggestions = raw
    .map((item) => {
      const row = item as Record<string, unknown>
      return {
        moment_id: String(row.moment_id ?? ''),
        amplify_caption: String(row.amplify_caption ?? ''),
        reason: String(row.reason ?? ''),
      }
    })
    .filter((s) => s.moment_id && candidates.some((c) => c.id === s.moment_id))
    .slice(0, 5)

  return { suggestions }
})
