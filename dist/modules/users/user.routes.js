import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";
import { getProfile, updateProfile } from "./user.controller.js";
import { updateProfileSchema } from "./user.schema.js";
export const userRouter = Router();
userRouter.use(authenticate);
userRouter.get("/profile", getProfile);
userRouter.patch("/profile", validate(updateProfileSchema), updateProfile);
// Giữ lại để tương thích với client cũ.
userRouter.put("/profile", validate(updateProfileSchema), updateProfile);
