import {
  OrderStatus,
  OrderType,
} from "../../generated/prisma/client.js";

const merchantTransitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.Pending]: [OrderStatus.Accepted, OrderStatus.Rejected],
  [OrderStatus.Accepted]: [OrderStatus.Preparing],
  [OrderStatus.Preparing]: [OrderStatus.Ready],
  [OrderStatus.Ready]: [OrderStatus.Delivering],
  [OrderStatus.Delivering]: [],
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
  orderType: OrderType,
): boolean => {
  if (
    currentStatus === OrderStatus.Ready &&
    nextStatus === OrderStatus.Delivering &&
    orderType !== OrderType.Online
  ) {
    return false;
  }

  return getMerchantOrderTransitions(currentStatus).includes(nextStatus);
};

export const canCustomerConfirmOrder = (
  currentStatus: OrderStatus,
  orderType: OrderType,
): boolean => {
  return orderType === OrderType.Offline
    ? currentStatus === OrderStatus.Ready
    : currentStatus === OrderStatus.Delivering;
};
