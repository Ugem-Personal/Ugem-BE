import {
  AffiliateTransactionStatus,
  NotificationType,
  OrderPaymentStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Prisma,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { recommendationCache } from "../../common/services/recommendation-cache.js";

import type {
  CreateOrderInput,
  CustomerUpdateOrderStatusInput,
  OrderListQuery,
  UpdateOrderStatusInput,
} from "./order.types.js";
import { createReviewerCommission } from "../affiliate-links/affiliate-earning.service.js";
import { createNotification } from "../notifications/notification.service.js";
import { realtimeService } from "../realtime/realtime.service.js";
import {
  canCustomerConfirmOrder,
  canMerchantTransitionOrder,
} from "./order-state-machine.js";

const orderInclude = {
  merchant: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      address: true,
      phone: true,
    },
  },

  customer: {
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          avatarUrl: true,
        },
      },
    },
  },

  details: {
    include: {
      toppings: true,
      food: {
        select: {
          imageUrl: true,
        },
      },
    },
  },
  bill: true,
};

const mapOrder = (order: any) => {
  const mappedFoods = order.details.map((detail: any) => {
    const toppings = detail.toppings.map((topping: any) => ({
      foodToppingId: topping.toppingId,
      name: topping.toppingNameSnapshot,
      price: Number(topping.priceSnapshot),
    }));

    return {
      orderDetailId: detail.id,
      orderId: order.id,

      foodId: detail.foodId,
      merchantId: order.merchantId,
      merchantName: order.merchant?.name ?? null,

      name: detail.foodNameSnapshot,
      imageUrl: detail.food?.imageUrl ?? null,

      quantity: detail.quantity,

      unitPrice: Number(detail.unitPrice),

      notes: detail.notes,

      lineTotal: Number(detail.lineTotal),

      toppings,
    };
  });

  return {
    orderId: order.id,

    customerId: order.customerId,
    merchantId: order.merchantId,
    campaignId: order.campaignId,

    affiliateLinkId: order.affiliateLinkId,

    reviewerCommission: Number(order.reviewerCommission),

    name: order.name,
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,

    status: order.status,
    paymentStatus: order.paymentStatus,

    bill: order.bill
      ? {
          id: order.bill.id,
          orderId: order.bill.orderId,
          method: order.bill.method,
          status: order.bill.status,

          amount: Number(order.bill.amount),

          evidenceUrl: order.bill.evidenceUrl,

          transferContent: order.bill.transferContent,

          sepayReference: order.bill.sepayReference,

          requestedAt: order.bill.requestedAt,

          merchantConfirmedAt: order.bill.merchantConfirmedAt,

          customerConfirmedAt: order.bill.customerConfirmedAt,

          rejectedAt: order.bill.rejectedAt,

          rejectionReason: order.bill.rejectionReason,

          createdAt: order.bill.createdAt,

          updatedAt: order.bill.updatedAt,
        }
      : null,

    notes: order.notes,

    deliveryAddress: order.deliveryAddress,
    deliveryLatitude:
      order.deliveryLatitude !== null ? Number(order.deliveryLatitude) : null,
    deliveryLongitude:
      order.deliveryLongitude !== null ? Number(order.deliveryLongitude) : null,

    subtotal: Number(order.subtotal),
    discount: Number(order.discount),

    finalPrice: Number(order.finalPrice),

    rejectionReason: order.rejectionReason,

    merchant: order.merchant,

    customer: order.customer
      ? {
          id: order.customer.id,

          userId: order.customer.user.id,

          fullName: order.customer.user.fullName,

          email: order.customer.user.email,

          phoneNumber: order.customer.user.phoneNumber,

          avatarUrl: order.customer.user.avatarUrl,
        }
      : null,

    foods: mappedFoods,

    orderedAt: order.orderedAt,
    acceptedAt: order.acceptedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    deliveringAt: order.deliveringAt,
    rejectedAt: order.rejectedAt,
    completedAt: order.completedAt,

    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};

export const createOrder = async (
  customerId: string,
  input: CreateOrderInput,
  idempotencyKey?: string,
) => {
  const cacheKey = idempotencyKey?.trim()
    ? `idempotency:order:${customerId}:${idempotencyKey.trim()}`
    : null;

  if (cacheKey) {
    const cached = recommendationCache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const foodIds = [...new Set(input.foods.map((item) => item.foodId))];

  const foods = await prisma.food.findMany({
    where: {
      id: {
        in: foodIds,
      },
    },
    include: {
      toppings: true,
      merchant: true,
    },
  });

  if (foods.length !== foodIds.length) {
    throw new AppError(400, "Một hoặc nhiều món ăn không tồn tại");
  }

  const unavailableFood = foods.find((food) => !food.isAvailable);

  if (unavailableFood) {
    throw new AppError(409, `Món ${unavailableFood.name} hiện không còn bán`);
  }

  const merchantIds = [...new Set(foods.map((food) => food.merchantId))];

  if (merchantIds.length !== 1) {
    throw new AppError(400, "Một order chỉ được chứa món của một Merchant");
  }

  const merchantId = merchantIds[0];

  let affiliateLink: {
    id: string;
    reviewerId: string;
    merchantId: string;
    isActive: boolean;
  } | null = null;

  if (input.affiliateLinkCode?.trim()) {
    affiliateLink = await prisma.affiliateLink.findUnique({
      where: {
        linkCode: input.affiliateLinkCode.trim().toUpperCase(),
      },

      select: {
        id: true,
        reviewerId: true,
        merchantId: true,
        isActive: true,
      },
    });

    if (!affiliateLink || !affiliateLink.isActive) {
      throw new AppError(400, "Affiliate Link không hợp lệ");
    }

    if (affiliateLink.merchantId !== merchantId) {
      throw new AppError(400, "Affiliate Link không thuộc Merchant của Order");
    }

    if (affiliateLink.reviewerId === customerId) {
      throw new AppError(400, "Reviewer không được dùng link của chính mình");
    }
  }

  if (!merchantId) {
    throw new AppError(400, "Khong xac dinh duoc Merchant cho order");
  }

  const calculatedItems = input.foods.map((inputItem) => {
    const food = foods.find((item) => item.id === inputItem.foodId);

    if (!food) {
      throw new AppError(400, "Không tìm thấy món ăn");
    }

    const uniqueToppingIds = [...new Set(inputItem.foodToppingIds ?? [])];

    const selectedToppings = uniqueToppingIds.map((toppingId) => {
      const topping = food.toppings.find((item) => item.id === toppingId);

      if (!topping) {
        throw new AppError(400, `Topping không thuộc món ${food.name}`);
      }

      if (!topping.isActive) {
        throw new AppError(409, `Topping ${topping.name} đã ngừng bán`);
      }

      return topping;
    });

    const toppingPrice = selectedToppings.reduce(
      (total, topping) => total + Number(topping.price),
      0,
    );

    const unitPrice = Number(food.price) + toppingPrice;

    const lineTotal = unitPrice * inputItem.quantity;

    return {
      food,
      quantity: inputItem.quantity,
      notes: inputItem.notes?.trim() || null,
      selectedToppings,
      unitPrice,
      lineTotal,
    };
  });

  const subtotal = calculatedItems.reduce(
    (total, item) => total + item.lineTotal,
    0,
  );

  let campaign: {
    id: string;
    merchantId: string;
    discountType: "Percentage" | "FixedAmount";
    discountValue: Prisma.Decimal;
    minimumOrderAmount: Prisma.Decimal;
    maximumDiscount: Prisma.Decimal | null;
    startAt: Date;
    endAt: Date;
    usageLimit: number | null;
    usedCount: number;
    maxUsagePerUser: number;
    isNewUserOnly: boolean;
    isActive: boolean;
  } | null = null;

  let discount = 0;

  if (input.campaignId) {
    campaign = await prisma.campaign.findUnique({
      where: {
        id: input.campaignId,
      },
    });

    if (!campaign) {
      throw new AppError(404, "Không tìm thấy Campaign");
    }

    if (campaign.merchantId !== merchantId) {
      throw new AppError(400, "Campaign không thuộc Merchant của Order");
    }

    const now = new Date();

    if (!campaign.isActive) {
      throw new AppError(409, "Campaign đã bị tắt");
    }

    if (now < campaign.startAt || now > campaign.endAt) {
      throw new AppError(409, "Campaign chưa bắt đầu hoặc đã kết thúc");
    }

    if (
      campaign.usageLimit !== null &&
      campaign.usedCount >= campaign.usageLimit
    ) {
      throw new AppError(409, "Campaign đã hết lượt sử dụng");
    }

    if (subtotal < Number(campaign.minimumOrderAmount)) {
      throw new AppError(
        409,
        `Order phải đạt tối thiểu ${Number(campaign.minimumOrderAmount)}`,
      );
    }

    const [customerCampaignUsage, priorCompletedOrders] = await Promise.all([
      prisma.order.count({
        where: {
          customerId,
          campaignId: campaign.id,
          status: { notIn: [OrderStatus.Rejected, OrderStatus.Cancelled] },
        },
      }),
      campaign.isNewUserOnly
        ? prisma.order.count({
            where: {
              customerId,
              status: OrderStatus.Completed,
            },
          })
        : Promise.resolve(0),
    ]);

    if (customerCampaignUsage >= campaign.maxUsagePerUser) {
      throw new AppError(409, "Bạn đã dùng hết số lượt cho Campaign này");
    }

    if (campaign.isNewUserOnly && priorCompletedOrders > 0) {
      throw new AppError(409, "Campaign này chỉ dành cho khách hàng mới");
    }

    if (campaign.discountType === "Percentage") {
      discount = subtotal * (Number(campaign.discountValue) / 100);
    } else {
      discount = Number(campaign.discountValue);
    }

    if (campaign.maximumDiscount !== null) {
      discount = Math.min(discount, Number(campaign.maximumDiscount));
    }

    discount = Math.min(discount, subtotal);
  }

  const currentCustomer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { reviewerPoints: true },
  });
  const customerAvailablePoints = currentCustomer?.reviewerPoints ?? 0;
  const requestedPoints = Math.max(0, input.pointsToRedeem ?? 0);
  const pointsToRedeem = Math.min(requestedPoints, customerAvailablePoints);
  const pointDiscount = pointsToRedeem * 1000; // 1 point = 1,000 VND

  const totalDiscount = Math.min(discount + pointDiscount, subtotal);
  const finalPrice = Math.max(0, subtotal - totalDiscount);

  const createOrder = (client: Pick<typeof prisma, "order">) =>
    client.order.create({
      data: {
        customerId,
        merchantId,

        affiliateLinkId: affiliateLink?.id ?? null,

        campaignId: campaign?.id ?? null,

        name: input.name.trim(),

        orderType:
          input.orderType === "Offline" ? OrderType.Offline : OrderType.Online,

        paymentMethod: input.paymentMethod as PaymentMethod,

        status: OrderStatus.Pending,

        notes: input.notes?.trim() || null,

        deliveryAddress: input.deliveryAddress?.trim() || null,

        deliveryLatitude:
          input.deliveryLatitude != null
            ? new Prisma.Decimal(input.deliveryLatitude)
            : null,

        deliveryLongitude:
          input.deliveryLongitude != null
            ? new Prisma.Decimal(input.deliveryLongitude)
            : null,

        subtotal: new Prisma.Decimal(subtotal),

        discount: new Prisma.Decimal(totalDiscount),

        finalPrice: new Prisma.Decimal(finalPrice),

        details: {
          create: calculatedItems.map((item) => ({
            foodId: item.food.id,

            foodNameSnapshot: item.food.name,

            quantity: item.quantity,

            unitPrice: new Prisma.Decimal(item.unitPrice),

            notes: item.notes,

            lineTotal: new Prisma.Decimal(item.lineTotal),

            toppings: {
              create: item.selectedToppings.map((topping) => ({
                toppingId: topping.id,

                toppingNameSnapshot: topping.name,

                priceSnapshot: topping.price,
              })),
            },
          })),
        },
      },

      include: orderInclude,
    });

  const order = campaign
    ? await prisma.$transaction(async (transaction) => {
        // Atomic conditional update to prevent Race Conditions (TOCTOU)
        const updatedRows = await transaction.$executeRaw`
          UPDATE "campaigns"
          SET "usedCount" = "usedCount" + 1
          WHERE "id" = ${campaign.id}
            AND "isActive" = true
            AND "startAt" <= NOW()
            AND "endAt" >= NOW()
            AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
        `;

        if (updatedRows === 0) {
          throw new AppError(
            409,
            "Campaign đã hết lượt sử dụng hoặc không còn hiệu lực",
          );
        }

        return createOrder(transaction);
      })
    : await createOrder(prisma);

  if (pointsToRedeem > 0) {
    const newPoints = Math.max(0, customerAvailablePoints - pointsToRedeem);
    await prisma
      .$transaction([
        prisma.customer.update({
          where: { id: customerId },
          data: { reviewerPoints: { decrement: pointsToRedeem } },
        }),
        prisma.reviewerPointTransaction.create({
          data: {
            reviewerId: customerId,
            amount: -pointsToRedeem,
            pointsAfter: newPoints,
            type: "POINT_REDEMPTION",
            reason: `Dùng ${pointsToRedeem} điểm giảm ${(pointsToRedeem * 1000).toLocaleString("vi-VN")}đ đơn hàng`,
            referenceId: order.id,
          },
        }),
      ])
      .catch((err) => {
        console.error("Failed to deduct reviewer points:", err);
      });
  }

  const merchant = await prisma.merchant.findUnique({
    where: {
      id: order.merchantId,
    },

    select: {
      userId: true,
    },
  });

  if (merchant) {
    await createNotification({
      userId: merchant.userId,
      type: NotificationType.Order,
      title: "Bạn có đơn hàng mới",
      message: `Bạn vừa nhận được một đơn hàng mới từ ${order.name}.`,
      referenceId: order.id,
      referenceType: "Order",
    });
  }

  if (affiliateLink) {
    await prisma.affiliateTransaction.create({
      data: {
        affiliateLinkId: affiliateLink.id,
        orderId: order.id,
        status: "Pending",
      },
    }).catch(() => null);
  }

  const mappedOrder = mapOrder(order);

  try {
    realtimeService.sendToMerchant(order.merchantId, "order:new", mappedOrder);
    if (merchant) {
      realtimeService.sendToUser(merchant.userId, "order:new", mappedOrder);
    }
  } catch {}

  if (cacheKey) {
    recommendationCache.set(cacheKey, mappedOrder, 5 * 60 * 1000);
  }

  return mappedOrder;
};

export const createMerchantOrder = async (
  merchantId: string,
  customerId: string,
  input: CreateOrderInput,
) => {
  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId,
    },

    include: {
      user: {
        select: {
          isActive: true,
          role: true,
        },
      },
    },
  });

  if (!customer || !customer.user.isActive) {
    throw new AppError(404, "Không tìm thấy Customer");
  }

  if (!["Customer", "Reviewer"].includes(customer.user.role)) {
    throw new AppError(400, "Tài khoản được chọn không phải Customer");
  }

  const foodIds = [...new Set(input.foods.map((item) => item.foodId))];

  const foreignFood = await prisma.food.findFirst({
    where: {
      id: {
        in: foodIds,
      },

      merchantId: {
        not: merchantId,
      },
    },

    select: {
      id: true,
    },
  });

  if (foreignFood) {
    throw new AppError(
      403,
      "Merchant chỉ được tạo order bằng món của chính mình",
    );
  }

  /*
   * Hàm createOrder đã tự tính giá và kiểm tra món,
   * topping, campaign và affiliate link.
   */
  return createOrder(customerId, input);
};

export const getMyOrders = async (
  customerId: string,
  query: OrderListQuery,
) => {
  const pageIndex = query.pageIndex || 1;
  const pageSize = query.pageSize || 10;

  const where: Prisma.OrderWhereInput = {
    customerId,

    status:
      query.status === "Cancelled" || query.status === "Rejected"
        ? { in: [OrderStatus.Cancelled, OrderStatus.Rejected] }
        : query.status
          ? (query.status as OrderStatus)
          : undefined,
  };

  const [orders, totalItems] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: {
        orderedAt: "desc",
      },
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
    }),

    prisma.order.count({
      where,
    }),
  ]);

  return {
    items: orders.map(mapOrder),
    totalItems,
    pageIndex,
    pageSize,
    totalPages: Math.ceil(totalItems / pageSize),
  };
};

export const getMerchantOrders = async (
  merchantId: string,
  query: OrderListQuery,
) => {
  const pageIndex = query.pageIndex || 1;
  const pageSize = query.pageSize || 10;

  const where: Prisma.OrderWhereInput = {
    merchantId,

    status: query.status ? (query.status as OrderStatus) : undefined,
  };

  const [orders, totalItems] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: {
        orderedAt: "desc",
      },
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
    }),

    prisma.order.count({
      where,
    }),
  ]);

  return {
    items: orders.map(mapOrder),
    totalItems,
    pageIndex,
    pageSize,
    totalPages: Math.ceil(totalItems / pageSize),
  };
};

export const getOrderById = async (
  orderId: string,
  actor: {
    customerId?: string;
    merchantId?: string;
    role: string;
  },
) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },

    include: orderInclude,
  });

  if (!order) {
    throw new AppError(404, "Không tìm thấy Order");
  }

  const isCustomerOwner =
    Boolean(actor.customerId) && order.customerId === actor.customerId;

  const isMerchantOwner =
    Boolean(actor.merchantId) && order.merchantId === actor.merchantId;

  const isStaffOrAdmin = actor.role === "Staff" || actor.role === "Admin";

  if (!isCustomerOwner && !isMerchantOwner && !isStaffOrAdmin) {
    throw new AppError(403, "Bạn không có quyền xem Order này");
  }

  return mapOrder(order);
};

export const updateOrderStatus = async (
  merchantId: string,
  orderId: string,
  input: UpdateOrderStatusInput,
) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });

  if (!order) {
    throw new AppError(404, "Không tìm thấy order");
  }

  if (order.merchantId !== merchantId) {
    throw new AppError(403, "Order không thuộc Merchant này");
  }

  const nextStatus = input.status as OrderStatus;

  if (!canMerchantTransitionOrder(order.status, nextStatus, order.orderType)) {
    throw new AppError(
      409,
      `Không thể chuyển order từ ${order.status} sang ${nextStatus}`,
    );
  }

  const updatedOrder = await prisma.order.update({
    where: {
      id: orderId,
    },

    data: {
      status: nextStatus,

      paymentStatus:
        nextStatus === OrderStatus.Completed &&
        (order.paymentMethod === PaymentMethod.COD ||
          order.paymentMethod === PaymentMethod.Cash)
          ? OrderPaymentStatus.Paid
          : undefined,

      rejectionReason:
        nextStatus === OrderStatus.Rejected
          ? input.rejectionReason?.trim() || "Merchant từ chối order"
          : null,

      acceptedAt: nextStatus === OrderStatus.Accepted ? new Date() : undefined,

      preparingAt:
        nextStatus === OrderStatus.Preparing ? new Date() : undefined,

      readyAt: nextStatus === OrderStatus.Ready ? new Date() : undefined,

      deliveringAt:
        nextStatus === OrderStatus.Delivering ? new Date() : undefined,

      rejectedAt: nextStatus === OrderStatus.Rejected ? new Date() : undefined,

      completedAt:
        nextStatus === OrderStatus.Completed ? new Date() : undefined,
    },

    include: orderInclude,
  });

  const customer = await prisma.customer.findUnique({
    where: {
      id: updatedOrder.customerId,
    },

    select: {
      userId: true,
    },
  });

  if (customer) {
    if (nextStatus === OrderStatus.Accepted) {
      await createNotification({
        userId: customer.userId,
        type: NotificationType.Order,
        title: "Đơn hàng đã được chấp nhận",
        message: "Merchant đã chấp nhận đơn hàng của bạn.",
        referenceId: updatedOrder.id,
        referenceType: "Order",
      });
    }

    if (nextStatus === OrderStatus.Preparing) {
      await createNotification({
        userId: customer.userId,
        type: NotificationType.Order,
        title: "Quán đang chuẩn bị đơn",
        message: "Đơn hàng của bạn đã được chuyển sang bước chuẩn bị.",
        referenceId: updatedOrder.id,
        referenceType: "Order",
      });
    }

    if (nextStatus === OrderStatus.Ready) {
      await createNotification({
        userId: customer.userId,
        type: NotificationType.Order,
        title: "Đơn hàng đã sẵn sàng",
        message:
          updatedOrder.orderType === OrderType.Offline
            ? "Đơn của bạn đã sẵn sàng tại quán."
            : "Đơn của bạn đã sẵn sàng để giao.",
        referenceId: updatedOrder.id,
        referenceType: "Order",
      });
    }

    if (nextStatus === OrderStatus.Delivering) {
      await createNotification({
        userId: customer.userId,
        type: NotificationType.Order,
        title: "Đơn hàng đang được giao",
        message: "Đơn hàng đang trên đường đến địa chỉ của bạn.",
        referenceId: updatedOrder.id,
        referenceType: "Order",
      });
    }

    if (nextStatus === OrderStatus.Rejected) {
      await createNotification({
        userId: customer.userId,
        type: NotificationType.Order,
        title: "Đơn hàng bị từ chối",
        message: updatedOrder.rejectionReason
          ? `Merchant đã từ chối đơn hàng. Lý do: ${updatedOrder.rejectionReason}`
          : "Merchant đã từ chối đơn hàng của bạn.",
        referenceId: updatedOrder.id,
        referenceType: "Order",
      });
    }

    if (nextStatus === OrderStatus.Completed) {
      await createNotification({
        userId: customer.userId,
        type: NotificationType.Order,
        title: "Đơn hàng đã hoàn thành",
        message: "Đơn hàng của bạn đã được Merchant hoàn thành.",
        referenceId: updatedOrder.id,
        referenceType: "Order",
      });
    }
  }

  if (
    nextStatus === OrderStatus.Completed &&
    updatedOrder.paymentStatus === OrderPaymentStatus.Paid &&
    updatedOrder.affiliateLinkId
  ) {
    await prisma.affiliateTransaction.updateMany({
      where: {
        orderId: updatedOrder.id,
        status: AffiliateTransactionStatus.Pending,
      },
      data: { status: AffiliateTransactionStatus.Success },
    }).catch(() => null);

    await createReviewerCommission(updatedOrder.id);
  } else if (
    (nextStatus === OrderStatus.Rejected || nextStatus === OrderStatus.Cancelled) &&
    updatedOrder.affiliateLinkId
  ) {
    await prisma.affiliateTransaction.updateMany({
      where: {
        orderId: updatedOrder.id,
        status: {
          in: [
            AffiliateTransactionStatus.Pending,
            AffiliateTransactionStatus.Success,
          ],
        },
      },
      data: { status: AffiliateTransactionStatus.Failed },
    }).catch(() => null);
  }

  const refreshedOrder = await prisma.order.findUniqueOrThrow({
    where: {
      id: updatedOrder.id,
    },
    include: orderInclude,
  });

  const mappedRefreshed = mapOrder(refreshedOrder);

  try {
    if (customer) {
      realtimeService.sendToUser(customer.userId, "order:status_changed", mappedRefreshed);
    }
    realtimeService.sendToMerchant(updatedOrder.merchantId, "order:status_changed", mappedRefreshed);
  } catch {}

  return mappedRefreshed;
};

export const updateCustomerOrderStatus = async (
  customerId: string,
  orderId: string,
  input: CustomerUpdateOrderStatusInput,
) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });

  if (!order) {
    throw new AppError(404, "Không tìm thấy order");
  }

  if (order.customerId !== customerId) {
    throw new AppError(403, "Order không thuộc Customer này");
  }

  if (!canCustomerConfirmOrder(order.status, order.orderType)) {
    throw new AppError(
      409,
      `Không thể xác nhận order khi trạng thái hiện tại là ${order.status}`,
    );
  }

  const nextStatus = input.status as OrderStatus;

  if (
    nextStatus !== OrderStatus.Completed &&
    nextStatus !== OrderStatus.NotReceived
  ) {
    throw new AppError(
      400,
      "Customer chỉ được xác nhận Completed hoặc NotReceived",
    );
  }

  const updatedOrder = await prisma.order.update({
    where: {
      id: orderId,
    },

    data: {
      status: nextStatus,

      paymentStatus:
        nextStatus === OrderStatus.Completed &&
        (order.paymentMethod === PaymentMethod.COD ||
          order.paymentMethod === PaymentMethod.Cash)
          ? OrderPaymentStatus.Paid
          : undefined,

      completedAt:
        nextStatus === OrderStatus.Completed ? new Date() : undefined,
    },

    include: orderInclude,
  });

  const merchant = await prisma.merchant.findUnique({
    where: {
      id: updatedOrder.merchantId,
    },

    select: {
      userId: true,
    },
  });

  if (merchant) {
    if (nextStatus === OrderStatus.Completed) {
      await createNotification({
        userId: merchant.userId,
        type: NotificationType.Order,
        title: "Khách hàng đã nhận đơn",
        message: "Khách hàng đã xác nhận nhận được đơn hàng.",
        referenceId: updatedOrder.id,
        referenceType: "Order",
      });
    }

    if (nextStatus === OrderStatus.NotReceived) {
      await createNotification({
        userId: merchant.userId,
        type: NotificationType.Order,
        title: "Khách hàng chưa nhận được đơn",
        message: "Khách hàng báo chưa nhận được đơn hàng.",
        referenceId: updatedOrder.id,
        referenceType: "Order",
      });
    }
  }

  if (
    nextStatus === OrderStatus.Completed &&
    updatedOrder.paymentStatus === OrderPaymentStatus.Paid &&
    updatedOrder.affiliateLinkId
  ) {
    await prisma.affiliateTransaction.updateMany({
      where: {
        orderId: updatedOrder.id,
        status: AffiliateTransactionStatus.Pending,
      },
      data: { status: AffiliateTransactionStatus.Success },
    }).catch(() => null);

    await createReviewerCommission(updatedOrder.id);
  }

  const refreshedOrder = await prisma.order.findUniqueOrThrow({
    where: {
      id: updatedOrder.id,
    },

    include: orderInclude,
  });

  const mappedRefreshed = mapOrder(refreshedOrder);

  try {
    if (merchant) {
      realtimeService.sendToUser(merchant.userId, "order:status_changed", mappedRefreshed);
    }
    realtimeService.sendToMerchant(updatedOrder.merchantId, "order:status_changed", mappedRefreshed);
  } catch {}

  return mappedRefreshed;
};
