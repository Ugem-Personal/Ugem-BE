import {
  ApplicationStatus,
  ApplicationType,
  NotificationType,
  Prisma,
  UserRole,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
  CreateApplicationInput,
  ListApplicationsQuery,
  ReviewApplicationInput,
  UpdateApplicationInput,
} from "./application.types.js";
import { importApplicationMenusAsFoods } from "./application-menu-import.js";
import {
  createNotification,
  notifyActiveUsersByRoles,
} from "../notifications/notification.service.js";

const applicationInclude = {
  menus: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  applicant: {
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      avatarUrl: true,
      role: true,
    },
  },
};

const mapApplication = (application: any) => {
  return {
    id: application.id,
    applicantUserId: application.applicantUserId,
    type: application.type,
    status: application.status,

    name: application.name,
    description: application.description,
    restaurantType: application.restaurantType,
    mainDishType: application.mainDishType,
    priceRange: application.priceRange,
    email: application.email,
    phone: application.phone,
    logoUrl: application.logoUrl,
    openingHours: application.openingHours,
    address: application.address,

    latitude:
      application.latitude !== null ? Number(application.latitude) : null,

    longitude:
      application.longitude !== null ? Number(application.longitude) : null,

    rejectionReason: application.rejectionReason,
    reviewedById: application.reviewedById,
    reviewedAt: application.reviewedAt,

    menu: application.menus.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      imageUrl: item.imageUrl,
      category: item.category,
      cuisine: item.cuisine,
    })),

    applicant: application.applicant,

    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
};

export const createApplication = async (
  userId: string,
  input: CreateApplicationInput,
) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(404, "Không tìm thấy tài khoản");
  }

  if (user.role !== UserRole.Merchant) {
    throw new AppError(403, "Chỉ tài khoản Merchant mới được gửi hồ sơ");
  }

  const activeApplication = await prisma.application.findFirst({
    where: {
      applicantUserId: userId,
      status: {
        in: [ApplicationStatus.Pending, ApplicationStatus.Accepted],
      },
    },
  });

  if (activeApplication) {
    if (activeApplication.status === ApplicationStatus.Accepted) {
      throw new AppError(409, "Tài khoản đã có hồ sơ được chấp thuận");
    }

    throw new AppError(409, "Bạn đang có một hồ sơ chờ xét duyệt");
  }

  const application = await prisma.application.create({
    data: {
      applicantUserId: userId,
      type: ApplicationType.Merchant,
      status: ApplicationStatus.Pending,

      name: input.name,
      description: input.description || null,
      restaurantType: input.restaurantType,
      mainDishType: input.mainDishType,
      priceRange: input.priceRange,
      email: input.email,
      phone: input.phone,
      logoUrl: input.logoUrl || null,
      openingHours: input.openingHours,
      address: input.address,

      latitude:
        input.latitude !== null && input.latitude !== undefined
          ? new Prisma.Decimal(input.latitude)
          : null,

      longitude:
        input.longitude !== null && input.longitude !== undefined
          ? new Prisma.Decimal(input.longitude)
          : null,

      menus: {
        create: input.menu.map((item) => ({
          name: item.name,
          description: item.description || null,
          price: new Prisma.Decimal(item.price),
          imageUrl: item.imageUrl || null,
          category: item.category,
          cuisine: item.cuisine || null,
        })),
      },
    },
    include: applicationInclude,
  });

  await notifyActiveUsersByRoles([UserRole.Staff, UserRole.Admin], {
    type: NotificationType.Application,
    title: "Có hồ sơ Merchant mới chờ duyệt",
    message: `${application.name} vừa gửi hồ sơ đăng ký quán.`,
    referenceId: application.id,
    referenceType: "Application",
  });

  return mapApplication(application);
};

export const getMyApplications = async (userId: string) => {
  const applications = await prisma.application.findMany({
    where: {
      applicantUserId: userId,
    },
    include: applicationInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  return applications.map(mapApplication);
};

export const getApplicationById = async (
  applicationId: string,
  requestingUser: {
    userId: string;
    role: string;
  },
) => {
  const application = await prisma.application.findUnique({
    where: {
      id: applicationId,
    },
    include: applicationInclude,
  });

  if (!application) {
    throw new AppError(404, "Không tìm thấy hồ sơ");
  }

  const isOwner = application.applicantUserId === requestingUser.userId;

  const isStaffOrAdmin = ["Staff", "Admin"].includes(requestingUser.role);

  if (!isOwner && !isStaffOrAdmin) {
    throw new AppError(403, "Bạn không có quyền xem hồ sơ này");
  }

  return mapApplication(application);
};

export const updateApplication = async (
  applicationId: string,
  userId: string,
  input: UpdateApplicationInput,
) => {
  const existing = await prisma.application.findUnique({
    where: {
      id: applicationId,
    },
  });

  if (!existing) {
    throw new AppError(404, "Không tìm thấy hồ sơ");
  }

  if (existing.applicantUserId !== userId) {
    throw new AppError(403, "Bạn không có quyền sửa hồ sơ này");
  }

  if (
    existing.status !== ApplicationStatus.Draft &&
    existing.status !== ApplicationStatus.Rejected
  ) {
    throw new AppError(409, "Chỉ có thể sửa hồ sơ Draft hoặc Rejected");
  }

  const application = await prisma.$transaction(async (transaction) => {
    await transaction.applicationMenu.deleteMany({
      where: {
        applicationId,
      },
    });

    return transaction.application.update({
      where: {
        id: applicationId,
      },
      data: {
        status: ApplicationStatus.Pending,

        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,

        name: input.name,
        description: input.description || null,
        restaurantType: input.restaurantType,
        mainDishType: input.mainDishType,
        priceRange: input.priceRange,
        email: input.email,
        phone: input.phone,
        logoUrl: input.logoUrl || null,
        openingHours: input.openingHours,
        address: input.address,

        latitude:
          input.latitude !== null && input.latitude !== undefined
            ? new Prisma.Decimal(input.latitude)
            : null,

        longitude:
          input.longitude !== null && input.longitude !== undefined
            ? new Prisma.Decimal(input.longitude)
            : null,

        menus: {
          create: input.menu.map((item) => ({
            name: item.name,
            description: item.description || null,
            price: new Prisma.Decimal(item.price),
            imageUrl: item.imageUrl || null,
            category: item.category,
            cuisine: item.cuisine || null,
          })),
        },
      },
      include: applicationInclude,
    });
  });

  await notifyActiveUsersByRoles([UserRole.Staff, UserRole.Admin], {
    type: NotificationType.Application,
    title: "Hồ sơ Merchant đã được gửi lại",
    message: `${application.name} đã bổ sung và gửi lại hồ sơ để xét duyệt.`,
    referenceId: application.id,
    referenceType: "Application",
  });

  return mapApplication(application);
};

export const getApplications = async (query: ListApplicationsQuery) => {
  const pageIndex = query.pageIndex || 1;
  const pageSize = query.pageSize || 10;

  const skip = (pageIndex - 1) * pageSize;

  const where: Prisma.ApplicationWhereInput = {
    status: query.status ? query.status : undefined,

    OR: query.search
      ? [
          {
            name: {
              contains: query.search,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: query.search,
              mode: "insensitive",
            },
          },
          {
            phone: {
              contains: query.search,
            },
          },
          {
            applicant: {
              fullName: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          },
        ]
      : undefined,
  };

  const [applications, totalItems] = await prisma.$transaction([
    prisma.application.findMany({
      where,
      include: applicationInclude,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: pageSize,
    }),

    prisma.application.count({
      where,
    }),
  ]);

  return {
    items: applications.map(mapApplication),

    totalItems,
    pageIndex,
    pageSize,
    totalPages: Math.ceil(totalItems / pageSize),
  };
};

export const reviewApplication = async (
  applicationId: string,
  reviewerUserId: string,
  input: ReviewApplicationInput,
) => {
  const application = await prisma.application.findUnique({
    where: {
      id: applicationId,
    },
    include: {
      applicant: {
        include: {
          merchant: true,
        },
      },
      menus: true,
    },
  });

  if (!application) {
    throw new AppError(404, "Không tìm thấy hồ sơ");
  }

  if (application.status !== ApplicationStatus.Pending) {
    throw new AppError(409, "Chỉ có thể duyệt hồ sơ đang ở trạng thái Pending");
  }

  if (input.status === "Rejected") {
    const rejectedApplication = await prisma.application.update({
      where: {
        id: applicationId,
      },
      data: {
        status: ApplicationStatus.Rejected,

        rejectionReason:
          input.rejectionReason?.trim() || "Hồ sơ không đạt yêu cầu",

        reviewedById: reviewerUserId,

        reviewedAt: new Date(),
      },
      include: applicationInclude,
    });

    await createNotification({
      userId: application.applicantUserId,
      type: NotificationType.Application,
      title: "Hồ sơ đăng ký quán bị từ chối",
      message: `Hồ sơ ${application.name} bị từ chối. Lý do: ${rejectedApplication.rejectionReason}`,
      referenceId: rejectedApplication.id,
      referenceType: "Application",
    });

    return mapApplication(rejectedApplication);
  }

  if (application.applicant.merchant) {
    throw new AppError(409, "Tài khoản này đã có Merchant");
  }

  const acceptedApplication = await prisma.$transaction(async (transaction) => {
    const merchant = await transaction.merchant.create({
      data: {
        userId: application.applicantUserId,

        name: application.name,

        description: application.description,

        restaurantType: application.restaurantType,

        mainDishType: application.mainDishType,

        priceRange: application.priceRange,

        email: application.email,

        phone: application.phone,

        address: application.address,

        openingHours: application.openingHours,

        latitude: application.latitude,

        longitude: application.longitude,

        logoUrl: application.logoUrl,

        status: "Active",
      },
    });

    await importApplicationMenusAsFoods(
      transaction,
      merchant.id,
      application.menus,
    );

    return transaction.application.update({
      where: {
        id: applicationId,
      },
      data: {
        status: ApplicationStatus.Accepted,

        rejectionReason: null,

        reviewedById: reviewerUserId,

        reviewedAt: new Date(),
      },
      include: applicationInclude,
    });
  });

  await createNotification({
    userId: application.applicantUserId,
    type: NotificationType.Application,
    title: "Hồ sơ đăng ký quán đã được duyệt",
    message: `Chúc mừng! Hồ sơ ${application.name} đã được duyệt và quán đã được kích hoạt.`,
    referenceId: acceptedApplication.id,
    referenceType: "Application",
  });

  return mapApplication(acceptedApplication);
};
