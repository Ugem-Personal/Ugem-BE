export interface CreateReviewerApplicationInput {
  motivation: string;
  experience?: string | null;

  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
  otherSocialUrl?: string | null;
}

export interface UpdateReviewerApplicationInput {
  reviewerApplicationId: string;

  motivation?: string;
  experience?: string | null;

  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
  otherSocialUrl?: string | null;
}

export interface ReviewReviewerApplicationInput {
  status: "Accepted" | "Rejected";
  rejectionReason?: string | null;
}

export interface ReviewerApplicationListQuery {
  status?: "Pending" | "Accepted" | "Rejected";
  pageIndex: number;
  pageSize: number;
}
