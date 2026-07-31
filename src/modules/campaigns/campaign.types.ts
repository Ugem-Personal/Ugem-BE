export interface CreateCampaignInput {
  name?: string;
  title?: string;

  code?: string;

  description?: string | null;

  discountType?: "Percentage" | "FixedAmount";
  isPercentage?: boolean;

  discountValue: number;

  minimumOrderAmount?: number;
  minOrderAmount?: number;

  maximumDiscount?: number | null;
  maxDiscountAmount?: number | null;

  usageLimit?: number | null;
  quantity?: number | null;

  maxUsagePerUser?: number;

  isGlobal?: boolean;
  isNewUserOnly?: boolean;

  startAt?: string;
  startDate?: string;

  endAt?: string;
  endDate?: string;

  isActive?: boolean;
}

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
  id?: string;
}
