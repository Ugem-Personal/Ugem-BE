import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "../../generated/prisma/client.js";

export type CreateSupportTicketInput = {
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  orderId?: string;
};

export type SupportTicketListQuery = {
  status?: SupportTicketStatus;
};

export type CreateSupportMessageInput = {
  message: string;
  attachmentUrl?: string;
  isInternal?: boolean;
};

export type UpdateSupportTicketStatusInput = {
  status: SupportTicketStatus;
};
