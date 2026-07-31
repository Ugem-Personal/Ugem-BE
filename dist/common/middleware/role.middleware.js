import { AppError } from "../errors/app-error.js";
export const authorizeRoles = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new AppError(401, "Bạn chưa đăng nhập"));
        }
        const currentRole = req.user.Role;
        /*
         * Reviewer được dùng các chức năng của Customer.
         */
        const normalizedAllowedRoles = allowedRoles.includes("Customer")
            ? [...allowedRoles, "Reviewer"]
            : allowedRoles;
        if (!normalizedAllowedRoles.includes(currentRole)) {
            return next(new AppError(403, "Bạn không có quyền thực hiện chức năng này"));
        }
        return next();
    };
};
