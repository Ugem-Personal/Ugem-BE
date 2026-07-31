import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
const mapTopping = (topping) => ({
    id: topping.id,
    toppingId: topping.id,
    foodId: topping.foodId,
    name: topping.name,
    price: Number(topping.price),
    isActive: topping.isActive,
    createdAt: topping.createdAt,
    updatedAt: topping.updatedAt,
});
const checkFoodOwnership = async (merchantId, foodId) => {
    const food = await prisma.food.findUnique({
        where: {
            id: foodId,
        },
    });
    if (!food) {
        throw new AppError(404, "Không tìm thấy món ăn");
    }
    if (food.merchantId !== merchantId) {
        throw new AppError(403, "Bạn không có quyền quản lý topping của món ăn này");
    }
    return food;
};
export const getToppingsByFood = async (foodId, includeInactive = false) => {
    const food = await prisma.food.findUnique({
        where: {
            id: foodId,
        },
    });
    if (!food) {
        throw new AppError(404, "Không tìm thấy món ăn");
    }
    const toppings = await prisma.foodTopping.findMany({
        where: {
            foodId,
            isActive: includeInactive ? undefined : true,
        },
        orderBy: {
            name: "asc",
        },
    });
    return toppings.map(mapTopping);
};
export const createTopping = async (merchantId, input) => {
    await checkFoodOwnership(merchantId, input.foodId);
    const duplicate = await prisma.foodTopping.findFirst({
        where: {
            foodId: input.foodId,
            name: {
                equals: input.name.trim(),
                mode: "insensitive",
            },
        },
    });
    if (duplicate) {
        throw new AppError(409, "Món ăn đã có topping cùng tên");
    }
    const topping = await prisma.foodTopping.create({
        data: {
            foodId: input.foodId,
            name: input.name.trim(),
            price: new Prisma.Decimal(input.price),
            isActive: input.isActive ?? true,
        },
    });
    return mapTopping(topping);
};
export const updateTopping = async (merchantId, toppingId, input) => {
    const topping = await prisma.foodTopping.findUnique({
        where: {
            id: toppingId,
        },
        include: {
            food: true,
        },
    });
    if (!topping) {
        throw new AppError(404, "Không tìm thấy topping");
    }
    if (topping.food.merchantId !== merchantId) {
        throw new AppError(403, "Bạn không có quyền sửa topping này");
    }
    const updated = await prisma.foodTopping.update({
        where: {
            id: toppingId,
        },
        data: {
            name: input.name?.trim(),
            price: input.price !== undefined ? new Prisma.Decimal(input.price) : undefined,
            isActive: input.isActive,
        },
    });
    return mapTopping(updated);
};
export const deleteTopping = async (merchantId, toppingId) => {
    const topping = await prisma.foodTopping.findUnique({
        where: {
            id: toppingId,
        },
        include: {
            food: true,
        },
    });
    if (!topping) {
        throw new AppError(404, "Không tìm thấy topping");
    }
    if (topping.food.merchantId !== merchantId) {
        throw new AppError(403, "Bạn không có quyền xóa topping này");
    }
    return prisma.foodTopping.delete({
        where: {
            id: toppingId,
        },
    });
};
