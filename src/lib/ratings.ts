import { doc, getDoc, increment, runTransaction, updateDoc } from 'firebase/firestore'
import { getDb, type MomentDoc } from './firebase'
import { POINTS_HIGHLIGHT, POINTS_RECEIVE_RATING } from './points'

export async function submitRating(params: {
  eventId: string
  momentId: string
  uid: string
  score: number
}): Promise<void> {
  const { eventId, momentId, uid, score } = params
  if (score < 1 || score > 5) throw new Error('Score must be 1–5')

  const momentRef = doc(getDb(), 'events', eventId, 'moments', momentId)
  const ratingRef = doc(getDb(), 'events', eventId, 'moments', momentId, 'ratings', uid)

  await runTransaction(getDb(), async (tx) => {
    const momentSnap = await tx.get(momentRef)
    if (!momentSnap.exists()) throw new Error('Moment not found')
    const moment = momentSnap.data() as MomentDoc
    if (moment.author_uid === uid) throw new Error('You cannot rate your own moment')

    const ratingSnap = await tx.get(ratingRef)
    const previous = ratingSnap.exists() ? Number(ratingSnap.data().score) : null

    if (previous === null) {
      tx.set(ratingRef, { score, created_at: Date.now() })
      tx.update(momentRef, {
        rating_sum: increment(score),
        rating_count: increment(1),
      })
      const authorRef = doc(getDb(), 'users', moment.author_uid)
      tx.update(authorRef, { points: increment(POINTS_RECEIVE_RATING) })
    } else if (previous !== score) {
      tx.update(ratingRef, { score, created_at: Date.now() })
      tx.update(momentRef, {
        rating_sum: increment(score - previous),
      })
    }
  })
}

export async function markHighlight(params: {
  eventId: string
  momentId: string
  aiNote?: string
}): Promise<void> {
  const momentRef = doc(getDb(), 'events', params.eventId, 'moments', params.momentId)
  const snap = await getDoc(momentRef)
  if (!snap.exists()) throw new Error('Moment not found')
  const moment = snap.data() as MomentDoc

  await updateDoc(momentRef, {
    is_highlight: true,
    ai_note: params.aiNote ?? '',
  })

  if (!moment.is_highlight) {
    await updateDoc(doc(getDb(), 'users', moment.author_uid), {
      points: increment(POINTS_HIGHLIGHT),
    })
  }
}
