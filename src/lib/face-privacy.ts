/** Bump when privacy notice text changes so members re-consent. */
export const FACE_FIND_CONSENT_VERSION = 'v1'

export const FACE_FIND_PRIVACY_TITLE = 'Face matching privacy notice'

export const FACE_FIND_PRIVACY_BODY = `GDG Moments can compare a selfie you provide with faces detected in this event’s photos so you can find pictures that may include you.

By continuing you agree that:
• Face descriptors are computed only for Find My Photos in this event room.
• Data stays scoped to this event and is not sold or used for advertising.
• Matching is probabilistic and may miss you or match incorrectly.
• You can skip this feature; the normal upload and feed flow does not require it.

This is a privacy consent for biometric-adjacent processing, not a legal NDA.`

export function hasValidFaceFindConsent(member: {
  face_find_consent_at?: number | null
  face_find_consent_version?: string | null
} | null): boolean {
  if (!member?.face_find_consent_at) return false
  return member.face_find_consent_version === FACE_FIND_CONSENT_VERSION
}
