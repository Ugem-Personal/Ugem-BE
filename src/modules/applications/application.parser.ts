import type {
  ApplicationMenuInput,
  CreateApplicationInput,
} from "./application.types.js";

type FormDataBody = Record<string, unknown>;

const toStringValue = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const toOptionalNumber = (value: unknown): number | null => {
  const stringValue = toStringValue(value);

  if (!stringValue) {
    return null;
  }

  const numberValue = Number(stringValue);

  return Number.isFinite(numberValue) ? numberValue : Number.NaN;
};

export const parseApplicationFormData = (
  body: FormDataBody,
): CreateApplicationInput => {
  const menuMap = new Map<number, Partial<ApplicationMenuInput>>();

  for (const [key, value] of Object.entries(body)) {
    const match = key.match(
      /^Menu\[(\d+)]\.(Name|Description|Price|ImageUrl|Category|Cuisine)$/i,
    );

    if (!match) {
      continue;
    }

    const index = Number(match[1]);
    const fieldName = match[2]?.toLowerCase();

    const menuItem = menuMap.get(index) ?? {};

    switch (fieldName) {
      case "name":
        menuItem.name = toStringValue(value);
        break;

      case "description":
        menuItem.description = toStringValue(value) || null;
        break;

      case "price":
        menuItem.price = Number(toStringValue(value));
        break;

      case "imageurl":
        menuItem.imageUrl = toStringValue(value) || null;
        break;

      case "category":
        menuItem.category = toStringValue(value);
        break;

      case "cuisine":
        menuItem.cuisine = toStringValue(value) || null;
        break;
    }

    menuMap.set(index, menuItem);
  }

  const menu = Array.from(menuMap.entries())
    .sort(([firstIndex], [secondIndex]) => {
      return firstIndex - secondIndex;
    })
    .map(([, item]) => {
      return item as ApplicationMenuInput;
    });

  return {
    name: toStringValue(body.Name ?? body.name),

    description: toStringValue(body.Description ?? body.description) || null,

    restaurantType: toStringValue(body.RestaurantType ?? body.restaurantType),

    mainDishType: toStringValue(body.MainDishType ?? body.mainDishType),

    priceRange: toStringValue(body.PriceRange ?? body.priceRange),

    email: toStringValue(body.Email ?? body.email),

    phone: toStringValue(body.Phone ?? body.phone),

    logoUrl: toStringValue(body.LogoUrl ?? body.logoUrl) || null,

    openingHours: toStringValue(body.OpeningHours ?? body.openingHours),

    address: toStringValue(body.Address ?? body.address),

    latitude: toOptionalNumber(body.Latitude ?? body.latitude),

    longitude: toOptionalNumber(body.Longitude ?? body.longitude),

    menu,
  };
};
