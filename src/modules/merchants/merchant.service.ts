import {
  CheckInStatus,
  MerchantStatus,
  MerchantTrafficSource,
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
import { recommendationCache } from "../../common/services/recommendation-cache.js";
import {
  calculatePreferenceScore,
  type CustomerPreferenceInput,
} from "../../common/utils/preference-score.js";
import { calculateOrganicRecommendationScore } from "../../common/utils/merchant-score.js";

const productionDiscoveryFilter: Prisma.MerchantWhereInput =
  env.NODE_ENV === "production"
    ? {
        user: {
          email: {
            mode: "insensitive",
            not: {
              endsWith: "@uat.ugem.local",
            },
          },
        },
      }
    : {};

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
  bankCode: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankTransferEnabled: boolean;
  rating: Prisma.Decimal;
  reviewCount: number;
  totalViews: number;
  gemStatus?: "HiddenGem" | "RisingGem" | "HallOfFame" | null;
  status: MerchantStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    checkIns: number;
  };
  campaigns?: Array<{
    isActive: boolean;
    startAt: Date;
    endAt: Date;
    verifiedVisitLimit: number | null;
    acquisitionEvents?: Array<{ id: string }>;
  }>;
  foods?: Array<{
    name: string;
    categories: Array<{
      categoryId: string;
      category: {
        parentId: string | null;
      };
    }>;
  }>;
};

const mapMerchant = (
  merchant: MapMerchantInput,
  customerLat?: number,
  customerLng?: number,
  customerPreferences?: CustomerPreferenceInput,
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

  const rawUnderratedScore = (merchant as any).underratedScore;
  const underratedScore =
    rawUnderratedScore !== null && rawUnderratedScore !== undefined
      ? Number(rawUnderratedScore)
      : 0;

  const strengthIndex = (merchant as any).strengthIndex
    ? Number((merchant as any).strengthIndex)
    : 0;
  const recommendationRank = (merchant as any).recommendationRank ?? null;

  const categoryIds = [
    ...new Set(
      (merchant.foods ?? []).flatMap((food) =>
        food.categories.flatMap((category) =>
          category.category.parentId
            ? [category.categoryId, category.category.parentId]
            : [category.categoryId],
        ),
      ),
    ),
  ];
  const { hasPreferences: hasUserPreferences, score: preferenceScore } =
    calculatePreferenceScore(customerPreferences ?? null, {
      restaurantType: merchant.restaurantType,
      mainDishType: merchant.mainDishType,
      priceRange: merchant.priceRange,
      categoryIds,
    });

  const checkInCount = (merchant as any)._count?.checkIns ?? 0;
  const checkInScore = Math.min(100, checkInCount * 12);

  const isFavorite =
    checkInCount >= 8 ||
    (checkInCount >= 4 && rating >= 4.2);

  const isFlop = checkInCount < 4;

  const hasActiveCampaign = (merchant.campaigns ?? []).some(
    (campaign) =>
      campaign.isActive &&
      new Date(campaign.startAt) <= new Date() &&
      new Date(campaign.endAt) >= new Date() &&
      (campaign.verifiedVisitLimit == null ||
        (campaign.acquisitionEvents?.length ?? 0) < campaign.verifiedVisitLimit),
  );

  const distanceScore =
    distance !== null ? Math.max(0, 100 - distance * 5) : 100;
  const ratingScore = (rating / 5) * 100;

  const underratedScore100 = Math.min(
    100,
    Math.max(0, underratedScore * 100),
  );

  /*
   * ORGANIC SCORE ONLY.
   *
   * Campaign/sponsorship is discovery metadata and must never affect
   * recommendationScore.
   */
  const recommendationScore = calculateOrganicRecommendationScore({
    checkInScore,
    ratingScore,
    distanceScore,
    preferenceOrUnderratedScore: hasUserPreferences
      ? preferenceScore
      : underratedScore100,
  });

  const featuredFoods = merchant.foods
    ? merchant.foods.slice(0, 3).map((f) => f.name)
    : [];

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
    bankCode: merchant.bankCode,
    bankAccountNumber: merchant.bankAccountNumber,
    bankAccountName: merchant.bankAccountName,
    bankTransferEnabled: merchant.bankTransferEnabled,
    rating,
    strengthIndex,
    underratedScore,
    preferenceScore,
    recommendationRank,
    gemStatus: merchant.gemStatus ?? null,
    distance,
    checkInCount,
    isFavorite,
    isFlop,
    hasActiveCampaign,
    discoveryType: "Organic" as const,
    isSponsored: false,
    checkInPerks: [
      "Giảm 5% cho hóa đơn tiếp theo",
      "Tặng 1 ly nước ngọt khi check-in",
    ],
    featuredFoods,
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
  underratedScore: Prisma.Decimal | number | null;
  status: MerchantStatus;
}) => {
  const rating = Number(merchant.rating);
  const underratedScore = merchant.underratedScore
    ? Number(merchant.underratedScore)
    : 0;

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
    underratedScore,
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
    status: merchant.status,
  };
};

const getOrganicMerchants = async (query: MerchantListQuery) => {
  const pageIndex = query.pageIndex || 1;
  const pageSize = query.pageSize || 10;

  const cacheKey = `recommendation:organic:${JSON.stringify(query)}`;
  const cachedResult = recommendationCache.get<any>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const customerPreferences = query.customerId
    ? await prisma.customer.findUnique({
        where: {
          id: query.customerId,
        },
        select: {
          preferredRestaurantTypes: true,
          preferredMainDishTypes: true,
          preferredCategoryIds: true,
          preferredPriceRanges: true,
        },
      })
    : null;

  const where: Prisma.MerchantWhereInput = {
    ...productionDiscoveryFilter,
    id: query.merchantIds ? { in: query.merchantIds } : undefined,
    status: MerchantStatus.Active,
    listingVisibility: "Public",
    safetySuppressed: false,

    NOT: [
      { openingHours: { contains: "nghỉ", mode: "insensitive" } },
      { openingHours: { contains: "tạm đóng", mode: "insensitive" } },
      { openingHours: { contains: "đóng cửa", mode: "insensitive" } },
    ],

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

    country: query.country
      ? { equals: query.country, mode: "insensitive" }
      : undefined,
    city: query.city
      ? { contains: query.city, mode: "insensitive" }
      : undefined,
    area: query.area
      ? { contains: query.area, mode: "insensitive" }
      : undefined,

    // Spatial Bounding Box Pre-filtering at Database Layer
    latitude:
      query.latitude !== undefined
        ? {
            gte: new Prisma.Decimal(
              query.latitude - (query.radiusKm ?? 15) / 111.0,
            ),
            lte: new Prisma.Decimal(
              query.latitude + (query.radiusKm ?? 15) / 111.0,
            ),
          }
        : undefined,

    longitude:
      query.latitude !== undefined && query.longitude !== undefined
        ? {
            gte: new Prisma.Decimal(
              query.longitude -
                (query.radiusKm ?? 15) /
                  (111.0 *
                    Math.max(
                      0.1,
                      Math.cos((query.latitude * Math.PI) / 180.0),
                    )),
            ),
            lte: new Prisma.Decimal(
              query.longitude +
                (query.radiusKm ?? 15) /
                  (111.0 *
                    Math.max(
                      0.1,
                      Math.cos((query.latitude * Math.PI) / 180.0),
                    )),
            ),
          }
        : undefined,

    foods: query.categoryId
      ? {
          some: {
            isAvailable: true,

            categories: {
              some: {
                category: {
                  isActive: true,
                  OR: [
                    { id: query.categoryId },
                    { parentId: query.categoryId },
                  ],
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
      _count: {
        select: {
          checkIns: {
            where: {
              status: CheckInStatus.Verified,
              campaignId: null,
            },
          },
        },
      },
      campaigns: {
        where: {
          isActive: true,
        },
        select: {
          isActive: true,
          startAt: true,
          endAt: true,
          verifiedVisitLimit: true,
          acquisitionEvents: {
            where: { status: "Valid" },
            select: { id: true },
          },
        },
      },
      foods: {
        where: {
          isAvailable: true,
        },
        select: {
          name: true,
          categories: {
            select: {
              categoryId: true,
              category: {
                select: {
                  parentId: true,
                },
              },
            },
          },
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

  const result = {
    items: pagedItems,
    totalItems,
    pageIndex,
    pageSize,
    totalPages: Math.ceil(totalItems / pageSize),
    discoveryType: "Organic" as const,
  };

  recommendationCache.set(cacheKey, result);
  return result;
};

const getSponsoredMerchantsInternal = async (
  query: MerchantListQuery,
) => {
  const pageIndex = query.pageIndex || 1;
  const pageSize = query.pageSize || 10;
  const cacheKey = `recommendation:sponsored:${JSON.stringify(query)}`;

  const cachedResult = recommendationCache.get<any>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      isActive: true,
      startAt: { lte: now },
      endAt: { gte: now },
      merchant: {
        ...productionDiscoveryFilter,
        status: MerchantStatus.Active,
        listingVisibility: "Public",
        safetySuppressed: false,

        NOT: [
          { openingHours: { contains: "nghỉ", mode: "insensitive" } },
          { openingHours: { contains: "tạm đóng", mode: "insensitive" } },
          { openingHours: { contains: "đóng cửa", mode: "insensitive" } },
        ],

        restaurantType: query.restaurantType
          ? { contains: query.restaurantType, mode: "insensitive" }
          : undefined,
        mainDishType: query.mainDishType
          ? { contains: query.mainDishType, mode: "insensitive" }
          : undefined,
        priceRange: query.priceRange
          ? { contains: query.priceRange, mode: "insensitive" }
          : undefined,
        country: query.country
          ? { equals: query.country, mode: "insensitive" }
          : undefined,
        city: query.city
          ? { contains: query.city, mode: "insensitive" }
          : undefined,
        area: query.area
          ? { contains: query.area, mode: "insensitive" }
          : undefined,

        foods: query.categoryId
          ? {
              some: {
                isAvailable: true,
                categories: {
                  some: {
                    category: {
                      isActive: true,
                      OR: [
                        { id: query.categoryId },
                        { parentId: query.categoryId },
                      ],
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
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      merchantId: true,
      name: true,
      description: true,
      code: true,
      discountType: true,
      discountValue: true,
      startAt: true,
      endAt: true,
      createdAt: true,
      verifiedVisitLimit: true,
      maxVerifiedVisitsPerCustomer: true,
      isActive: true,
      acquisitionEvents: {
        where: { status: "Valid" },
        select: { id: true },
      },
      merchant: {
        include: {
          _count: {
            select: {
              checkIns: {
                where: {
                  status: CheckInStatus.Verified,
                  campaignId: null,
                },
              },
            },
          },
          campaigns: {
            where: {
              isActive: true,
            },
            select: {
              isActive: true,
              startAt: true,
              endAt: true,
              verifiedVisitLimit: true,
              acquisitionEvents: {
                where: { status: "Valid" },
                select: { id: true },
              },
            },
          },
          foods: {
            where: {
              isAvailable: true,
            },
            select: {
              name: true,
              categories: {
                select: {
                  categoryId: true,
                  category: {
                    select: {
                      parentId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const eligibleCampaigns = campaigns.filter(
    (campaign) =>
      campaign.isActive &&
      campaign.startAt <= now &&
      campaign.endAt >= now &&
      (campaign.verifiedVisitLimit == null ||
        (campaign.acquisitionEvents?.length ?? 0) < campaign.verifiedVisitLimit) &&
      campaign.merchant.status === MerchantStatus.Active &&
      campaign.merchant.listingVisibility === "Public" &&
      !campaign.merchant.safetySuppressed,
  );

  const campaignByMerchant = new Map<
    string,
    (typeof eligibleCampaigns)[number]
  >();

  for (const campaign of eligibleCampaigns) {
    if (!campaignByMerchant.has(campaign.merchantId)) {
      campaignByMerchant.set(campaign.merchantId, campaign);
    }
  }

  const selectedCampaigns = [...campaignByMerchant.values()];
  const customerPreferences = query.customerId
    ? await prisma.customer.findUnique({
        where: { id: query.customerId },
        select: {
          preferredRestaurantTypes: true,
          preferredMainDishTypes: true,
          preferredCategoryIds: true,
          preferredPriceRanges: true,
        },
      })
    : null;

  let items = selectedCampaigns.map((campaign) => {
    const organicMerchant = mapMerchant(
      campaign.merchant,
      query.latitude,
      query.longitude,
      customerPreferences,
    );

    return {
      ...organicMerchant,
      discoveryType: "Sponsored" as const,
      isSponsored: true,
      sponsoredCampaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        code: campaign.code,
        discountType: campaign.discountType,
        discountValue: Number(campaign.discountValue),
        startAt: campaign.startAt,
        endAt: campaign.endAt,
      },
    };
  });

  if (
    query.latitude !== undefined &&
    query.longitude !== undefined
  ) {
    const radiusKm = query.radiusKm ?? 15;
    items = items.filter(
      (item) => item.distance === null || item.distance <= radiusKm,
    );
  }

  const totalItems = items.length;
  const skip = (pageIndex - 1) * pageSize;
  const result = {
    items: items.slice(skip, skip + pageSize),
    totalItems,
    pageIndex,
    pageSize,
    totalPages: Math.ceil(totalItems / pageSize),
    discoveryType: "Sponsored" as const,
  };

  recommendationCache.set(cacheKey, result);
  return result;
};

export const getSponsoredMerchants = getSponsoredMerchantsInternal;

export const getMerchants = async (query: MerchantListQuery) => {
  if (query.discoveryType === "Sponsored") {
    return getSponsoredMerchantsInternal(query);
  }

  return getOrganicMerchants(query);
};

export const getMerchantById = async (merchantId: string) => {
  const merchant = await prisma.merchant.findFirst({
    where: {
      ...productionDiscoveryFilter,
      id: merchantId,
      status: MerchantStatus.Active,
      listingVisibility: "Public",
      safetySuppressed: false,
    },
    include: {
      _count: {
        select: {
          checkIns: {
            where: {
              status: CheckInStatus.Verified,
              campaignId: null,
            },
          },
        },
      },
      foods: {
        where: {
          isAvailable: true,
        },
        select: {
          name: true,
          categories: {
            select: {
              categoryId: true,
              category: {
                select: {
                  parentId: true,
                },
              },
            },
          },
        },
      },
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

  const nextBankCode =
    input.bankCode !== undefined
      ? input.bankCode?.trim() || null
      : existing.bankCode;
  const nextBankAccountNumber =
    input.bankAccountNumber !== undefined
      ? input.bankAccountNumber?.trim() || null
      : existing.bankAccountNumber;
  const nextBankAccountName =
    input.bankAccountName !== undefined
      ? input.bankAccountName?.trim() || null
      : existing.bankAccountName;

  if (
    input.bankTransferEnabled === true &&
    (!nextBankCode || !nextBankAccountNumber || !nextBankAccountName)
  ) {
    throw new AppError(
      400,
      "Phải nhập đầy đủ ngân hàng, số tài khoản và tên chủ tài khoản trước khi bật chuyển khoản",
    );
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

      country: input.country !== undefined ? input.country.trim() : undefined,
      city: input.city !== undefined ? input.city?.trim() || null : undefined,
      area: input.area !== undefined ? input.area?.trim() || null : undefined,

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

      bankCode:
        input.bankCode !== undefined
          ? input.bankCode?.trim() || null
          : undefined,
      bankAccountNumber:
        input.bankAccountNumber !== undefined
          ? input.bankAccountNumber?.trim() || null
          : undefined,
      bankAccountName:
        input.bankAccountName !== undefined
          ? input.bankAccountName?.trim() || null
          : undefined,
      bankTransferEnabled: input.bankTransferEnabled,
    },
  });

  return mapMerchant(merchant);
};

export const getMerchantsForMap = async (query: MerchantMapQuery) => {
  const merchants = await prisma.merchant.findMany({
    where: {
      ...productionDiscoveryFilter,
      status: MerchantStatus.Active,
      listingVisibility: "Public",
      safetySuppressed: false,

      NOT: [
        { openingHours: { contains: "nghỉ", mode: "insensitive" } },
        { openingHours: { contains: "tạm đóng", mode: "insensitive" } },
        { openingHours: { contains: "đóng cửa", mode: "insensitive" } },
      ],

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
      underratedScore: true,
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
    underratedScore: merchant.underratedScore
      ? Number(merchant.underratedScore)
      : 0,

    reviewCount: merchant.reviewCount,

    priceRange: merchant.priceRange,

    restaurantType: merchant.restaurantType,

    mainDishType: merchant.mainDishType,

    totalViews: merchant.totalViews,
  }));
};

export const incrementMerchantView = async (params: {
  merchantId: string;
  customerId?: string;
  source?: MerchantTrafficSource;
}) => {
  const merchant = await prisma.merchant.findFirst({
    where: {
      id: params.merchantId,
      status: MerchantStatus.Active,
      listingVisibility: "Public",
      safetySuppressed: false,
    },

    select: {
      id: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  await prisma.merchantView.create({
    data: {
      merchantId: params.merchantId,
      customerId: params.customerId || null,
      source: params.source ?? MerchantTrafficSource.Recommendation,
    },
  });

  const updatedMerchant = await prisma.merchant.update({
    where: {
      id: params.merchantId,
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
    recommendationViews: await prisma.merchantView.count({
      where: { merchantId, source: MerchantTrafficSource.Recommendation },
    }),
  };
};

/**
 * @deprecated Legacy Order/Revenue dashboard aggregate.
 * UFind Core dashboards should use Merchant Analytics instead.
 */
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
      underratedScore: true,
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

  const underratedScore = merchant.underratedScore
    ? Number(merchant.underratedScore)
    : 0;

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
        underratedScore: true,
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
