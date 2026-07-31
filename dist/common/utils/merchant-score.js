export const calculateUnderratedScore = (rating) => Number(Math.max(0, Math.min(rating / 5, 1)).toFixed(2));
