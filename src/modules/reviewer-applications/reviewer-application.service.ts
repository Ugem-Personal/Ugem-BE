import {
  ReviewerApplicationStatus,
  UserRole,
  Prisma,
  NotificationType,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
  CreateReviewerApplicationInput,
  ReviewerApplicationListQuery,
  ReviewReviewerApplicationInput,
  UpdateReviewerApplicationInput,
} from "./reviewer-application.types.js";
import {
  createNotification,
  notifyActiveUsersByRoles,
} from "../notifications/notification.service.js";

const applicationInclude = {
  customer: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  },
};

const mapApplication = (application: any) => ({
  id: application.id,
  customerId: application.customerId,
  status: application.status,

  motivation: application.motivation,
  experience: application.experience,

  facebookUrl: application.facebookUrl,
  instagramUrl: application.instagramUrl,
  tiktokUrl: application.tiktokUrl,
  youtubeUrl: application.youtubeUrl,
  otherSocialUrl: application.otherSocialUrl,

  rejectionReason: application.rejectionReason,
  reviewedById: application.reviewedById,
  reviewedAt: application.reviewedAt,

  customer: application.customer
    ? {
        id: application.customer.id,
        userId: application.customer.user.id,
        email: application.customer.user.email,
        fullName: application.customer.user.fullName,
        phoneNumber: application.customer.user.phoneNumber,
        avatarUrl: application.customer.user.avatarUrl,
        role: application.customer.user.role,
      }
    : null,

  createdAt: application.createdAt,
  updatedAt: application.updatedAt,
});

export const createReviewerApplication = async (
  customerId: string,
  input: CreateReviewerApplicationInput,
) => {
  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId,
    },
    include: {
      user: true,
    },
  });

  if (!customer) {
    throw new AppError(404, "Không tìm thấy Customer");
  }

  if (customer.user.role === UserRole.Reviewer) {
    throw new AppError(409, "Tài khoản đã là Reviewer");
  }

  const existing = await prisma.reviewerApplication.findFirst({
    where: {
      customerId,
      status: {
        in: [
          ReviewerApplicationStatus.Pending,
          ReviewerApplicationStatus.Accepted,
        ],
      },
    },
  });

  if (existing?.status === ReviewerApplicationStatus.Pending) {
    throw new AppError(409, "Bạn đang có đơn đăng ký chờ xét duyệt");
  }

  if (existing?.status === ReviewerApplicationStatus.Accepted) {
    throw new AppError(409, "Đơn đăng ký Reviewer đã được chấp thuận");
  }

  const application = await prisma.reviewerApplication.create({
    data: {
      customerId,

      motivation: input.motivation.trim(),

      experience: input.experience?.trim() || null,

      facebookUrl: input.facebookUrl?.trim() || null,

      instagramUrl: input.instagramUrl?.trim() || null,

      tiktokUrl: input.tiktokUrl?.trim() || null,

      youtubeUrl: input.youtubeUrl?.trim() || null,

      otherSocialUrl: input.otherSocialUrl?.trim() || null,
    },

    include: applicationInclude,
  });

  await notifyActiveUsersByRoles([UserRole.Staff, UserRole.Admin], {
    type: NotificationType.Application,
    title: "Có đơn đăng ký Reviewer mới",
    message: `${customer.user.fullName} vừa gửi đơn đăng ký Reviewer.`,
    referenceId: application.id,
    referenceType: "ReviewerApplication",
  });

  return mapApplication(application);
};

export const getMyReviewerApplication = async (customerId: string) => {
  const application = await prisma.reviewerApplication.findFirst({
    where: {
      customerId,
    },

    include: applicationInclude,

    orderBy: {
      createdAt: "desc",
    },
  });

  return application ? mapApplication(application) : null;
};

export const getReviewerApplications = async (
  query: ReviewerApplicationListQuery,
) => {
  const pageIndex = query.pageIndex || 1;
  const pageSize = query.pageSize || 10;

  const where: Prisma.ReviewerApplicationWhereInput = {
    status: query.status
      ? (query.status as ReviewerApplicationStatus)
      : undefined,
  };

  const [applications, totalItems] = await prisma.$transaction([
    prisma.reviewerApplication.findMany({
      where,
      include: applicationInclude,
      orderBy: {
        createdAt: "desc",
      },
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
    }),

    prisma.reviewerApplication.count({
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

export const reviewReviewerApplication = async (
  applicationId: string,
  reviewerUserId: string,
  input: ReviewReviewerApplicationInput,
) => {
  const application = await prisma.reviewerApplication.findUnique({
    where: {
      id: applicationId,
    },

    include: {
      customer: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!application) {
    throw new AppError(404, "Không tìm thấy đơn đăng ký Reviewer");
  }

  if (application.status !== ReviewerApplicationStatus.Pending) {
    throw new AppError(409, "Chỉ có thể duyệt đơn đang ở trạng thái Pending");
  }

  if (input.status === "Rejected") {
    const rejected = await prisma.reviewerApplication.update({
      where: {
        id: applicationId,
      },

      data: {
        status: ReviewerApplicationStatus.Rejected,

        rejectionReason:
          input.rejectionReason?.trim() || "Đơn đăng ký không đạt yêu cầu",

        reviewedById: reviewerUserId,
        reviewedAt: new Date(),
      },

      include: applicationInclude,
    });

    await createNotification({
      userId: application.customer.userId,

      type: NotificationType.Application,

      title: "Đơn đăng ký Reviewer bị từ chối",

      message: `Đơn đăng ký Reviewer của bạn đã bị từ chối. Lý do: ${
        rejected.rejectionReason ?? "Không đạt yêu cầu"
      }`,

      referenceId: rejected.id,

      referenceType: "ReviewerApplication",
    });

    return mapApplication(rejected);
  }

  const accepted = await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: {
        id: application.customer.userId,
      },

      data: {
        role: UserRole.Reviewer,
      },
    });

    return transaction.reviewerApplication.update({
      where: {
        id: applicationId,
      },

      data: {
        status: ReviewerApplicationStatus.Accepted,

        rejectionReason: null,
        reviewedById: reviewerUserId,
        reviewedAt: new Date(),
      },

      include: applicationInclude,
    });
  });

  await createNotification({
    userId: application.customer.userId,

    type: NotificationType.Application,

    title: "Đơn đăng ký Reviewer đã được chấp thuận",

    message: "Chúc mừng! Tài khoản của bạn đã được nâng cấp thành Reviewer.",

    referenceId: accepted.id,

    referenceType: "ReviewerApplication",
  });

  return mapApplication(accepted);
};

export const updateReviewerApplication = async (
  customerId: string,
  input: UpdateReviewerApplicationInput,
) => {
  const application = await prisma.reviewerApplication.findFirst({
    where: {
      id: input.reviewerApplicationId,
      customerId,
    },
  });

  if (!application) {
    throw new AppError(404, "Không tìm thấy đơn đăng ký Reviewer");
  }

  if (application.status !== ReviewerApplicationStatus.Pending) {
    throw new AppError(409, "Chỉ có thể cập nhật đơn đang chờ xét duyệt");
  }

  const updated = await prisma.reviewerApplication.update({
    where: {
      id: application.id,
    },

    data: {
      motivation:
        input.motivation !== undefined ? input.motivation.trim() : undefined,

      experience:
        input.experience !== undefined
          ? input.experience?.trim() || null
          : undefined,

      facebookUrl:
        input.facebookUrl !== undefined
          ? input.facebookUrl?.trim() || null
          : undefined,

      instagramUrl:
        input.instagramUrl !== undefined
          ? input.instagramUrl?.trim() || null
          : undefined,

      tiktokUrl:
        input.tiktokUrl !== undefined
          ? input.tiktokUrl?.trim() || null
          : undefined,

      youtubeUrl:
        input.youtubeUrl !== undefined
          ? input.youtubeUrl?.trim() || null
          : undefined,

      otherSocialUrl:
        input.otherSocialUrl !== undefined
          ? input.otherSocialUrl?.trim() || null
          : undefined,
    },

    include: applicationInclude,
  });

  return mapApplication(updated);
};
