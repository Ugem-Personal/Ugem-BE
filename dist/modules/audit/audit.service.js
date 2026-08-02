import { prisma } from "../../config/prisma.js";
export const createAuditLog = async (input) => {
    return prisma.auditLog.create({
        data: {
            actorUserId: input.actor.userId,
            actorRole: input.actor.role,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId || null,
            metadata: input.metadata,
            ipAddress: input.actor.ipAddress || null,
            userAgent: input.actor.userAgent || null,
        },
    });
};
export const getAuditLogs = async (query) => {
    const pageIndex = query.pageIndex || 1;
    const pageSize = query.pageSize || 20;
    const search = query.search?.trim();
    const where = {
        action: query.action || undefined,
        entityType: query.entityType || undefined,
        OR: search
            ? [
                { action: { contains: search, mode: "insensitive" } },
                { entityType: { contains: search, mode: "insensitive" } },
                { entityId: { contains: search, mode: "insensitive" } },
                {
                    actor: {
                        is: {
                            OR: [
                                { fullName: { contains: search, mode: "insensitive" } },
                                { email: { contains: search, mode: "insensitive" } },
                            ],
                        },
                    },
                },
            ]
            : undefined,
    };
    const [items, totalItems] = await prisma.$transaction(async (transaction) => {
        const items = await transaction.auditLog.findMany({
            where,
            select: {
                id: true,
                actorRole: true,
                action: true,
                entityType: true,
                entityId: true,
                metadata: true,
                ipAddress: true,
                userAgent: true,
                createdAt: true,
                actor: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (pageIndex - 1) * pageSize,
            take: pageSize,
        });
        const totalItems = await transaction.auditLog.count({ where });
        return [items, totalItems];
    });
    return {
        items,
        totalItems,
        pageIndex,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
    };
};
