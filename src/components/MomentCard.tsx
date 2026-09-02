import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { generateCaption } from '../lib/ai'
import { getDb, type MomentDoc } from '../lib/firebase'
import { averageRating } from '../lib/points'
import { submitRating } from '../lib/ratings'
import { CaptionPanel } from './CaptionPanel'
import { RatingStars } from './RatingStars'
import { ShareExport } from './ShareExport'

type Props = {
  eventId: string
  eventTitle: string
  momentId: string
  moment: MomentDoc
  currentUid: string
  onUpdated: () => void
}

export function MomentCard({
  eventId,
  eventTitle,
  momentId,
  moment,
  currentUid,
  onUpdated,
}: Props) {
  const [caption, setCaption] = useState(moment.caption)
  const [hashtags, setHashtags] = useState(moment.hashtags ?? [])
  const [generating, setGenerating] = useState(false)
  const [ratingBusy, setRatingBusy] = useState(false)
  const [myRating, setMyRating] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCaption(moment.caption)
    setHashtags(moment.hashtags ?? [])
  }, [moment.caption, moment.hashtags])

  useEffect(() => {
    if (moment.author_uid === currentUid) {
      setMyRating(0)
      return
    }
    const ratingRef = doc(getDb(), 'events', eventId, 'moments', momentId, 'ratings', currentUid)
    return onSnapshot(ratingRef, (snap) => {
      setMyRating(snap.exists() ? Number(snap.data().score) || 0 : 0)
    })
  }, [eventId, momentId, currentUid, moment.author_uid])

  const avg = averageRating(moment.rating_sum, moment.rating_count)
  const isOwner = moment.author_uid === currentUid
  const ratingLabel =
    moment.rating_count > 0
      ? `${avg.toFixed(1)} avg · ${moment.rating_count} rating${moment.rating_count === 1 ? '' : 's'}`
      : 'No ratings yet'

  async function onGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const result = await generateCaption({
        eventId,
        momentId,
        imageUrl: moment.media_url,
        eventTitle,
      })
      setCaption(result.caption)
      setHashtags(result.hashtags)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate caption')
    } finally {
      setGenerating(false)
    }
  }

  async function onRate(score: number) {
    setRatingBusy(true)
    setError(null)
    try {
      await submitRating({ eventId, momentId, uid: currentUid, score })
      setMyRating(score)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rate')
    } finally {
      setRatingBusy(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {moment.media_type === 'video' ? (
        <video
          src={moment.media_url}
          controls
          playsInline
          className="aspect-square w-full bg-slate-900 object-contain"
        />
      ) : (
        <img
          src={moment.media_url}
          alt={caption || `Moment by ${moment.author_name}`}
          className="aspect-square w-full object-cover"
        />
      )}
      <div className="space-y-3 p-4">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-50">{moment.author_name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <RatingStars value={avg} readOnly size="sm" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ratingLabel}
              {moment.is_highlight ? ' · Highlight' : ''}
            </p>
          </div>
        </div>

        {isOwner ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Others can rate this moment. You cannot rate your own upload.
          </p>
        ) : (
          <div
            className={`relative z-10 rounded-xl border border-[#FFD700]/40 bg-slate-50 p-3 dark:bg-slate-800/60 ${
              ratingBusy ? 'opacity-60' : ''
            }`}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Tap to rate {myRating > 0 ? `· your score ${myRating}/5` : ''}
            </p>
            <RatingStars value={myRating} onChange={onRate} size="lg" />
          </div>
        )}

        {isOwner && moment.media_type === 'photo' && (
          <CaptionPanel
            caption={caption}
            hashtags={hashtags}
            onCaptionChange={setCaption}
            onGenerate={onGenerate}
            generating={generating}
          />
        )}

        {!isOwner && caption && (
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{caption}</p>
        )}

        <ShareExport mediaUrl={moment.media_url} caption={caption} hashtags={hashtags} />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </article>
  )
}
