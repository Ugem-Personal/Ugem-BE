import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import {
  addWishlist,
  addWishlistByParam,
  checkWishlist,
  getMyWishlists,
  removeWishlist,
} from "./wishlist.controller.js";

import {
  addWishlistBodySchema,
  merchantWishlistParamSchema,
} from "./wishlist.schema.js";

export const wishlistRouter = Router();

wishlistRouter.use(authenticate, authorizeRoles("Customer", "Reviewer"));

/*
 * Route đúng với FE hiện tại.
 */
wishlistRouter.get("/", getMyWishlists);

wishlistRouter.post("/", validate(addWishlistBodySchema), addWishlist);

/*
 * Route cũ được giữ để tương thích.
 */
wishlistRouter.get("/mine", getMyWishlists);

wishlistRouter.post(
  "/:merchantId",
  validate(merchantWishlistParamSchema),
  addWishlistByParam,
);

wishlistRouter.get(
  "/:merchantId/check",
  validate(merchantWishlistParamSchema),
  checkWishlist,
);

wishlistRouter.delete(
  "/:merchantId",
  validate(merchantWishlistParamSchema),
  removeWishlist,
);
