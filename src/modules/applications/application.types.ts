export interface ApplicationMenuInput {
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  category: string;
}

export interface CreateApplicationInput {
  name: string;
  description?: string | null;
  restaurantType: string;
  mainDishType: string;
  priceRange: string;
  email: string;
  phone: string;
  logoUrl?: string | null;
  openingHours: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  menu: ApplicationMenuInput[];
}

export type UpdateApplicationInput = CreateApplicationInput;

export interface ReviewApplicationInput {
  status: "Accepted" | "Rejected";
  rejectionReason?: string | null;
}

export interface ListApplicationsQuery {
  status?: "Draft" | "Pending" | "Accepted" | "Rejected";

  search?: string;
  pageIndex: number;
  pageSize: number;
}
