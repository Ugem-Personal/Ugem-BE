import { describe, expect, it } from "vitest";

import { OrderStatus, OrderType } from "../../generated/prisma/client.js";
import {
  canCustomerConfirmOrder,
  canMerchantTransitionOrder,
  getMerchantOrderTransitions,
} from "./order-state-machine.js";

describe("merchant order state machine", () => {
  it("allows a pending order to be accepted or rejected", () => {
    expect(
      getMerchantOrderTransitions(OrderStatus.Pending),
    ).toEqual([OrderStatus.Accepted, OrderStatus.Rejected]);
  });

  it("rejects invalid and repeated transitions", () => {
    expect(
      canMerchantTransitionOrder(
        OrderStatus.Pending,
        OrderStatus.Completed,
        OrderType.Online,
      ),
    ).toBe(false);
    expect(
      canMerchantTransitionOrder(
        OrderStatus.Accepted,
        OrderStatus.Accepted,
        OrderType.Online,
      ),
    ).toBe(false);
  });

  it.each([
    OrderStatus.Delivering,
    OrderStatus.Rejected,
    OrderStatus.Completed,
    OrderStatus.NotReceived,
    OrderStatus.Cancelled,
  ])("keeps %s terminal for merchant actions", (status) => {
    expect(getMerchantOrderTransitions(status)).toEqual([]);
  });

  it("moves accepted orders through preparation and readiness", () => {
    expect(
      canMerchantTransitionOrder(
        OrderStatus.Accepted,
        OrderStatus.Preparing,
        OrderType.Offline,
      ),
    ).toBe(true);
    expect(
      canMerchantTransitionOrder(
        OrderStatus.Preparing,
        OrderStatus.Ready,
        OrderType.Offline,
      ),
    ).toBe(true);
  });

  it("only allows delivery for online orders", () => {
    expect(
      canMerchantTransitionOrder(
        OrderStatus.Ready,
        OrderStatus.Delivering,
        OrderType.Online,
      ),
    ).toBe(true);
    expect(
      canMerchantTransitionOrder(
        OrderStatus.Ready,
        OrderStatus.Delivering,
        OrderType.Offline,
      ),
    ).toBe(false);
  });

  it("lets customers finish an order only at the correct handoff stage", () => {
    expect(canCustomerConfirmOrder(OrderStatus.Ready, OrderType.Offline)).toBe(
      true,
    );
    expect(
      canCustomerConfirmOrder(OrderStatus.Delivering, OrderType.Online),
    ).toBe(true);
    expect(canCustomerConfirmOrder(OrderStatus.Ready, OrderType.Online)).toBe(
      false,
    );
    expect(
      canCustomerConfirmOrder(OrderStatus.Preparing, OrderType.Offline),
    ).toBe(false);
  });

});
