export interface ReviewDetailInput {
  orderDetailId: string;
  rating?: number;
  content?: string | null;
}

export interface CreateReviewInput {
  merchantId?: string;

  orderId: string;
  rating: number;

  content?: string | null;
  imageUrl?: string | null;

  details?: {
    orderDetailId: string;
    rating?: number;
    content?: string | null;
  }[];
}

export interface UpdateReviewInput {
  rating?: number;
  content?: string | null;
  imageUrl?: string | null;

  reviewDetails?: {
    reviewDetailId: string;
    rating?: number;
    detailContent?: string | null;
  }[];
}

export interface ReviewListQuery {
  pageIndex: number;
  pageSize: number;
}
