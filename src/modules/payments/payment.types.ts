export interface SubmitBillItemInput {
  foodId: string;
  quantity?: number;
  unitPrice?: number;
}

export interface SubmitBillInput {
  orderId: string;

  amount?: number;
  discount?: number;

  items?: SubmitBillItemInput[];

  evidenceUrl?: string | null;
  transferContent?: string | null;
}

export interface ConfirmBillInput {
  orderId?: string;
  billId?: string;
  paymentMethod?: "Cash" | "BankTransfer";
}

export interface RejectBillInput {
  orderId?: string;
  billId?: string;
  rejectionReason: string;
}

export interface SepayWebhookInput {
  id?: number;
  orderId?: string;
  referenceCode?: string;
  content?: string;
  accountNumber?: string;
  transferType?: "in" | "out";
  transferAmount?: number;
  amount?: number;
}
