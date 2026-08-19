import { matchesAnyPreference } from "./preference-match.js";

export type CustomerPreferenceInput = {
  preferredRestaurantTypes: string[];
  preferredMainDishTypes: string[];
  preferredCategoryIds: string[];
  preferredPriceRanges: string[];
} | null;

type MerchantPreferenceInput = {
  restaurantType: string;
  mainDishType: string;
  priceRange: string;
  categoryIds: string[];
};

export function calculatePreferenceScore(
  preferences: CustomerPreferenceInput,
  merchant: MerchantPreferenceInput,
) {
  if (!preferences) {
    return { hasPreferences: false, score: 0 };
  }

  let matchedWeight = 0;
  let totalWeight = 0;

  if (preferences.preferredRestaurantTypes.length > 0) {
    totalWeight += 25;
    if (
      matchesAnyPreference(
        preferences.preferredRestaurantTypes,
        merchant.restaurantType,
      )
    ) {
      matchedWeight += 25;
    }
  }

  if (preferences.preferredCategoryIds.length > 0) {
    totalWeight += 50;
    const merchantCategoryIds = new Set(merchant.categoryIds);
    if (
      preferences.preferredCategoryIds.some((categoryId) =>
        merchantCategoryIds.has(categoryId),
      )
    ) {
      matchedWeight += 50;
    }
  } else if (preferences.preferredMainDishTypes.length > 0) {
    totalWeight += 50;
    if (
      matchesAnyPreference(
        preferences.preferredMainDishTypes,
        merchant.mainDishType,
      )
    ) {
      matchedWeight += 50;
    }
  }

  if (preferences.preferredPriceRanges.length > 0) {
    totalWeight += 25;
    if (
      matchesAnyPreference(preferences.preferredPriceRanges, merchant.priceRange)
    ) {
      matchedWeight += 25;
    }
  }

  return {
    hasPreferences: totalWeight > 0,
    score: totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 0,
  };
}

