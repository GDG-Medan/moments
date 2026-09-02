import { httpsCallable } from 'firebase/functions'
import { getFirebaseFunctions } from './firebase'

export type CaptionResult = {
  caption: string
  hashtags: string[]
}

export type HighlightSuggestion = {
  moment_id: string
  amplify_caption: string
  reason: string
}

export async function generateCaption(params: {
  eventId: string
  momentId: string
  imageUrl: string
  eventTitle: string
}): Promise<CaptionResult> {
  const callable = httpsCallable<
    {
      event_id: string
      moment_id: string
      image_url: string
      event_title: string
    },
    CaptionResult
  >(getFirebaseFunctions(), 'generateCaption')

  const result = await callable({
    event_id: params.eventId,
    moment_id: params.momentId,
    image_url: params.imageUrl,
    event_title: params.eventTitle,
  })
  return result.data
}

export async function suggestHighlights(eventId: string): Promise<HighlightSuggestion[]> {
  const callable = httpsCallable<{ event_id: string }, { suggestions: HighlightSuggestion[] }>(
    getFirebaseFunctions(),
    'suggestHighlights',
  )
  const result = await callable({ event_id: eventId })
  return result.data.suggestions ?? []
}
