import { ApplicationStatus, NotificationType, ReviewerApplicationStatus, UserRole, } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
const ensureNotification = async (input) => {
    const existing = await prisma.notification.findFirst({
        where: {
            userId: input.userId,
            referenceId: input.referenceId,
            referenceType: input.referenceType,
            title: input.title,
        },
        select: { id: true },
    });
    if (existing)
        return false;
    await prisma.notification.create({ data: input });
    return true;
};
let inserted = 0;
const applications = await prisma.application.findMany({
    where: {
        status: { in: [ApplicationStatus.Accepted, ApplicationStatus.Rejected] },
    },
});
for (const application of applications) {
    const accepted = application.status === ApplicationStatus.Accepted;
    inserted += Number(await ensureNotification({
        userId: application.applicantUserId,
        type: NotificationType.Application,
        title: accepted
            ? "Hồ sơ đăng ký quán đã được duyệt"
            : "Hồ sơ đăng ký quán bị từ chối",
        message: accepted
            ? `Chúc mừng! Hồ sơ ${application.name} đã được duyệt và quán đã được kích hoạt.`
            : `Hồ sơ ${application.name} bị từ chối. Lý do: ${application.rejectionReason ?? "Hồ sơ không đạt yêu cầu"}`,
        referenceId: application.id,
        referenceType: "Application",
    }));
}
const reviewerApplications = await prisma.reviewerApplication.findMany({
    where: {
        status: {
            in: [
                ReviewerApplicationStatus.Accepted,
                ReviewerApplicationStatus.Rejected,
            ],
        },
    },
    include: { customer: { select: { userId: true } } },
});
for (const application of reviewerApplications) {
    const accepted = application.status === ReviewerApplicationStatus.Accepted;
    inserted += Number(await ensureNotification({
        userId: application.customer.userId,
        type: NotificationType.Application,
        title: accepted
            ? "Đơn đăng ký Reviewer đã được chấp thuận"
            : "Đơn đăng ký Reviewer bị từ chối",
        message: accepted
            ? "Chúc mừng! Tài khoản của bạn đã được nâng cấp thành Reviewer."
            : `Đơn đăng ký Reviewer bị từ chối. Lý do: ${application.rejectionReason ?? "Không đạt yêu cầu"}`,
        referenceId: application.id,
        referenceType: "ReviewerApplication",
    }));
}
const reviews = await prisma.review.findMany({
    include: {
        merchant: { select: { userId: true, name: true } },
    },
});
for (const review of reviews) {
    inserted += Number(await ensureNotification({
        userId: review.merchant.userId,
        type: NotificationType.Review,
        title: "Quán vừa nhận được đánh giá mới",
        message: `Khách hàng đã đánh giá ${review.merchant.name} ${review.rating}/5 sao.`,
        referenceId: review.id,
        referenceType: "Review",
    }));
}
const staffUsers = await prisma.user.findMany({
    where: { role: UserRole.Staff },
    select: { id: true },
});
for (const staff of staffUsers) {
    inserted += Number(await ensureNotification({
        userId: staff.id,
        type: NotificationType.System,
        title: "Tài khoản Staff đã được tạo",
        message: "Tài khoản Staff của bạn đã được kích hoạt.",
        referenceId: staff.id,
        referenceType: "Staff",
    }));
}
console.log(`Đã bổ sung ${inserted} notification lịch sử.`);
await prisma.$disconnect();
