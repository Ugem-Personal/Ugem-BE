import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

import type { CreateFoodInput, UpdateFoodInput } from "./food.types.js";

const foodInclude = {
  categories: {
    include: {
      category: true,
    },
  },
  toppings: {
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc" as const,
    },
  },
  comboItems: {
    include: {
      food: {
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          isAvailable: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  merchant: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
    },
  },
};

const mapFood = (food: any) => ({
  id: food.id,
  foodId: food.id,
  merchantId: food.merchantId,

  name: food.name,
  description: food.description,
  cuisine: food.cuisine,
  price: Number(food.price),
  imageUrl: food.imageUrl,
  isAvailable: food.isAvailable,

  isCombo: food.isCombo ?? false,
  originalPrice: food.originalPrice ? Number(food.originalPrice) : null,
  servingSize: food.servingSize ?? null,

  merchant: food.merchant,

  categoryIds: food.categories.map((item: any) => item.category.id),

  categories: food.categories.map((item: any) => ({
    id: item.category.id,
    name: item.category.name,
    description: item.category.description,
  })),

  toppings: food.toppings.map((topping: any) => ({
    id: topping.id,
    foodId: topping.foodId,
    name: topping.name,
    price: Number(topping.price),
    isActive: topping.isActive,
  })),

  comboItems: (food.comboItems ?? []).map((item: any) => ({
    id: item.id,
    comboId: item.comboId,
    foodId: item.foodId,
    quantity: item.quantity,
    food: item.food
      ? {
          id: item.food.id,
          name: item.food.name,
          price: Number(item.food.price),
          imageUrl: item.food.imageUrl,
          isAvailable: item.food.isAvailable,
        }
      : undefined,
  })),

  createdAt: food.createdAt,
  updatedAt: food.updatedAt,
});

const validateCategories = async (categoryIds: string[]) => {
  const uniqueIds = [...new Set(categoryIds)];

  const categories = await prisma.category.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (categories.length !== uniqueIds.length) {
    throw new AppError(
      400,
      "Một hoặc nhiều danh mục không tồn tại hoặc đã bị khóa",
    );
  }

  return uniqueIds;
};

const validateComboItems = async (
  merchantId: string,
  comboFoodId: string | null,
  items?: { foodId: string; quantity: number }[],
) => {
  if (!items || items.length === 0) {
    return { items: [], calculatedOriginalPrice: 0 };
  }

  const itemMap = new Map<string, number>();
  for (const item of items) {
    if (comboFoodId && item.foodId === comboFoodId) {
      throw new AppError(
        400,
        "Món combo không thể chứa chính nó làm món thành phần",
      );
    }
    const currentQty = itemMap.get(item.foodId) || 0;
    itemMap.set(item.foodId, currentQty + item.quantity);
  }

  const childFoodIds = Array.from(itemMap.keys());
  const foundFoods = await prisma.food.findMany({
    where: {
      id: { in: childFoodIds },
      merchantId,
    },
    select: {
      id: true,
      price: true,
      isCombo: true,
    },
  });

  if (foundFoods.length !== childFoodIds.length) {
    throw new AppError(
      400,
      "Một hoặc nhiều món trong combo không thuộc thực đơn của quán",
    );
  }

  if (foundFoods.some((f) => f.isCombo)) {
    throw new AppError(
      400,
      "Combo không thể chứa món combo khác làm thành phần",
    );
  }

  const validatedList = Array.from(itemMap.entries()).map(
    ([foodId, quantity]) => ({
      foodId,
      quantity,
    }),
  );

  const childPriceMap = new Map(
    foundFoods.map((f) => [f.id, Number(f.price)]),
  );
  const calculatedOriginalPrice = validatedList.reduce(
    (sum, item) => sum + (childPriceMap.get(item.foodId) || 0) * item.quantity,
    0,
  );

  return {
    items: validatedList,
    calculatedOriginalPrice,
  };
};

export const createFood = async (
  merchantId: string,
  input: CreateFoodInput,
) => {
  const categoryIds = await validateCategories(input.categoryIds);

  let comboValidation: {
    items: { foodId: string; quantity: number }[];
    calculatedOriginalPrice: number;
  } | null = null;

  if (input.isCombo) {
    comboValidation = await validateComboItems(
      merchantId,
      null,
      input.comboItems,
    );
    if (!comboValidation.items.length) {
      throw new AppError(400, "Combo phải có ít nhất một món ăn thành phần");
    }
  }

  const duplicate = await prisma.food.findFirst({
    where: {
      merchantId,
      name: {
        equals: input.name.trim(),
        mode: "insensitive",
      },
    },
  });

  if (duplicate) {
    throw new AppError(409, "Merchant đã có món ăn cùng tên");
  }

  const effectiveOriginalPrice =
    input.originalPrice !== undefined && input.originalPrice !== null
      ? new Prisma.Decimal(input.originalPrice)
      : comboValidation && comboValidation.calculatedOriginalPrice > 0
      ? new Prisma.Decimal(comboValidation.calculatedOriginalPrice)
      : null;

  const food = await prisma.food.create({
    data: {
      merchantId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      cuisine: input.cuisine?.trim() || null,
      price: new Prisma.Decimal(input.price),
      imageUrl: input.imageUrl?.trim() || null,
      isAvailable: input.isAvailable ?? true,
      isCombo: input.isCombo ?? false,
      originalPrice: effectiveOriginalPrice,
      servingSize: input.servingSize?.trim() || null,

      categories: {
        create: categoryIds.map((categoryId) => ({
          categoryId,
        })),
      },

      comboItems:
        comboValidation && comboValidation.items.length > 0
          ? {
              create: comboValidation.items.map((ci) => ({
                foodId: ci.foodId,
                quantity: ci.quantity,
              })),
            }
          : undefined,
    },
    include: foodInclude,
  });

  return mapFood(food);
};

export const getMyFoods = async (merchantId: string) => {
  const foods = await prisma.food.findMany({
    where: {
      merchantId,
    },
    include: foodInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  return foods.map(mapFood);
};

export const getFoodsByMerchant = async (
  merchantId: string,
  onlyAvailable = true,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },
  });

  if (!merchant || merchant.status !== "Active") {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const foods = await prisma.food.findMany({
    where: {
      merchantId,
      isAvailable: onlyAvailable ? true : undefined,
    },
    include: foodInclude,
    orderBy: [
      {
        isAvailable: "desc",
      },
      {
        name: "asc",
      },
    ],
  });

  return foods.map(mapFood);
};

export const getFoodById = async (foodId: string) => {
  const food = await prisma.food.findUnique({
    where: {
      id: foodId,
    },
    include: foodInclude,
  });

  if (!food) {
    throw new AppError(404, "Không tìm thấy món ăn");
  }

  return mapFood(food);
};

export const updateFood = async (
  merchantId: string,
  foodId: string,
  input: UpdateFoodInput,
) => {
  const existing = await prisma.food.findUnique({
    where: {
      id: foodId,
    },
  });

  if (!existing) {
    throw new AppError(404, "Không tìm thấy món ăn");
  }

  if (existing.merchantId !== merchantId) {
    throw new AppError(403, "Bạn không có quyền sửa món ăn này");
  }

  const categoryIds =
    input.categoryIds !== undefined
      ? await validateCategories(input.categoryIds)
      : undefined;

  const isTargetCombo =
    input.isCombo !== undefined ? input.isCombo : existing.isCombo;
  let comboValidation: {
    items: { foodId: string; quantity: number }[];
    calculatedOriginalPrice: number;
  } | null = null;

  if (isTargetCombo && input.comboItems !== undefined) {
    comboValidation = await validateComboItems(
      merchantId,
      foodId,
      input.comboItems,
    );
    if (!comboValidation.items.length) {
      throw new AppError(400, "Combo phải có ít nhất một món ăn thành phần");
    }
  }

  const effectiveOriginalPrice =
    input.originalPrice !== undefined
      ? input.originalPrice !== null
        ? new Prisma.Decimal(input.originalPrice)
        : null
      : comboValidation && comboValidation.calculatedOriginalPrice > 0
      ? new Prisma.Decimal(comboValidation.calculatedOriginalPrice)
      : undefined;

  const food = await prisma.$transaction(async (transaction) => {
    if (categoryIds) {
      await transaction.foodCategory.deleteMany({
        where: {
          foodId,
        },
      });
    }

    if (input.comboItems !== undefined || input.isCombo === false) {
      await transaction.comboItem.deleteMany({
        where: {
          comboId: foodId,
        },
      });
    }

    return transaction.food.update({
      where: {
        id: foodId,
      },
      data: {
        name: input.name?.trim(),

        description:
          input.description !== undefined
            ? input.description?.trim() || null
            : undefined,

        cuisine:
          input.cuisine !== undefined
            ? input.cuisine?.trim() || null
            : undefined,

        price:
          input.price !== undefined
            ? new Prisma.Decimal(input.price)
            : undefined,

        imageUrl:
          input.imageUrl !== undefined
            ? input.imageUrl?.trim() || null
            : undefined,

        isAvailable: input.isAvailable,

        isCombo: input.isCombo,
        originalPrice: effectiveOriginalPrice,
        servingSize:
          input.servingSize !== undefined
            ? input.servingSize?.trim() || null
            : undefined,

        categories: categoryIds
          ? {
              create: categoryIds.map((categoryId) => ({
                categoryId,
              })),
            }
          : undefined,

        comboItems:
          comboValidation && comboValidation.items.length > 0
            ? {
                create: comboValidation.items.map((ci) => ({
                  foodId: ci.foodId,
                  quantity: ci.quantity,
                })),
              }
            : undefined,
      },
      include: foodInclude,
    });
  });

  return mapFood(food);
};

export const updateAvailability = async (
  merchantId: string,
  foodId: string,
  isAvailable: boolean,
) => {
  const food = await prisma.food.findUnique({
    where: {
      id: foodId,
    },
  });

  if (!food) {
    throw new AppError(404, "Không tìm thấy món ăn");
  }

  if (food.merchantId !== merchantId) {
    throw new AppError(403, "Bạn không có quyền cập nhật món ăn này");
  }

  const updatedFood = await prisma.food.update({
    where: {
      id: foodId,
    },
    data: {
      isAvailable,
    },
    include: foodInclude,
  });

  return mapFood(updatedFood);
};

export const deleteFood = async (merchantId: string, foodId: string) => {
  const food = await prisma.food.findUnique({
    where: {
      id: foodId,
    },
  });

  if (!food) {
    throw new AppError(404, "Không tìm thấy món ăn");
  }

  if (food.merchantId !== merchantId) {
    throw new AppError(403, "Bạn không có quyền xóa món ăn này");
  }

  return prisma.food.delete({
    where: {
      id: foodId,
    },
  });
};
