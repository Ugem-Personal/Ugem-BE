export interface CreateBookingInput {
  merchantId: string;
  bookingAt: Date;
  partySize: number;
  note?: string;
}

export interface ReviewBookingInput {
  status: "Accepted" | "Rejected";
  rejectionReason?: string;
}
