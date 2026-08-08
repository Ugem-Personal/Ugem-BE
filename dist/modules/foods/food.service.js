import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
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
            name: "asc",
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
const mapFood = (food) => ({
    id: food.id,
    foodId: food.id,
    merchantId: food.merchantId,
    name: food.name,
    description: food.description,
    cuisine: food.cuisine,
    price: Number(food.price),
    imageUrl: food.imageUrl,
    isAvailable: food.isAvailable,
    merchant: food.merchant,
    categoryIds: food.categories.map((item) => item.category.id),
    categories: food.categories.map((item) => ({
        id: item.category.id,
        name: item.category.name,
        description: item.category.description,
    })),
    toppings: food.toppings.map((topping) => ({
        id: topping.id,
        foodId: topping.foodId,
        name: topping.name,
        price: Number(topping.price),
        isActive: topping.isActive,
    })),
    createdAt: food.createdAt,
    updatedAt: food.updatedAt,
});
const validateCategories = async (categoryIds) => {
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
        throw new AppError(400, "Một hoặc nhiều danh mục không tồn tại hoặc đã bị khóa");
    }
    return uniqueIds;
};
export const createFood = async (merchantId, input) => {
    const categoryIds = await validateCategories(input.categoryIds);
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
    const food = await prisma.food.create({
        data: {
            merchantId,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            cuisine: input.cuisine?.trim() || null,
            price: new Prisma.Decimal(input.price),
            imageUrl: input.imageUrl?.trim() || null,
            isAvailable: input.isAvailable ?? true,
            categories: {
                create: categoryIds.map((categoryId) => ({
                    categoryId,
                })),
            },
        },
        include: foodInclude,
    });
    return mapFood(food);
};
export const getMyFoods = async (merchantId) => {
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
export const getFoodsByMerchant = async (merchantId, onlyAvailable = true) => {
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
export const getFoodById = async (foodId) => {
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
export const updateFood = async (merchantId, foodId, input) => {
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
    const categoryIds = input.categoryIds !== undefined
        ? await validateCategories(input.categoryIds)
        : undefined;
    const food = await prisma.$transaction(async (transaction) => {
        if (categoryIds) {
            await transaction.foodCategory.deleteMany({
                where: {
                    foodId,
                },
            });
        }
        return transaction.food.update({
            where: {
                id: foodId,
            },
            data: {
                name: input.name?.trim(),
                description: input.description !== undefined
                    ? input.description?.trim() || null
                    : undefined,
                cuisine: input.cuisine !== undefined
                    ? input.cuisine?.trim() || null
                    : undefined,
                price: input.price !== undefined
                    ? new Prisma.Decimal(input.price)
                    : undefined,
                imageUrl: input.imageUrl !== undefined
                    ? input.imageUrl?.trim() || null
                    : undefined,
                isAvailable: input.isAvailable,
                categories: categoryIds
                    ? {
                        create: categoryIds.map((categoryId) => ({
                            categoryId,
                        })),
                    }
                    : undefined,
            },
            include: foodInclude,
        });
    });
    return mapFood(food);
};
export const updateAvailability = async (merchantId, foodId, isAvailable) => {
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
export const deleteFood = async (merchantId, foodId) => {
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
