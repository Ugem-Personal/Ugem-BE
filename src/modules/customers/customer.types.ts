export interface SearchCustomersByEmailQuery {
  email: string;
  limit: number;
}

export interface SearchCustomersByPhoneNumberQuery {
  phoneNumber: string;
  limit: number;
}

export interface UpdateCustomerPreferencesInput {
  preferredRestaurantTypes: string[];
  preferredMainDishTypes: string[];
  preferredCategoryIds: string[];
  preferredPriceRanges: string[];
}
