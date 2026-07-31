export interface CreateFoodInput {
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
  categoryIds: string[];
}

export interface UpdateFoodInput {
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
  categoryIds?: string[];
}
