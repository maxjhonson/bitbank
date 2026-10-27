export const ratingToScore = (r: number): number => r * 2
export const scoreToRating = (s: number): number => Math.round(s / 2)
