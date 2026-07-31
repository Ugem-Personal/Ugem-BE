export interface CreateStaffInput {
  email: string;
  fullName: string;
  password: string;
  phoneNumber: string;
}

export interface MerchantRevenueListQuery {
  searchTerm?: string;
  pageIndex: number;
  pageSize: number;
}

export type RevenuePeriodType = "Day" | "Week" | "Month" | "Year";
