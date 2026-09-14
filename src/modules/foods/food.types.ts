export interface ComboItemInput {
  foodId: string;
  quantity: number;
}

export interface CreateFoodInput {
  name: string;
  description?: string | null;
  cuisine?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
  categoryIds: string[];
  isCombo?: boolean;
  originalPrice?: number | null;
  servingSize?: string | null;
  comboItems?: ComboItemInput[];
}

export interface UpdateFoodInput {
  name?: string;
  description?: string | null;
  cuisine?: string | null;
  price?: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
  categoryIds?: string[];
  isCombo?: boolean;
  originalPrice?: number | null;
  servingSize?: string | null;
  comboItems?: ComboItemInput[];
}
