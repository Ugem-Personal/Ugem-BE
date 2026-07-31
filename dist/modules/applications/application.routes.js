import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";
import { createApplication, getApplicationById, getApplications, getMyApplications, reviewApplication, updateApplication, } from "./application.controller.js";
import { parseCreateApplication, validateJsonApplication, } from "./application.middleware.js";
import { applicationIdSchema, listApplicationsSchema, reviewApplicationSchema, } from "./application.schema.js";
export const applicationRouter = Router();
const formDataParser = multer({
    storage: multer.memoryStorage(),
    limits: {
        fields: 500,
        fieldSize: 1024 * 1024,
    },
});
applicationRouter.use(authenticate);
applicationRouter.post("/", authorizeRoles("Merchant"), formDataParser.none(), parseCreateApplication, createApplication);
applicationRouter.get("/mine", authorizeRoles("Merchant"), getMyApplications);
applicationRouter.get("/me", authorizeRoles("Merchant"), getMyApplications);
applicationRouter.get("/", authorizeRoles("Staff", "Admin"), validate(listApplicationsSchema), getApplications);
applicationRouter.patch("/:id/status", authorizeRoles("Staff", "Admin"), validate(reviewApplicationSchema), reviewApplication);
applicationRouter.get("/:id", validate(applicationIdSchema), getApplicationById);
applicationRouter.put("/:id", authorizeRoles("Merchant"), validate(applicationIdSchema), validateJsonApplication, updateApplication);
