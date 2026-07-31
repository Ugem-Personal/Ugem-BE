export interface CreateAffiliateLinkInput {
  merchantId: string;
}

export interface UpdateAffiliateLinkStatusInput {
  isActive: boolean;
}

export interface AffiliateEarningsQuery {
  pageIndex: number;
  pageSize: number;
}
