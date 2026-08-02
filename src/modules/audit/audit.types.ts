import type { Prisma, UserRole } from "../../generated/prisma/client.js";

export type AuditActor = {
  userId: string;
  role: UserRole;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CreateAuditLogInput = {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type AuditLogListQuery = {
  search?: string;
  action?: string;
  entityType?: string;
  pageIndex: number;
  pageSize: number;
};
