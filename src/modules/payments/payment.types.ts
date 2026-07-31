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
}

export interface RejectBillInput {
  orderId?: string;
  billId?: string;
  rejectionReason: string;
}

export interface SepayWebhookInput {
  orderId?: string;
  referenceCode?: string;
  content?: string;
  transferAmount?: number;
  amount?: number;
}
