import { MerchantStatus } from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

const wishlistInclude = {
  merchant: {
    select: {
      id: true,
      name: true,
      description: true,
      restaurantType: true,
      mainDishType: true,
      priceRange: true,
      address: true,
      logoUrl: true,
      rating: true,
      reviewCount: true,
      status: true,
    },
  },
};

const mapWishlist = (wishlist: any) => ({
  merchantId: wishlist.merchantId,
  id: wishlist.merchant.id,
  name: wishlist.merchant.name,
  logoUrl: wishlist.merchant.logoUrl,
  rating: Number(wishlist.merchant.rating),
  createdAt: wishlist.createdAt,
});

export const getMyWishlists = async (customerId: string) => {
  const wishlists = await prisma.wishlist.findMany({
    where: {
      customerId,
      merchant: {
        status: MerchantStatus.Active,
      },
    },
    include: wishlistInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  return wishlists.map(mapWishlist);
};

export const addWishlist = async (customerId: string, merchantId: string) => {
  const merchant = await prisma.merchant.findFirst({
    where: {
      id: merchantId,
      status: MerchantStatus.Active,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const existing = await prisma.wishlist.findUnique({
    where: {
      customerId_merchantId: {
        customerId,
        merchantId,
      },
    },
  });

  if (existing) {
    throw new AppError(409, "Merchant đã có trong danh sách yêu thích");
  }

  const wishlist = await prisma.wishlist.create({
    data: {
      customerId,
      merchantId,
    },
    include: wishlistInclude,
  });

  return mapWishlist(wishlist);
};

export const removeWishlist = async (
  customerId: string,
  merchantId: string,
) => {
  const existing = await prisma.wishlist.findUnique({
    where: {
      customerId_merchantId: {
        customerId,
        merchantId,
      },
    },
  });

  if (!existing) {
    throw new AppError(404, "Merchant không có trong danh sách yêu thích");
  }

  await prisma.wishlist.delete({
    where: {
      customerId_merchantId: {
        customerId,
        merchantId,
      },
    },
  });

  return {
    merchantId,
  };
};

export const checkWishlist = async (customerId: string, merchantId: string) => {
  const wishlist = await prisma.wishlist.findUnique({
    where: {
      customerId_merchantId: {
        customerId,
        merchantId,
      },
    },
  });

  return {
    merchantId,
    isWishlisted: Boolean(wishlist),
  };
};
