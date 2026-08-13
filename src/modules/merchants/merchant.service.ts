import {
  MerchantStatus,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
  MerchantListQuery,
  MerchantMapQuery,
  StaffMerchantListQuery,
  UpdateMerchantProfileInput,
} from "./merchant.types.js";
import { env } from "../../config/env.js";
import { calculateUnderratedScore } from "../../common/utils/merchant-score.js";

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

type MapMerchantInput = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  restaurantType: string;
  mainDishType: string;
  priceRange: string;
  email: string;
  phone: string;
  address: string;
  openingHours: string;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  logoUrl: string | null;
  rating: Prisma.Decimal;
  reviewCount: number;
  totalViews: number;
  status: MerchantStatus;
  createdAt: Date;
  updatedAt: Date;
  campaigns?: Array<{
    isActive: boolean;
    startAt: Date;
    endAt: Date;
    usageLimit: number | null;
    usedCount: number;
  }>;
};

type CustomerPreferences = {
  preferredRestaurantTypes: string[];
  preferredMainDishTypes: string[];
  preferredPriceRanges: string[];
} | null;

const mapMerchant = (
  merchant: MapMerchantInput,
  customerLat?: number,
  customerLng?: number,
  customerPreferences?: CustomerPreferences,
) => {
  const rating = Number(merchant.rating);
  const merchantLat =
    merchant.latitude !== null ? Number(merchant.latitude) : null;
  const merchantLng =
    merchant.longitude !== null ? Number(merchant.longitude) : null;

  let distance: number | null = null;
  if (
    customerLat !== undefined &&
    customerLng !== undefined &&
    merchantLat !== null &&
    merchantLng !== null
  ) {
    distance = calculateDistanceKm(
      customerLat,
      customerLng,
      merchantLat,
      merchantLng,
    );
  }

  const now = new Date();
  const hasActiveCampaign = merchant.campaigns
    ? merchant.campaigns.some(
        (c) =>
          c.isActive &&
          new Date(c.startAt) <= now &&
          new Date(c.endAt) >= now &&
          (c.usageLimit == null || c.usedCount < c.usageLimit),
      )
    : false;

  const dbUnderratedScore = (merchant as any).underratedScore
    ? Number((merchant as any).underratedScore)
    : 0;
  const underratedScore =
    dbUnderratedScore > 0
      ? dbUnderratedScore
      : calculateUnderratedScore(
          rating,
          merchant.reviewCount,
          merchant.totalViews,
        );

  const strengthIndex = (merchant as any).strengthIndex
    ? Number((merchant as any).strengthIndex)
    : 0;
  const recommendationRank = (merchant as any).recommendationRank ?? null;

  let preferenceScore = 0;
  if (customerPreferences) {
    let matched = 0;
    let total = 0;

    if (customerPreferences.preferredRestaurantTypes.length > 0) {
      total++;
      if (
        customerPreferences.preferredRestaurantTypes.includes(
          merchant.restaurantType,
        )
      ) {
        matched++;
      }
    }

    if (customerPreferences.preferredMainDishTypes.length > 0) {
      total++;
      if (
        customerPreferences.preferredMainDishTypes.includes(
          merchant.mainDishType,
        )
      ) {
        matched++;
      }
    }

    if (customerPreferences.preferredPriceRanges.length > 0) {
      total++;
      if (
        customerPreferences.preferredPriceRanges.includes(merchant.priceRange)
      ) {
        matched++;
      }
    }

    preferenceScore = total > 0 ? (matched / total) * 100 : 0;
  }

  const campaignScore = hasActiveCampaign ? 100 : 0;
  const distanceScore =
    distance !== null ? Math.max(0, 100 - distance * 5) : 100;
  const ratingScore = (rating / 5) * 100;

  const recommendationScore =
    Math.round(
      (preferenceScore * 0.25 +
        underratedScore * 0.30 +
        campaignScore * 0.15 +
        distanceScore * 0.15 +
        ratingScore * 0.15) *
        100,
    ) / 100;

  return {
    id: merchant.id,
    merchantId: merchant.id,
    userId: merchant.userId,
    name: merchant.name,
    description: merchant.description,
    restaurantType: merchant.restaurantType,
    mainDishType: merchant.mainDishType,
    priceRange: merchant.priceRange,
    email: merchant.email,
    phone: merchant.phone,
    address: merchant.address,
    openingHours: merchant.openingHours,
    latitude: merchantLat,
    longitude: merchantLng,
    logoUrl: merchant.logoUrl,
    rating,
    strengthIndex,
    underratedScore,
    preferenceScore,
    recommendationRank,
    distance,
    hasActiveCampaign,
    recommendationScore,
    reviewCount: merchant.reviewCount,
    totalViews: merchant.totalViews,
    status: merchant.status,
    createdAt: merchant.createdAt,
    updatedAt: merchant.updatedAt,
  };
};

const mapStaffMerchant = (merchant: {
  id: string;
  name: string;
  description: string | null;
  address: string;
  logoUrl: string | null;
  email: string;
  rating: Prisma.Decimal;
  reviewCount: number;
  openingHours: string;
  restaurantType: string;
  mainDishType: string;
  status: MerchantStatus;
}) => {
  const rating = Number(merchant.rating);

  return {
    id: merchant.id,
    merchantId: merchant.id,
    name: merchant.name,
    description: merchant.description,
    address: merchant.address,
    logoUrl: merchant.logoUrl,
    email: merchant.email,
    openingHours: merchant.openingHours,
    restaurantType: merchant.restaurantType,
    mainDishType: merchant.mainDishType,
    rating,
    reviewCount: merchant.reviewCount,
    underratedScore: calculateUnderratedScore(rating, merchant.reviewCount, 0),
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
    status: merchant.status,
  };
};

export const getMerchants = async (query: MerchantListQuery) => {
  const pageIndex = query.pageIndex || 1;
  const pageSize = query.pageSize || 10;

  const customerPreferences = query.customerId
    ? await prisma.customer.findUnique({
        where: {
          id: query.customerId,
        },
        select: {
          preferredRestaurantTypes: true,
          preferredMainDishTypes: true,
          preferredPriceRanges: true,
        },
      })
    : null;


  const where: Prisma.MerchantWhereInput = {
    status: MerchantStatus.Active,

    restaurantType: query.restaurantType
      ? {
          contains: query.restaurantType,
          mode: "insensitive",
        }
      : undefined,

    mainDishType: query.mainDishType
      ? {
          contains: query.mainDishType,
          mode: "insensitive",
        }
      : undefined,

    priceRange: query.priceRange
      ? {
          contains: query.priceRange,
          mode: "insensitive",
        }
      : undefined,
    foods: query.categoryId
      ? {
          some: {
            isAvailable: true,

            categories: {
              some: {
                categoryId: query.categoryId,

                category: {
                  isActive: true,
                },
              },
            },
          },
        }
      : undefined,

    OR: query.search
      ? [
          {
            name: {
              contains: query.search,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: query.search,
              mode: "insensitive",
            },
          },
          {
            address: {
              contains: query.search,
              mode: "insensitive",
            },
          },
          {
            mainDishType: {
              contains: query.search,
              mode: "insensitive",
            },
          },

          /*
           * Cho phép tìm theo tên món ăn.
           */
          {
            foods: {
              some: {
                isAvailable: true,

                name: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            },
          },
        ]
      : undefined,
  };

  const rawMerchants = await prisma.merchant.findMany({
    where,
    include: {
      campaigns: {
        where: {
          isActive: true,
        },
      },
    },
  });

  let mapped = rawMerchants.map((m) =>
    mapMerchant(m, query.latitude, query.longitude, customerPreferences),
  );

  if (query.latitude !== undefined && query.longitude !== undefined) {
    const radiusKm = query.radiusKm ?? 15;
    mapped = mapped.filter(
      (m) => m.distance === null || m.distance <= radiusKm,
    );
  }

  mapped.sort((a, b) => b.recommendationScore - a.recommendationScore);

  const totalItems = mapped.length;
  const skip = (pageIndex - 1) * pageSize;
  const pagedItems = mapped.slice(skip, skip + pageSize);

  return {
    items: pagedItems,
    totalItems,
    pageIndex,
    pageSize,
    totalPages: Math.ceil(totalItems / pageSize),
  };
};
































export const getMerchantById = async (merchantId: string) => {
  const merchant = await prisma.merchant.findFirst({
    where: {
      id: merchantId,
      status: MerchantStatus.Active,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  return mapMerchant(merchant);
};

export const getMyMerchant = async (merchantId: string) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant của tài khoản");
  }

  return mapMerchant(merchant);
};

export const updateMyMerchant = async (
  merchantId: string,
  input: UpdateMerchantProfileInput,
) => {
  const existing = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },
  });

  if (!existing) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const merchant = await prisma.merchant.update({
    where: {
      id: merchantId,
    },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,

      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : undefined,

      restaurantType:
        input.restaurantType !== undefined
          ? input.restaurantType.trim()
          : undefined,

      mainDishType:
        input.mainDishType !== undefined
          ? input.mainDishType.trim()
          : undefined,

      priceRange:
        input.priceRange !== undefined ? input.priceRange.trim() : undefined,

      email:
        input.email !== undefined
          ? input.email.trim().toLowerCase()
          : undefined,

      phone: input.phone !== undefined ? input.phone.trim() : undefined,

      address: input.address !== undefined ? input.address.trim() : undefined,

      openingHours:
        input.openingHours !== undefined
          ? input.openingHours.trim()
          : undefined,

      latitude:
        input.latitude !== undefined
          ? input.latitude === null
            ? null
            : new Prisma.Decimal(input.latitude)
          : undefined,

      longitude:
        input.longitude !== undefined
          ? input.longitude === null
            ? null
            : new Prisma.Decimal(input.longitude)
          : undefined,

      logoUrl:
        input.logoUrl !== undefined ? input.logoUrl?.trim() || null : undefined,
    },
  });

  return mapMerchant(merchant);
};

export const getMerchantsForMap = async (query: MerchantMapQuery) => {
  const merchants = await prisma.merchant.findMany({
    where: {
      status: MerchantStatus.Active,

      latitude: {
        not: null,

        gte: new Prisma.Decimal(query.minLatitude),

        lte: new Prisma.Decimal(query.maxLatitude),
      },

      longitude: {
        not: null,

        gte: new Prisma.Decimal(query.minLongitude),

        lte: new Prisma.Decimal(query.maxLongitude),
      },
    },

    select: {
      id: true,
      name: true,
      address: true,

      latitude: true,
      longitude: true,

      logoUrl: true,

      rating: true,
      reviewCount: true,

      priceRange: true,
      restaurantType: true,
      mainDishType: true,

      totalViews: true,
    },

    orderBy: [
      {
        rating: "desc",
      },
      {
        reviewCount: "desc",
      },
    ],

    /*
     * Tránh trả quá nhiều marker khi bản đồ zoom xa.
     */
    take: query.zoomLevel < 10 ? 200 : query.zoomLevel < 15 ? 500 : 1000,
  });

  return merchants.map((merchant) => ({
    id: merchant.id,
    merchantId: merchant.id,

    name: merchant.name,
    address: merchant.address,

    latitude: Number(merchant.latitude),

    longitude: Number(merchant.longitude),

    /*
     * Alias một số component bản đồ có thể đọc.
     */
    lat: Number(merchant.latitude),
    lng: Number(merchant.longitude),

    logoUrl: merchant.logoUrl,

    rating: Number(merchant.rating),
    underratedScore: calculateUnderratedScore(Number(merchant.rating)),

    reviewCount: merchant.reviewCount,

    priceRange: merchant.priceRange,

    restaurantType: merchant.restaurantType,

    mainDishType: merchant.mainDishType,

    totalViews: merchant.totalViews,
  }));
};

export const incrementMerchantView = async (merchantId: string) => {
  const merchant = await prisma.merchant.findFirst({
    where: {
      id: merchantId,
      status: MerchantStatus.Active,
    },

    select: {
      id: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const updatedMerchant = await prisma.merchant.update({
    where: {
      id: merchantId,
    },

    data: {
      totalViews: {
        increment: 1,
      },
    },

    select: {
      id: true,
      totalViews: true,
    },
  });

  return {
    merchantId: updatedMerchant.id,
    totalViews: updatedMerchant.totalViews,
  };
};

export const getMyMerchantViews = async (merchantId: string) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      totalViews: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  return {
    merchantId: merchant.id,
    totalViews: merchant.totalViews,
  };
};

export const getMyMerchantStatistics = async (merchantId: string) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
      totalViews: true,
      rating: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const orders = await prisma.order.findMany({
    where: {
      merchantId,

      status: OrderStatus.Completed,

      paymentStatus: OrderPaymentStatus.Paid,
    },

    select: {
      id: true,
      finalPrice: true,
      reviewerCommission: true,
    },
  });

  const totalOrders = orders.length;

  const totalRevenue = orders.reduce(
    (total, order) => total + Number(order.finalPrice),
    0,
  );

  const reviewerFee = orders.reduce(
    (total, order) => total + Number(order.reviewerCommission),
    0,
  );

  const platformFee = Number(
    (totalRevenue * (env.PLATFORM_FEE_PERCENT / 100)).toFixed(2),
  );

  const merchantReceive = Number(
    Math.max(totalRevenue - platformFee - reviewerFee, 0).toFixed(2),
  );

  const avgOrderValue =
    totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

  const underratedScore = calculateUnderratedScore(Number(merchant.rating));

  return {
    merchantId: merchant.id,
    merchantName: merchant.name,

    totalViews: merchant.totalViews,
    totalOrders,
    totalRevenue,

    platformFee,
    reviewerFee,
    merchantReceive,

    avgOrderValue,
    underratedScore,
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
  };
};

export const getStaffMerchants = async (query: StaffMerchantListQuery) => {
  const pageIndex = query.pageIndex || 1;
  const pageSize = query.pageSize || 10;
  const skip = (pageIndex - 1) * pageSize;

  const searchTerm = query.searchTerm?.trim() || undefined;

  const where: Prisma.MerchantWhereInput = searchTerm
    ? {
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            phone: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            address: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            restaurantType: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            mainDishType: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        ],
      }
    : {};

  const [merchants, totalItems] = await prisma.$transaction([
    prisma.merchant.findMany({
      where,

      select: {
        id: true,
        name: true,
        description: true,

        address: true,
        logoUrl: true,
        email: true,
        openingHours: true,

        restaurantType: true,
        mainDishType: true,

        rating: true,
        reviewCount: true,
        status: true,
      },

      orderBy: [
        {
          status: "asc",
        },
        {
          rating: "desc",
        },
        {
          createdAt: "desc",
        },
      ],

      skip,
      take: pageSize,
    }),

    prisma.merchant.count({
      where,
    }),
  ]);

  return {
    items: merchants.map(mapStaffMerchant),
    totalItems,
    pageIndex,
    pageSize,
    totalPages: Math.ceil(totalItems / pageSize),
  };
};
