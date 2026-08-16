export interface CreateBookingInput {
  merchantId: string;
  bookingAt: Date;
  partySize: number;
  note?: string;
  affiliateLinkCode?: string;
}

export interface ReviewBookingInput {
  status: "Accepted" | "Rejected";
  rejectionReason?: string;
}
