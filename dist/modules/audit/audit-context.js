import { AppError } from "../../common/errors/app-error.js";
export const getAuditActor = (req) => {
    if (!req.user?.UserId || !req.user.Role) {
        throw new AppError(401, "Không xác định được người thực hiện");
    }
    return {
        userId: req.user.UserId,
        role: req.user.Role,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || null,
    };
};
