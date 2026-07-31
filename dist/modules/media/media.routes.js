import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.middleware.js";
import { uploadImageMiddleware } from "./media.middleware.js";
import { uploadImage } from "./media.controller.js";
export const mediaRouter = Router();
mediaRouter.post("/images", authenticate, uploadImageMiddleware, uploadImage);
