import {
  CheckInStatus,
  NotificationType,
  OrderStatus,
  Prisma,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
  CreateReviewInput,
  ReviewListQuery,
  UpdateReviewInput,
} from "./review.types.js";
import { createNotification } from "../notifications/notification.service.js";
import { awardGemPoints } from "../gem-points/gem-point.service.js";

const reviewInclude = {
  customer: {
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  },

  merchant: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
    },
  },

  order: {
    select: {
      id: true,
      orderedAt: true,
      completedAt: true,
      checkIn: {
        select: {
          status: true,
          verifiedAt: true,
        },
      },
    },
  },

  checkIn: { select: { id: true, status: true, verifiedAt: true } },

  details: {
    include: {
      orderDetail: true,
    },
  },
};
const mapReview = (review: any) => {
  const customerName = review.customer?.user?.fullName ?? null;

  const customerAvatarUrl = review.customer?.user?.avatarUrl ?? null;

  const isVerifiedDiner =
    review.checkIn?.status === CheckInStatus.Verified ||
    review.order?.checkIn?.status === CheckInStatus.Verified ||
    !!review.order?.checkIn?.verifiedAt;

  const reviewDetails = review.details.map((detail: any) => ({
    reviewDetailId: detail.id,
    orderDetailId: detail.orderDetailId,

    rating: detail.rating,

    content: detail.content,

    food: {
      id: detail.orderDetail.foodId,
      name: detail.orderDetail.foodNameSnapshot,
    },

    createdAt: detail.createdAt,
  }));

  return {
    reviewId: review.id,

    customerId: review.customerId,
    userId: review.customer?.user?.id ?? null,

    merchantId: review.merchantId,

    orderId: review.orderId,

    checkInId: review.checkInId,

    rating: review.rating,

    content: review.content,

    imageUrl: review.imageUrl,

    customerName,

    customerAvatarUrl,
    isVerifiedDiner,

    customer: review.customer
      ? {
          id: review.customer.id,
          userId: review.customer.user.id,
          fullName: review.customer.user.fullName,
          avatarUrl: review.customer.user.avatarUrl,
        }
      : null,

    merchant: review.merchant,
    order: review.order,

    details: reviewDetails,

    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
};

const updateMerchantRating = async (
  transaction: Prisma.TransactionClient,
  merchantId: string,
) => {
  const aggregate = await transaction.review.aggregate({
    where: {
      merchantId,
    },

    _avg: {
      rating: true,
    },

    _count: {
      rating: true,
    },
  });

  await transaction.merchant.update({
    where: {
      id: merchantId,
    },

    data: {
      rating: new Prisma.Decimal(aggregate._avg.rating ?? 0),

      reviewCount: aggregate._count.rating,
    },
  });
};

const createCheckInReview = async (
  customerId: string,
  input: CreateReviewInput,
) => {
  if (!input.checkInId) {
    throw new AppError(400, "Thiếu Check-in ID");
  }

  const checkIn = await prisma.checkIn.findUnique({
    where: {
      id: input.checkInId,
    },
    include: {
      merchant: {
        select: {
          id: true,
          userId: true,
          name: true,
        },
      },
      customer: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!checkIn) {
    throw new AppError(404, "Không tìm thấy Check-in");
  }

  if (checkIn.customerId !== customerId) {
    throw new AppError(403, "Check-in không thuộc Customer này");
  }

  if (
    checkIn.status !== CheckInStatus.Verified ||
    !checkIn.verifiedAt
  ) {
    throw new AppError(
      403,
      "Chỉ có thể đánh giá từ lượt ghé đã được xác minh",
    );
  }

  if (
    input.merchantId &&
    input.merchantId !== checkIn.merchantId
  ) {
    throw new AppError(
      400,
      "Merchant ID không khớp với Check-in",
    );
  }

  const existingReview = await prisma.review.findUnique({
    where: {
      checkInId: checkIn.id,
    },
    select: {
      id: true,
    },
  });

  if (existingReview) {
    throw new AppError(
      409,
      "Lượt ghé này đã được đánh giá",
    );
  }

  let reviewResult;

  try {
    reviewResult = await prisma.$transaction(
      async (transaction) => {
        const createdReview = await transaction.review.create({
          data: {
            customerId,
            merchantId: checkIn.merchantId,
            checkInId: checkIn.id,
            orderId: null,
            rating: input.rating,
            content: input.content?.trim() || null,
            imageUrl: input.imageUrl?.trim() || null,
          },
          include: reviewInclude,
        });

        await updateMerchantRating(
          transaction,
          checkIn.merchantId,
        );

        const gemReward = await awardGemPoints(transaction, {
          customerId,
          action: input.imageUrl?.trim()
            ? "VERIFIED_REVIEW_WITH_IMAGE"
            : "VERIFIED_REVIEW",
          referenceId: createdReview.id,
          reason: `Đóng góp đánh giá Verified Visit tại ${checkIn.merchant.name}`,
        });

        return { review: createdReview, reward: gemReward };
      },
    );
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new AppError(
        409,
        "Lượt ghé này đã được đánh giá",
      );
    }

    throw error;
  }

  const { review, reward } = reviewResult;

  await createNotification({
    userId: checkIn.merchant.userId,
    type: NotificationType.Review,
    title: "Quán vừa nhận được đánh giá mới",
    message:
      `Khách hàng đã đánh giá ${checkIn.merchant.name} ${review.rating}/5 sao.`,
    referenceId: review.id,
    referenceType: "Review",
  }).catch(() => null);

  if (reward.awarded) {
    await createNotification({
      userId: checkIn.customer.userId,
      type: NotificationType.System,
      title: "Cảm ơn đóng góp của bạn",
      message: `Cảm ơn đóng góp của bạn (+${reward.amount} Gem Points).`,
      referenceId: review.id,
      referenceType: "Review",
    }).catch(() => null);
  }

  return mapReview(review);
};

export const createReview = async (
  customerId: string,
  input: CreateReviewInput,
) => {
  // Verified CheckIn is the primary UFind review flow. Order review remains
  // available only for compatibility with the legacy commerce module.
  if (input.checkInId) {
    return createCheckInReview(customerId, input);
  }

  return createLegacyOrderReview(customerId, input);
};

/**
 * @deprecated Legacy Order-based review flow. Keep for old clients only.
 */
const createLegacyOrderReview = async (
  customerId: string,
  input: CreateReviewInput,
) => {
  if (!input.orderId) {
    throw new AppError(400, "Thiếu Order ID");
  }

  const order = await prisma.order.findUnique({
    where: {
      id: input.orderId,
    },

    include: {
      details: true,
      checkIn: {
        select: {
          checkedInAt: true,
          status: true,
        },
      },
      merchant: {
        select: {
          userId: true,
          name: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, "Không tìm thấy Order");
  }

  if (order.customerId !== customerId) {
    throw new AppError(403, "Order không thuộc Customer này");
  }

  if (input.merchantId && input.merchantId !== order.merchantId) {
    throw new AppError(400, "Merchant ID không khớp với Order");
  }

  if (order.status !== OrderStatus.Completed) {
    throw new AppError(403, "Chỉ có thể đánh giá khi đơn hàng đã hoàn tất");
  }

  const existingReview = await prisma.review.findUnique({
    where: {
      orderId: order.id,
    },
  });

  if (existingReview) {
    throw new AppError(409, "Order này đã được đánh giá");
  }

  const requestedDetails = input.details ?? [];

  const orderDetailIds = new Set(order.details.map((detail) => detail.id));

  for (const detail of requestedDetails) {
    if (!orderDetailIds.has(detail.orderDetailId)) {
      throw new AppError(400, "Có Order Detail không thuộc Order này");
    }
  }

  const review = await prisma.$transaction(async (transaction) => {
    const createdReview = await transaction.review.create({
      data: {
        customerId,

        /*
         * Không lấy merchantId trực tiếp từ body.
         */
        merchantId: order.merchantId,

        orderId: order.id,

        rating: input.rating,

        content: input.content?.trim() || null,

        imageUrl: input.imageUrl?.trim() || null,

        details: {
          create: requestedDetails.map((detail) => ({
            orderDetailId: detail.orderDetailId,

            rating: detail.rating ?? input.rating,

            content: detail.content?.trim() || null,
          })),
        },
      },

      include: reviewInclude,
    });

    await updateMerchantRating(transaction, order.merchantId);

    await awardGemPoints(transaction, {
      customerId,
      action: input.imageUrl?.trim()
        ? "VERIFIED_REVIEW_WITH_IMAGE"
        : "VERIFIED_REVIEW",
      referenceId: createdReview.id,
      reason: `Điểm Gem thưởng đánh giá tại ${order.merchant.name}`,
    });

    return createdReview;
  });

  await createNotification({
    userId: order.merchant.userId,
    type: NotificationType.Review,
    title: "Quán vừa nhận được đánh giá mới",
    message: `Khách hàng đã đánh giá ${order.merchant.name} ${review.rating}/5 sao.`,
    referenceId: review.id,
    referenceType: "Review",
  });

  const customerUser = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { userId: true },
  });
  if (customerUser) {
    await createNotification({
      userId: customerUser.userId,
      type: NotificationType.System,
      title: "Hoàn thành nhiệm vụ đánh giá!",
      message: `Bạn đã hoàn thành nhiệm vụ đánh giá tại ${order.merchant.name} (+${input.imageUrl?.trim() ? 20 : 15} điểm thưởng). Cảm ơn đóng góp của bạn!`,
      referenceId: review.id,
      referenceType: "Review",
    }).catch(() => null);
  }

  return mapReview(review);
};

export const getMerchantReviews = async (
  merchantId: string,
  query: ReviewListQuery,
) => {
  const pageIndex = query.pageIndex || 1;

  const pageSize = query.pageSize || 10;

  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const where: Prisma.ReviewWhereInput = {
    merchantId,
  };

  const [reviews, totalItems] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      include: reviewInclude,
      orderBy: {
        createdAt: "desc",
      },
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
    }),

    prisma.review.count({
      where,
    }),
  ]);

  return {
    items: reviews.map(mapReview),

    totalItems,
    pageIndex,
    pageSize,

    totalPages: Math.ceil(totalItems / pageSize),

    averageRating: Number(merchant.rating),

    reviewCount: merchant.reviewCount,
  };
};

export const getMyReviews = async (customerId: string) => {
  const reviews = await prisma.review.findMany({
    where: {
      customerId,
    },
    include: reviewInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  return reviews.map(mapReview);
};

export const updateReview = async (
  customerId: string,
  reviewId: string,
  input: UpdateReviewInput,
) => {
  const review = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },
    include: {
      merchant: {
        select: {
          userId: true,
          name: true,
        },
      },
    },
  });

  if (!review) {
    throw new AppError(404, "Không tìm thấy Review");
  }

  if (review.customerId !== customerId) {
    throw new AppError(403, "Bạn không có quyền sửa Review này");
  }

  const requestedDetails = input.details ?? [];

  if (requestedDetails.length > 0) {
    const detailIds = [
      ...new Set(requestedDetails.map((detail) => detail.reviewDetailId)),
    ];

    if (detailIds.length !== requestedDetails.length) {
      throw new AppError(400, "Review Detail bị trùng lặp");
    }

    const ownedDetailCount = await prisma.reviewDetail.count({
      where: {
        id: {
          in: detailIds,
        },

        reviewId,
      },
    });

    if (ownedDetailCount !== detailIds.length) {
      throw new AppError(400, "Có Review Detail không thuộc Review này");
    }
  }

  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.review.update({
      where: {
        id: reviewId,
      },

      data: {
        rating: input.rating,

        content:
          input.content !== undefined
            ? input.content?.trim() || null
            : undefined,

        imageUrl:
          input.imageUrl !== undefined
            ? input.imageUrl?.trim() || null
            : undefined,
      },
    });

    for (const detail of requestedDetails) {
      await transaction.reviewDetail.update({
        where: {
          id: detail.reviewDetailId,
        },

        data: {
          rating: detail.rating,

          content:
            detail.content !== undefined
              ? detail.content?.trim() || null
              : undefined,
        },
      });
    }

    await updateMerchantRating(transaction, review.merchantId);

    return transaction.review.findUniqueOrThrow({
      where: {
        id: reviewId,
      },

      include: reviewInclude,
    });
  });

  await createNotification({
    userId: review.merchant.userId,
    type: NotificationType.Review,
    title: "Khách hàng đã cập nhật đánh giá",
    message: `Một đánh giá về ${review.merchant.name} vừa được cập nhật thành ${updated.rating}/5 sao.`,
    referenceId: updated.id,
    referenceType: "Review",
  });

  return mapReview(updated);
};

export const deleteReview = async (customerId: string, reviewId: string) => {
  const review = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },
  });

  if (!review) {
    throw new AppError(404, "Không tìm thấy Review");
  }

  if (review.customerId !== customerId) {
    throw new AppError(403, "Bạn không có quyền xóa Review này");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.review.delete({
      where: {
        id: reviewId,
      },
    });

    await updateMerchantRating(transaction, review.merchantId);
  });

  return {
    reviewId,
  };
};

export const getReviewDetails = async (reviewId: string) => {
  const review = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },

    select: {
      id: true,

      details: {
        include: {
          orderDetail: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!review) {
    throw new AppError(404, "Không tìm thấy Review");
  }

  return review.details.map((detail) => ({
    reviewDetailId: detail.id,
    reviewId,

    orderDetailId: detail.orderDetailId,

    rating: detail.rating,

    content: detail.content,

    food: {
      id: detail.orderDetail.foodId,
      name: detail.orderDetail.foodNameSnapshot,
    },

    createdAt: detail.createdAt,
  }));
};
