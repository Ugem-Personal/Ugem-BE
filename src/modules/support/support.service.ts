import {
  NotificationType,
  SupportTicketStatus,
  UserRole,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  createNotification,
  notifyActiveUsersByRoles,
} from "../notifications/notification.service.js";
import type {
  CreateSupportMessageInput,
  CreateSupportTicketInput,
  SupportTicketListQuery,
  UpdateSupportTicketStatusInput,
} from "./support.types.js";

const ticketInclude = {
  merchant: { select: { id: true, name: true, userId: true } },
  createdBy: { select: { id: true, fullName: true, email: true, role: true } },
  assignedStaff: {
    select: { id: true, fullName: true, email: true, role: true },
  },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      sender: { select: { id: true, fullName: true, email: true, role: true } },
    },
  },
};

const mapTicket = (ticket: any) => ({
  id: ticket.id,
  merchantId: ticket.merchantId,
  category: ticket.category,
  priority: ticket.priority,
  status: ticket.status,
  subject: ticket.subject,
  description: ticket.description,
  orderId: ticket.orderId,
  resolvedAt: ticket.resolvedAt,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  merchant: ticket.merchant
    ? { id: ticket.merchant.id, name: ticket.merchant.name }
    : null,
  createdBy: ticket.createdBy,
  assignedStaff: ticket.assignedStaff,
  messages: ticket.messages.map((message: any) => ({
    id: message.id,
    message: message.message,
    attachmentUrl: message.attachmentUrl,
    createdAt: message.createdAt,
    sender: message.sender,
  })),
});

async function getTicketOrThrow(id: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: ticketInclude,
  });

  if (!ticket) throw new AppError(404, "Không tìm thấy yêu cầu hỗ trợ");
  return ticket;
}

function assertMerchantAccess(ticket: { merchantId: string }, merchantId: string) {
  if (ticket.merchantId !== merchantId) {
    throw new AppError(403, "Bạn không có quyền truy cập yêu cầu này");
  }
}

async function notifyMerchant(
  merchantUserId: string,
  ticketId: string,
  title: string,
  message: string,
) {
  return createNotification({
    userId: merchantUserId,
    type: NotificationType.System,
    title,
    message,
    referenceId: ticketId,
    referenceType: "SupportTicket",
  });
}

export const createTicket = async (
  merchantId: string,
  userId: string,
  input: CreateSupportTicketInput,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, name: true },
  });

  if (!merchant) throw new AppError(404, "Không tìm thấy Merchant");

  const ticket = await prisma.supportTicket.create({
    data: {
      merchantId,
      createdByUserId: userId,
      category: input.category,
      priority: input.priority,
      subject: input.subject.trim(),
      description: input.description.trim(),
      orderId: input.orderId?.trim() || null,
    },
    include: ticketInclude,
  });

  await notifyActiveUsersByRoles([UserRole.Staff, UserRole.Admin], {
    type: NotificationType.System,
    title: "Có yêu cầu hỗ trợ Merchant mới",
    message: `${merchant.name}: ${ticket.subject}`,
    referenceId: ticket.id,
    referenceType: "SupportTicket",
  });

  return mapTicket(ticket);
};

export const getMerchantTickets = async (
  merchantId: string,
  query: SupportTicketListQuery,
) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { merchantId, status: query.status },
    include: ticketInclude,
    orderBy: { updatedAt: "desc" },
  });

  return tickets.map(mapTicket);
};

export const getMerchantTicket = async (merchantId: string, id: string) => {
  const ticket = await getTicketOrThrow(id);
  assertMerchantAccess(ticket, merchantId);
  return mapTicket(ticket);
};

export const getStaffTickets = async (query: SupportTicketListQuery) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { status: query.status },
    include: ticketInclude,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  return tickets.map(mapTicket);
};

export const getStaffTicket = async (id: string) =>
  mapTicket(await getTicketOrThrow(id));

export const addMerchantMessage = async (
  merchantId: string,
  userId: string,
  id: string,
  input: CreateSupportMessageInput,
) => {
  const ticket = await getTicketOrThrow(id);
  assertMerchantAccess(ticket, merchantId);

  if (ticket.status === SupportTicketStatus.Closed) {
    throw new AppError(409, "Yêu cầu đã đóng, không thể gửi thêm phản hồi");
  }

  await prisma.supportMessage.create({
    data: {
      ticketId: id,
      senderUserId: userId,
      message: input.message.trim(),
      attachmentUrl: input.attachmentUrl ?? null,
    },
  });

  await prisma.supportTicket.update({
    where: { id },
    data: { status: SupportTicketStatus.InProgress },
  });

  if (ticket.assignedStaff?.id) {
    await createNotification({
      userId: ticket.assignedStaff.id,
      type: NotificationType.System,
      title: "Merchant đã phản hồi yêu cầu hỗ trợ",
      message: ticket.subject,
      referenceId: id,
      referenceType: "SupportTicket",
    });
  }

  return getMerchantTicket(merchantId, id);
};

export const addStaffMessage = async (
  staffUserId: string,
  id: string,
  input: CreateSupportMessageInput,
) => {
  const ticket = await getTicketOrThrow(id);

  await prisma.supportMessage.create({
    data: {
      ticketId: id,
      senderUserId: staffUserId,
      message: input.message.trim(),
      attachmentUrl: input.attachmentUrl ?? null,
    },
  });

  await prisma.supportTicket.update({
    where: { id },
    data: {
      status: SupportTicketStatus.WaitingForMerchant,
      assignedStaffId: staffUserId,
    },
  });

  await notifyMerchant(
    ticket.merchant.userId,
    id,
    "Staff đã phản hồi yêu cầu hỗ trợ",
    ticket.subject,
  );

  return getStaffTicket(id);
};

export const updateMerchantStatus = async (
  merchantId: string,
  id: string,
  input: UpdateSupportTicketStatusInput,
) => {
  const ticket = await getTicketOrThrow(id);
  assertMerchantAccess(ticket, merchantId);

  if (
    input.status !== SupportTicketStatus.Open &&
    input.status !== SupportTicketStatus.Resolved
  ) {
    throw new AppError(400, "Merchant chỉ được mở lại hoặc xác nhận đã xử lý");
  }

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      status: input.status,
      resolvedAt:
        input.status === SupportTicketStatus.Resolved ? new Date() : null,
    },
    include: ticketInclude,
  });

  return mapTicket(updated);
};

export const updateStaffStatus = async (
  staffUserId: string,
  id: string,
  input: UpdateSupportTicketStatusInput,
) => {
  const ticket = await getTicketOrThrow(id);
  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      status: input.status,
      assignedStaffId: ticket.assignedStaff?.id ?? staffUserId,
      resolvedAt:
        input.status === SupportTicketStatus.Resolved ||
        input.status === SupportTicketStatus.Closed
          ? new Date()
          : null,
    },
    include: ticketInclude,
  });

  await notifyMerchant(
    ticket.merchant.userId,
    id,
    "Trạng thái yêu cầu hỗ trợ đã cập nhật",
    `${ticket.subject}: ${input.status}`,
  );

  return mapTicket(updated);
};

export const assignStaff = async (staffUserId: string, id: string) => {
  const ticket = await getTicketOrThrow(id);
  const updated = await prisma.supportTicket.update({
    where: { id },
    data: { assignedStaffId: staffUserId, status: SupportTicketStatus.InProgress },
    include: ticketInclude,
  });

  await notifyMerchant(
    ticket.merchant.userId,
    id,
    "Yêu cầu hỗ trợ đã được tiếp nhận",
    ticket.subject,
  );

  return mapTicket(updated);
};
