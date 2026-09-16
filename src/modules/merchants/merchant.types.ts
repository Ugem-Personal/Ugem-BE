export interface MerchantListQuery {
  customerId?: string;
  search?: string;

  categoryId?: string;

  restaurantType?: string;
  mainDishType?: string;
  priceRange?: string;
  country?: string;
  city?: string;
  area?: string;

  latitude?: number;
  longitude?: number;
  radiusKm?: number;

  pageIndex: number;
  pageSize: number;
}

export interface UpdateMerchantProfileInput {
  name?: string;
  merchantName?: string;

  description?: string | null;
  merchantDescription?: string | null;

  restaurantType?: string;
  mainDishType?: string;
  priceRange?: string;

  email?: string;
  phone?: string;
  address?: string;
  openingHours?: string;
  country?: string;
  city?: string | null;
  area?: string | null;

  bankCode?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankTransferEnabled?: boolean;

  latitude?: number | null;
  longitude?: number | null;
  logoUrl?: string | null;
}

export interface StaffMerchantListQuery {
  searchTerm?: string;
  pageIndex: number;
  pageSize: number;
}

export interface MerchantMapQuery {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
  zoomLevel: number;
}
