import { z } from "zod";
export const merchantIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Merchant ID không hợp lệ"),
    }),
});
export const merchantListSchema = z.object({
    query: z
        .object({
        /*
         * Tên query BE cũ.
         */
        search: z.string().trim().optional(),
        categoryId: z.string().uuid("Category ID không hợp lệ").optional(),
        restaurantType: z.string().trim().optional(),
        mainDishType: z.string().trim().optional(),
        priceRange: z.string().trim().optional(),
        latitude: z.coerce.number().min(-90).max(90).optional(),
        longitude: z.coerce.number().min(-180).max(180).optional(),
        radiusKm: z.coerce.number().positive().max(100).optional(),
        pageIndex: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
        /*
         * Tên query FE hiện tại.
         */
        SearchTerm: z.string().trim().optional(),
        CategoryId: z.string().uuid("Category ID không hợp lệ").optional(),
        RestaurantType: z.string().trim().optional(),
        MainDishType: z.string().trim().optional(),
        PriceRange: z.string().trim().optional(),
        Latitude: z.coerce.number().min(-90).max(90).optional(),
        Longitude: z.coerce.number().min(-180).max(180).optional(),
        RadiusKm: z.coerce.number().positive().max(100).optional(),
        PageIndex: z.coerce.number().int().min(1).optional(),
        PageSize: z.coerce.number().int().min(1).max(100).optional(),
    })
        .transform((query) => ({
        search: query.search ?? query.SearchTerm,
        categoryId: query.categoryId ?? query.CategoryId,
        restaurantType: query.restaurantType ?? query.RestaurantType,
        mainDishType: query.mainDishType ?? query.MainDishType,
        priceRange: query.priceRange ?? query.PriceRange,
        latitude: query.latitude ?? query.Latitude,
        longitude: query.longitude ?? query.Longitude,
        radiusKm: query.radiusKm ?? query.RadiusKm,
        pageIndex: query.pageIndex ?? query.PageIndex ?? 1,
        pageSize: query.pageSize ?? query.PageSize ?? 10,
    })),
});
export const updateMerchantSchema = z.object({
    body: z
        .object({
        name: z.string().trim().min(2).max(200).optional(),
        merchantName: z.string().trim().min(2).max(200).optional(),
        description: z
            .union([z.string().trim().max(3000), z.literal(""), z.null()])
            .optional(),
        merchantDescription: z
            .union([z.string().trim().max(3000), z.literal(""), z.null()])
            .optional(),
        restaurantType: z.string().trim().min(1).max(100).optional(),
        mainDishType: z.string().trim().min(1).max(100).optional(),
        priceRange: z.string().trim().min(1).max(100).optional(),
        email: z.string().trim().email("Email không hợp lệ").optional(),
        phone: z
            .string()
            .trim()
            .regex(/^[0-9+()\-\s]{8,20}$/, "Số điện thoại không hợp lệ")
            .optional(),
        address: z.string().trim().min(5).max(500).optional(),
        openingHours: z.string().trim().min(1).max(300).optional(),
        latitude: z
            .union([z.coerce.number().min(-90).max(90), z.literal(""), z.null()])
            .optional(),
        longitude: z
            .union([z.coerce.number().min(-180).max(180), z.literal(""), z.null()])
            .optional(),
        logoUrl: z
            .union([z.string().trim().url(), z.literal(""), z.null()])
            .optional(),
    })
        .refine((body) => Object.keys(body).length > 0, {
        message: "Phải cung cấp ít nhất một trường để cập nhật",
    })
        .transform((body) => ({
        ...body,
        name: body.name ?? body.merchantName,
        description: body.description !== undefined
            ? body.description
            : body.merchantDescription,
    })),
});
export const staffMerchantListSchema = z.object({
    query: z.object({
        searchTerm: z.string().trim().max(200).optional(),
        pageIndex: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(10),
    }),
});
export const merchantsByCategorySchema = z.object({
    query: z
        .object({
        categoryId: z.string().uuid("Category ID không hợp lệ").optional(),
        CategoryId: z.string().uuid("Category ID không hợp lệ").optional(),
        search: z.string().trim().optional(),
        SearchTerm: z.string().trim().optional(),
        latitude: z.coerce.number().min(-90).max(90).optional(),
        Latitude: z.coerce.number().min(-90).max(90).optional(),
        longitude: z.coerce.number().min(-180).max(180).optional(),
        Longitude: z.coerce.number().min(-180).max(180).optional(),
        radiusKm: z.coerce.number().positive().max(100).optional(),
        RadiusKm: z.coerce.number().positive().max(100).optional(),
        pageIndex: z.coerce.number().int().min(1).optional(),
        PageIndex: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
        PageSize: z.coerce.number().int().min(1).max(100).optional(),
    })
        .superRefine((query, context) => {
        if (!query.categoryId && !query.CategoryId) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["CategoryId"],
                message: "Category ID không được để trống",
            });
        }
    })
        .transform((query) => ({
        categoryId: query.categoryId ?? query.CategoryId,
        search: query.search ?? query.SearchTerm,
        latitude: query.latitude ?? query.Latitude,
        longitude: query.longitude ?? query.Longitude,
        radiusKm: query.radiusKm ?? query.RadiusKm,
        pageIndex: query.pageIndex ?? query.PageIndex ?? 1,
        pageSize: query.pageSize ?? query.PageSize ?? 10,
    })),
});
export const merchantMapSchema = z.object({
    query: z
        .object({
        minLongitude: z.coerce.number().min(-180).max(180).optional(),
        maxLongitude: z.coerce.number().min(-180).max(180).optional(),
        minLatitude: z.coerce.number().min(-90).max(90).optional(),
        maxLatitude: z.coerce.number().min(-90).max(90).optional(),
        zoomLevel: z.coerce.number().min(0).max(25).optional(),
        MinLongitude: z.coerce.number().min(-180).max(180).optional(),
        MaxLongitude: z.coerce.number().min(-180).max(180).optional(),
        MinLatitude: z.coerce.number().min(-90).max(90).optional(),
        MaxLatitude: z.coerce.number().min(-90).max(90).optional(),
        ZoomLevel: z.coerce.number().min(0).max(25).optional(),
    })
        .transform((query) => ({
        minLongitude: query.minLongitude ?? query.MinLongitude ?? -180,
        maxLongitude: query.maxLongitude ?? query.MaxLongitude ?? 180,
        minLatitude: query.minLatitude ?? query.MinLatitude ?? -90,
        maxLatitude: query.maxLatitude ?? query.MaxLatitude ?? 90,
        zoomLevel: query.zoomLevel ?? query.ZoomLevel ?? 20,
    }))
        .superRefine((query, context) => {
        if (query.minLongitude > query.maxLongitude) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["MinLongitude"],
                message: "MinLongitude không được lớn hơn MaxLongitude",
            });
        }
        if (query.minLatitude > query.maxLatitude) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["MinLatitude"],
                message: "MinLatitude không được lớn hơn MaxLatitude",
            });
        }
    }),
});
