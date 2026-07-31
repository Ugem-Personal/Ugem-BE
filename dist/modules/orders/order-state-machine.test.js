import { describe, expect, it } from "vitest";
import { OrderStatus } from "../../generated/prisma/client.js";
import { canMerchantTransitionOrder, getMerchantOrderTransitions, } from "./order-state-machine.js";
describe("merchant order state machine", () => {
    it("allows a pending order to be accepted or rejected", () => {
        expect(getMerchantOrderTransitions(OrderStatus.Pending)).toEqual([OrderStatus.Accepted, OrderStatus.Rejected]);
    });
    it("rejects invalid and repeated transitions", () => {
        expect(canMerchantTransitionOrder(OrderStatus.Pending, OrderStatus.Completed)).toBe(false);
        expect(canMerchantTransitionOrder(OrderStatus.Accepted, OrderStatus.Accepted)).toBe(false);
    });
    it.each([
        OrderStatus.Accepted,
        OrderStatus.Rejected,
        OrderStatus.Completed,
        OrderStatus.NotReceived,
        OrderStatus.Cancelled,
    ])("keeps %s terminal for merchant actions", (status) => {
        expect(getMerchantOrderTransitions(status)).toEqual([]);
    });
});
