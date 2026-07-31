import { OrderStatus } from "../../generated/prisma/client.js";

const merchantTransitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.Pending]: [OrderStatus.Accepted, OrderStatus.Rejected],
  [OrderStatus.Accepted]: [],
  [OrderStatus.Rejected]: [],
  [OrderStatus.Completed]: [],
  [OrderStatus.NotReceived]: [],
  [OrderStatus.Cancelled]: [],
};

export const getMerchantOrderTransitions = (
  currentStatus: OrderStatus,
): readonly OrderStatus[] => merchantTransitions[currentStatus];

export const canMerchantTransitionOrder = (
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): boolean => getMerchantOrderTransitions(currentStatus).includes(nextStatus);
