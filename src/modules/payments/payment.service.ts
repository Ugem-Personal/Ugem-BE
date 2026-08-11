import {
  BillStatus,
  NotificationType,
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  Prisma,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
  ConfirmBillInput,
  RejectBillInput,
  SepayWebhookInput,
  SubmitBillInput,
} from "./payment.types.js";

import { createReviewerCommission } from "../affiliate-links/affiliate-earning.service.js";
import { createNotification } from "../notifications/notification.service.js";

const activeOrderStatuses = new Set<OrderStatus>([
  OrderStatus.Accepted,
  OrderStatus.Preparing,
  OrderStatus.Ready,
  OrderStatus.Delivering,
]);

const notifyPaymentSuccess = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,

      customer: {
        select: {
          userId: true,
        },
      },

      details: {
        include: {
          toppings: true,
        },
      },
    },
  });

  if (!order) {
    return;
  }

  await createNotification({
    userId: order.customer.userId,
    type: NotificationType.Payment,
    title: "Thanh toán thành công",
    message: "Đơn hàng của bạn đã được xác nhận thanh toán thành công.",
    referenceId: order.id,
    referenceType: "Order",
  });
};

const billInclude = {
  order: {
    include: {
      merchant: {
        select: {
          id: true,
          userId: true,
          name: true,
          logoUrl: true,
          phone: true,
          address: true,
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
            },
          },
        },
      },

      details: {
        include: {
          toppings: true,
        },
      },
    },
  },
};

const mapBill = (bill: any) => ({
  id: bill.id,
  billId: bill.id,
  orderId: bill.orderId,

  method: bill.method,
  status: bill.status,
  amount: Number(bill.amount),
  totalAmount: Number(bill.amount),

  evidenceUrl: bill.evidenceUrl,
  transferContent: bill.transferContent,
  sepayReference: bill.sepayReference,

  requestedAt: bill.requestedAt,
  merchantConfirmedAt: bill.merchantConfirmedAt,
  customerConfirmedAt: bill.customerConfirmedAt,
  rejectedAt: bill.rejectedAt,
  rejectionReason: bill.rejectionReason,

  bankName: env.BANK_CODE,
  bankAccount: env.BANK_ACCOUNT_NUMBER,

  paymentMethod: bill.order?.paymentMethod ?? bill.method,
  finalPrice: bill.order ? Number(bill.order.finalPrice) : Number(bill.amount),
  items:
    bill.order?.details?.map((detail: any) => ({
      id: detail.id,
      foodId: detail.foodId,
      name: detail.foodNameSnapshot,
      quantity: detail.quantity,
      unitPrice: Number(detail.unitPrice),
      subTotal: Number(detail.lineTotal),
      notes: detail.notes,
      toppings: detail.toppings.map((topping: any) => ({
        id: topping.toppingId,
        name: topping.toppingNameSnapshot,
        price: Number(topping.priceSnapshot),
      })),
    })) ?? [],

  order: bill.order
    ? {
        id: bill.order.id,
        customerId: bill.order.customerId,
        merchantId: bill.order.merchantId,

        status: bill.order.status,
        paymentStatus: bill.order.paymentStatus,
        paymentMethod: bill.order.paymentMethod,

        finalPrice: Number(bill.order.finalPrice),

        merchant: bill.order.merchant,
        customer: bill.order.customer,
      }
    : undefined,

  createdAt: bill.createdAt,
  updatedAt: bill.updatedAt,
});

const findBillOptional = async (input: { orderId?: string; billId?: string }) => {
  if (input.billId) {
    return prisma.bill.findUnique({
      where: {
        id: input.billId,
      },
      include: billInclude,
    });
  }

  if (input.orderId) {
    return prisma.bill.findUnique({
      where: {
        orderId: input.orderId,
      },
      include: billInclude,
    });
  }

  return null;
};

const findBill = async (input: { orderId?: string; billId?: string }) => {
  const bill = await findBillOptional(input);

  if (!bill) {
    throw new AppError(404, "Không tìm thấy hóa đơn");
  }

  return bill;
};

export const requestCashConfirmation = async (
  customerId: string,
  orderId: string,
) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },

    include: {
      bill: true,

      merchant: {
        select: {
          userId: true,
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

  if (order.paymentMethod !== PaymentMethod.Cash) {
    throw new AppError(400, "Order này không sử dụng phương thức tiền mặt");
  }

  if (!activeOrderStatuses.has(order.status)) {
    throw new AppError(
      409,
      "Chỉ Order đã được chấp nhận mới có thể yêu cầu xác nhận tiền mặt",
    );
  }

  if (order.paymentStatus === OrderPaymentStatus.Paid) {
    throw new AppError(409, "Order đã được thanh toán");
  }

  const bill = await prisma.bill.upsert({
    where: {
      orderId: order.id,
    },

    create: {
      orderId: order.id,
      method: PaymentMethod.Cash,
      amount: order.finalPrice,

      status: BillStatus.Requested,

      requestedAt: new Date(),
    },

    update: {
      method: PaymentMethod.Cash,
      amount: order.finalPrice,

      status: BillStatus.Requested,

      requestedAt: new Date(),

      merchantConfirmedAt: null,
      customerConfirmedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    },

    include: billInclude,
  });

  await createNotification({
    userId: order.merchant.userId,
    type: NotificationType.Payment,
    title: "Khách hàng yêu cầu xác nhận tiền mặt",
    message:
      "Khách hàng cho biết đã thanh toán bằng tiền mặt. Vui lòng kiểm tra và xác nhận.",
    referenceId: order.id,
    referenceType: "Order",
  });

  return mapBill(bill);
};

export const confirmCashPayment = async (
  merchantId: string,
  orderId: string,
) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },

    include: {
      bill: true,

      customer: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, "Không tìm thấy Order");
  }

  if (order.merchantId !== merchantId) {
    throw new AppError(403, "Order không thuộc Merchant này");
  }

  if (!activeOrderStatuses.has(order.status)) {
    throw new AppError(
      409,
      "Order chưa ở trạng thái có thể xác nhận thanh toán",
    );
  }

  if (order.paymentStatus === OrderPaymentStatus.Paid) {
    throw new AppError(409, "Order đã được thanh toán");
  }

  const result = await prisma.$transaction(async (transaction) => {
    const updatedBill = await transaction.bill.upsert({
      where: {
        orderId: order.id,
      },

      create: {
        orderId: order.id,
        method: order.paymentMethod,
        amount: order.finalPrice,
        status: BillStatus.Confirmed,
        merchantConfirmedAt: new Date(),
        customerConfirmedAt: new Date(),
      },

      update: {
        status: BillStatus.Confirmed,
        merchantConfirmedAt: new Date(),
        customerConfirmedAt: new Date(),
      },

      include: billInclude,
    });

    await transaction.order.update({
      where: {
        id: order.id,
      },

      data: {
        paymentStatus: OrderPaymentStatus.Paid,
      },
    });

    return updatedBill;
  });

  await createNotification({
    userId: order.customer.userId,
    type: NotificationType.Payment,
    title: "Thanh toán tiền mặt đã được xác nhận",
    message: "Merchant đã xác nhận nhận được tiền mặt của bạn.",
    referenceId: order.id,
    referenceType: "Order",
  });

  return mapBill(result);
};

export const submitBill = async (
  merchantId: string,
  input: SubmitBillInput,
) => {
  const order = await prisma.order.findUnique({
    where: {
      id: input.orderId,
    },

    include: {
      details: true,
    },
  });

  if (!order) {
    throw new AppError(404, "Không tìm thấy order");
  }

  if (order.merchantId !== merchantId) {
    throw new AppError(403, "Order không thuộc Merchant này");
  }

  if (
    !activeOrderStatuses.has(order.status) &&
    order.status !== OrderStatus.Completed
  ) {
    throw new AppError(409, "Order chưa được chấp nhận");
  }

  if (order.paymentStatus === OrderPaymentStatus.Paid) {
    throw new AppError(409, "Order đã được thanh toán");
  }

  const result = await prisma.$transaction(async (transaction) => {
    let subtotal = Number(order.subtotal);

    if (input.items !== undefined) {
      const requestedFoodIds = [
        ...new Set(input.items.map((item) => item.foodId)),
      ];

      const foods = await transaction.food.findMany({
        where: {
          id: {
            in: requestedFoodIds,
          },

          merchantId,
        },

        select: {
          id: true,
          name: true,
          price: true,
        },
      });

      if (foods.length !== requestedFoodIds.length) {
        throw new AppError(
          400,
          "Có món ăn không tồn tại hoặc không thuộc Merchant",
        );
      }

      const foodMap = new Map(foods.map((food) => [food.id, food]));

      await transaction.orderDetailTopping.deleteMany({
        where: {
          orderDetail: {
            orderId: order.id,
          },
        },
      });

      await transaction.orderDetail.deleteMany({
        where: {
          orderId: order.id,
        },
      });

      subtotal = 0;

      for (const item of input.items) {
        const food = foodMap.get(item.foodId);

        if (!food) {
          throw new AppError(400, "Không tìm thấy món ăn");
        }

        const quantity = item.quantity ?? 1;

        const unitPrice =
          item.unitPrice !== undefined
            ? Number(item.unitPrice)
            : Number(food.price);

        const lineTotal = unitPrice * quantity;

        subtotal += lineTotal;

        await transaction.orderDetail.create({
          data: {
            orderId: order.id,
            foodId: food.id,

            foodNameSnapshot: food.name,

            quantity,
            unitPrice,
            lineTotal,
          },
        });
      }
    }

    const discount =
      input.discount !== undefined
        ? Number(input.discount)
        : Number(order.discount);

    if (discount > subtotal) {
      throw new AppError(400, "Giảm giá không được lớn hơn tổng tiền món");
    }

    const finalPrice = subtotal - discount;

    if (
      input.amount !== undefined &&
      Math.abs(Number(input.amount) - finalPrice) > 0.01
    ) {
      throw new AppError(400, "Số tiền hóa đơn không khớp với tổng order");
    }

    await transaction.order.update({
      where: {
        id: order.id,
      },

      data: {
        subtotal,
        discount,
        finalPrice,
        paymentStatus: OrderPaymentStatus.Pending,
      },
    });

    const savedBill = await transaction.bill.upsert({
      where: {
        orderId: order.id,
      },

      create: {
        orderId: order.id,
        method: order.paymentMethod,

        status: BillStatus.PendingCustomerConfirmation,

        amount: finalPrice,

        evidenceUrl: input.evidenceUrl?.trim() || null,

        transferContent: input.transferContent?.trim() || `UGEM-${order.id}`,

        merchantConfirmedAt: new Date(),
      },

      update: {
        method: order.paymentMethod,

        status: BillStatus.PendingCustomerConfirmation,

        amount: finalPrice,

        evidenceUrl: input.evidenceUrl?.trim() || null,

        transferContent: input.transferContent?.trim() || `UGEM-${order.id}`,

        merchantConfirmedAt: new Date(),

        customerConfirmedAt: null,
        rejectedAt: null,
        rejectionReason: null,
      },

      include: billInclude,
    });

    return savedBill;
  });

  await createNotification({
    userId: result.order.customer.user.id,
    type: NotificationType.Payment,
    title: "Merchant đã gửi hóa đơn",
    message:
      "Merchant đã gửi hoặc cập nhật hóa đơn. Vui lòng kiểm tra và xác nhận.",
    referenceId: result.orderId,
    referenceType: "Order",
  });

  return mapBill(result);
};

export const getCustomerBills = async (
  customerId: string,
  orderId?: string,
) => {
  if (orderId) {
    const bill = await prisma.bill.findUnique({
      where: {
        orderId,
      },

      include: billInclude,
    });

    if (bill) {
      if (bill.order.customerId !== customerId) {
        throw new AppError(403, "Hóa đơn không thuộc Customer này");
      }

      return mapBill(bill);
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },

      include: {
        merchant: {
          select: {
            id: true,
            userId: true,
            name: true,
            logoUrl: true,
            phone: true,
            address: true,
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
              },
            },
          },
        },

        details: {
          include: {
            toppings: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError(404, "Không tìm thấy đơn hàng");
    }

    if (order.customerId !== customerId) {
      throw new AppError(403, "Đơn hàng không thuộc Customer này");
    }

    return mapBill({
      id: order.id,
      orderId: order.id,
      method: order.paymentMethod,
      status: BillStatus.PendingCustomerConfirmation,
      amount: order.finalPrice,
      evidenceUrl: null,
      transferContent: `UGEM-${order.id}`,
      sepayReference: null,
      requestedAt: order.createdAt,
      merchantConfirmedAt: null,
      customerConfirmedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      order,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  }

  const bills = await prisma.bill.findMany({
    where: {
      order: {
        customerId,
      },
    },

    include: billInclude,

    orderBy: {
      createdAt: "desc",
    },
  });

  return bills.map(mapBill);
};

export const confirmBill = async (
  customerId: string,
  input: ConfirmBillInput,
) => {
  const existingBill = await findBillOptional(input);

  if (!existingBill) {
    const orderId = input.orderId;
    if (!orderId) {
      throw new AppError(404, "Không tìm thấy hóa đơn");
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: {
          select: {
            id: true,
            userId: true,
            name: true,
            logoUrl: true,
            phone: true,
            address: true,
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
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new AppError(404, "Không tìm thấy đơn hàng");
    }

    if (order.customerId !== customerId) {
      throw new AppError(403, "Đơn hàng không thuộc Customer này");
    }

    const confirmedBill = await prisma.$transaction(async (transaction) => {
      if (order.paymentMethod === PaymentMethod.Cash) {
        await transaction.order.update({
          where: { id: order.id },
          data: { paymentStatus: OrderPaymentStatus.Paid },
        });
      }

      return await transaction.bill.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          method: order.paymentMethod,
          amount: order.finalPrice,
          status: BillStatus.Confirmed,
          merchantConfirmedAt: new Date(),
          customerConfirmedAt: new Date(),
        },
        update: {
          status: BillStatus.Confirmed,
          customerConfirmedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
        },
        include: billInclude,
      });
    });

    await notifyPaymentSuccess(confirmedBill.orderId);

    await createNotification({
      userId: confirmedBill.order.merchant.userId,
      type: NotificationType.Payment,
      title: "Customer đã xác nhận hóa đơn",
      message: "Customer đã xác nhận hóa đơn và thanh toán đơn hàng thành công.",
      referenceId: confirmedBill.orderId,
      referenceType: "Order",
    });

    if (confirmedBill.order.status === OrderStatus.Completed) {
      await createReviewerCommission(confirmedBill.orderId);
    }

    return mapBill(confirmedBill);
  }

  if (existingBill.order.customerId !== customerId) {
    throw new AppError(403, "Hóa đơn không thuộc Customer này");
  }

  const confirmedBill = await prisma.$transaction(async (transaction) => {
    if (existingBill.order.paymentMethod === PaymentMethod.Cash) {
      await transaction.order.update({
        where: {
          id: existingBill.orderId,
        },

        data: {
          paymentStatus: OrderPaymentStatus.Paid,
        },
      });
    }

    const updatedBill = await transaction.bill.update({
      where: {
        id: existingBill.id,
      },

      data: {
        status: BillStatus.Confirmed,
        customerConfirmedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },

      include: billInclude,
    });

    return updatedBill;
  });

  await notifyPaymentSuccess(confirmedBill.orderId);

  await createNotification({
    userId: confirmedBill.order.merchant.userId,
    type: NotificationType.Payment,
    title: "Customer đã xác nhận hóa đơn",
    message: "Customer đã xác nhận hóa đơn và thanh toán đơn hàng thành công.",
    referenceId: confirmedBill.orderId,
    referenceType: "Order",
  });

  if (confirmedBill.order.status === OrderStatus.Completed) {
    await createReviewerCommission(confirmedBill.orderId);
  }

  return mapBill(confirmedBill);
};

export const rejectBill = async (
  customerId: string,
  input: RejectBillInput,
) => {
  const existingBill = await findBillOptional(input);

  if (!existingBill) {
    const orderId = input.orderId;
    if (!orderId) {
      throw new AppError(404, "Không tìm thấy hóa đơn");
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: {
          select: {
            id: true,
            userId: true,
            name: true,
            logoUrl: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError(404, "Không tìm thấy đơn hàng");
    }

    if (order.customerId !== customerId) {
      throw new AppError(403, "Đơn hàng không thuộc Customer này");
    }

    const rejectedBill = await prisma.$transaction(async (transaction) => {
      const upsertedBill = await transaction.bill.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          method: order.paymentMethod,
          amount: order.finalPrice,
          status: BillStatus.Rejected,
          rejectedAt: new Date(),
          rejectionReason: input.rejectionReason.trim(),
        },
        update: {
          status: BillStatus.Rejected,
          rejectedAt: new Date(),
          rejectionReason: input.rejectionReason.trim(),
          customerConfirmedAt: null,
        },
        include: billInclude,
      });

      await transaction.order.update({
        where: { id: order.id },
        data: { paymentStatus: OrderPaymentStatus.Rejected },
      });

      return upsertedBill;
    });

    await createNotification({
      userId: rejectedBill.order.merchant.userId,
      type: NotificationType.Payment,
      title: "Customer đã từ chối hóa đơn",
      message: `Customer đã từ chối hóa đơn. Lý do: ${
        rejectedBill.rejectionReason ?? "Không cung cấp lý do"
      }`,
      referenceId: rejectedBill.orderId,
      referenceType: "Order",
    });

    return mapBill(rejectedBill);
  }

  if (existingBill.order.customerId !== customerId) {
    throw new AppError(403, "Hóa đơn không thuộc Customer này");
  }

  const rejectedBill = await prisma.$transaction(async (transaction) => {
    const updatedBill = await transaction.bill.update({
      where: {
        id: existingBill.id,
      },

      data: {
        status: BillStatus.Rejected,
        rejectedAt: new Date(),
        rejectionReason: input.rejectionReason.trim(),
        customerConfirmedAt: null,
      },

      include: billInclude,
    });

    await transaction.order.update({
      where: {
        id: existingBill.orderId,
      },

      data: {
        paymentStatus: OrderPaymentStatus.Rejected,
      },
    });

    return updatedBill;
  });

  await createNotification({
    userId: rejectedBill.order.merchant.userId,
    type: NotificationType.Payment,
    title: "Customer đã từ chối hóa đơn",
    message: `Customer đã từ chối hóa đơn. Lý do: ${
      rejectedBill.rejectionReason ?? "Không cung cấp lý do"
    }`,
    referenceId: rejectedBill.orderId,
    referenceType: "Order",
  });

  return mapBill(rejectedBill);
};

const extractOrderId = async (content?: string): Promise<string | null> => {
  if (!content) {
    return null;
  }

  const uuidMatch = content.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );

  if (uuidMatch?.[0]) {
    return uuidMatch[0];
  }

  const hex8Match = content.match(/[0-9a-f]{8}/i);
  if (hex8Match?.[0]) {
    const matchedOrder = await prisma.order.findFirst({
      where: {
        id: {
          startsWith: hex8Match[0].toLowerCase(),
        },
      },
      select: { id: true },
    });
    if (matchedOrder) {
      return matchedOrder.id;
    }
  }

  return null;
};

export const processSepayWebhook = async (input: SepayWebhookInput) => {
  const orderId = input.orderId ?? (await extractOrderId(input.content));

  if (!orderId) {
    throw new AppError(400, "Không xác định được Order ID từ giao dịch");
  }

  const reference = input.referenceCode?.trim();

  if (!reference) {
    throw new AppError(400, "Giao dịch thiếu referenceCode");
  }

  const amount = input.transferAmount ?? input.amount;

  if (!amount) {
    throw new AppError(400, "Giao dịch thiếu số tiền");
  }

  const existingReference = await prisma.bill.findUnique({
    where: {
      sepayReference: reference,
    },
  });

  if (existingReference) {
    return mapBill(
      await prisma.bill.findUniqueOrThrow({
        where: {
          id: existingReference.id,
        },

        include: billInclude,
      }),
    );
  }

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });

  if (!order) {
    throw new AppError(404, "Không tìm thấy order tương ứng");
  }

  if (Math.abs(amount - Number(order.finalPrice)) > 0.01) {
    throw new AppError(409, "Số tiền chuyển khoản không khớp");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.order.update({
      where: {
        id: orderId,
      },

      data: {
        paymentStatus: OrderPaymentStatus.Paid,
      },
    });

    await transaction.bill.update({
      where: {
        orderId,
      },

      data: {
        status: BillStatus.Confirmed,
        sepayReference: reference,
        transferContent: input.content?.trim() || null,
        merchantConfirmedAt: new Date(),
        customerConfirmedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },
    });
  });

  const bill = await prisma.bill.findUniqueOrThrow({
    where: { orderId },
    include: billInclude,
  });

  await notifyPaymentSuccess(bill.orderId);

  if (bill.order.status === OrderStatus.Completed) {
    await createReviewerCommission(bill.orderId);
  }

  return mapBill(bill);
};
