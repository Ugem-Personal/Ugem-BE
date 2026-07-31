import { OrderStatus } from "../../generated/prisma/client.js";
const merchantTransitions = {
    [OrderStatus.Pending]: [OrderStatus.Accepted, OrderStatus.Rejected],
    [OrderStatus.Accepted]: [],
    [OrderStatus.Rejected]: [],
    [OrderStatus.Completed]: [],
    [OrderStatus.NotReceived]: [],
    [OrderStatus.Cancelled]: [],
};
export const getMerchantOrderTransitions = (currentStatus) => merchantTransitions[currentStatus];
export const canMerchantTransitionOrder = (currentStatus, nextStatus) => getMerchantOrderTransitions(currentStatus).includes(nextStatus);
