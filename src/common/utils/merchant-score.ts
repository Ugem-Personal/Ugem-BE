export const calculateUnderratedScore = (rating: number): number =>
  Number(Math.max(0, Math.min(rating / 5, 1)).toFixed(2));
