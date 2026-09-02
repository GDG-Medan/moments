export const POINTS_UPLOAD = 5
export const POINTS_RECEIVE_RATING = 2
export const POINTS_HIGHLIGHT = 10

export function averageRating(ratingSum: number, ratingCount: number): number {
  if (ratingCount <= 0) return 0
  return Math.round((ratingSum / ratingCount) * 10) / 10
}
