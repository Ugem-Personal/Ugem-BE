export interface CreateOrderFoodInput {
  foodId: string;
  quantity: number;
  notes?: string | null;
  foodToppingIds?: string[];
}

export interface CreateOrderInput {
  name: string;
  paymentMethod: "COD" | "Cash" | "BankTransfer" | "SePay";

  notes?: string | null;
  deliveryAddress?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  orderType: "Online" | "Offline";

  /*
   * FE có gửi finalPrice nhưng Backend không được tin.
   */
  finalPrice?: number;

  affiliateLinkCode?: string | null;

  campaignId?: string | null;

  pointsToRedeem?: number | null;

  foods: CreateOrderFoodInput[];
}

export interface UpdateOrderStatusInput {
  status:
    | "Accepted"
    | "Preparing"
    | "Ready"
    | "Delivering"
    | "Rejected";

  rejectionReason?: string | null;
}

export interface OrderListQuery {
  status?: string;
  pageIndex: number;
  pageSize: number;
}

export interface MerchantRejectOrderInput {
  orderId: string;
  reason: string;
}

export interface CustomerUpdateOrderStatusInput {
  status: "Completed" | "NotReceived";
}
