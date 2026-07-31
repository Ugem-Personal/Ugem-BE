import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.middleware.js";
import { requireApprovedMerchant } from "../../common/middleware/merchant.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";
import { createTopping, deleteTopping, getMyFoodToppings, getToppingsByFood, updateTopping, updateToppingByBody, } from "./food-topping.controller.js";
import { createFoodToppingSchema, foodIdParamSchema, foodToppingIdSchema, updateFoodToppingByBodySchema, updateFoodToppingSchema, } from "./food-topping.schema.js";
export const foodToppingRouter = Router();
foodToppingRouter.get("/food/:foodId/manage", authenticate, requireApprovedMerchant, validate(foodIdParamSchema), getMyFoodToppings);
/*
 * URL FE hiện đang gọi.
 */
foodToppingRouter.get("/:foodId/toppings", validate(foodIdParamSchema), getToppingsByFood);
/*
 * Giữ URL BE cũ.
 */
foodToppingRouter.get("/food/:foodId", validate(foodIdParamSchema), getToppingsByFood);
foodToppingRouter.post("/", authenticate, requireApprovedMerchant, validate(createFoodToppingSchema), createTopping);
/*
 * URL FE hiện đang gọi.
 */
foodToppingRouter.put("/", authenticate, requireApprovedMerchant, validate(updateFoodToppingByBodySchema), updateToppingByBody);
/*
 * Giữ URL chuẩn REST cũ.
 */
foodToppingRouter.put("/:id", authenticate, requireApprovedMerchant, validate(updateFoodToppingSchema), updateTopping);
foodToppingRouter.delete("/:id", authenticate, requireApprovedMerchant, validate(foodToppingIdSchema), deleteTopping);
