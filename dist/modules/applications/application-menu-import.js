const CATEGORY_ALIASES = {
    drink: "drink",
    drinks: "drink",
    beverage: "drink",
    beverages: "drink",
    "đồ uống": "drink",
    "main dish": "main-dish",
    "main course": "main-dish",
    "món chính": "main-dish",
    snack: "snack",
    snacks: "snack",
    "món ăn nhẹ": "snack",
    appetizer: "appetizer",
    appetizers: "appetizer",
    starter: "appetizer",
    starters: "appetizer",
    "món khai vị": "appetizer",
    dessert: "dessert",
    desserts: "dessert",
    "món tráng miệng": "dessert",
};
function normalizeCategoryName(value) {
    return value
        .trim()
        .replace(/\s*(?:[-–—]\s*)?(?:UAT|TEST)\s*$/i, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("vi");
}
function getCategoryKey(value) {
    const normalized = normalizeCategoryName(value);
    return CATEGORY_ALIASES[normalized] ?? normalized;
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export async function importApplicationMenusAsFoods(client, merchantId, menus) {
    if (menus.length === 0)
        return 0;
    const [categories, existingFoods] = await Promise.all([
        client.category.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        }),
        client.food.findMany({
            where: { merchantId },
            select: { name: true },
        }),
    ]);
    const categoryById = new Map(categories.map((item) => [item.id, item]));
    const categoryByKey = new Map(categories.map((item) => [getCategoryKey(item.name), item]));
    const existingFoodNames = new Set(existingFoods.map((food) => food.name.trim().toLocaleLowerCase("vi")));
    let importedCount = 0;
    for (const menu of menus) {
        const foodName = menu.name.trim();
        const normalizedFoodName = foodName.toLocaleLowerCase("vi");
        if (!foodName || existingFoodNames.has(normalizedFoodName))
            continue;
        const submittedCategory = menu.category.trim();
        let category = isUuid(submittedCategory)
            ? categoryById.get(submittedCategory)
            : categoryByKey.get(getCategoryKey(submittedCategory));
        if (!category) {
            category = await client.category.create({
                data: {
                    name: submittedCategory || "Món khác",
                    description: "Danh mục được tạo từ hồ sơ Merchant đã duyệt.",
                    isActive: true,
                },
                select: { id: true, name: true },
            });
            categoryById.set(category.id, category);
            categoryByKey.set(getCategoryKey(category.name), category);
        }
        await client.food.create({
            data: {
                merchantId,
                name: foodName,
                description: menu.description?.trim() || null,
                cuisine: menu.cuisine?.trim() || null,
                price: menu.price,
                imageUrl: menu.imageUrl?.trim() || null,
                isAvailable: true,
                categories: {
                    create: [{ categoryId: category.id }],
                },
            },
        });
        existingFoodNames.add(normalizedFoodName);
        importedCount += 1;
    }
    return importedCount;
}
