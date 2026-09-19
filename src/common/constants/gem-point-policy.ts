export const GEM_POINT_POLICY = {
  VERIFIED_VISIT: 10,
  VERIFIED_REVIEW: 15,
  VERIFIED_REVIEW_WITH_IMAGE: 20,
} as const;

export type GemPointAction = keyof typeof GEM_POINT_POLICY;
