import { prisma } from "../../config/prisma.js";
import { recommendationCache } from "../../common/services/recommendation-cache.js";
const customerSelect = {
    id: true,
    user: {
        select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            role: true,
            avatarUrl: true,
            isActive: true,
        },
    },
};
const mapCustomerSearchResult = (customer) => {
    return {
        userId: customer.user.id,
        customerId: customer.id,
        fullName: customer.user.fullName,
        email: customer.user.email,
        phoneNumber: customer.user.phoneNumber,
        role: customer.user.role,
        avatarUrl: customer.user.avatarUrl,
    };
};
export const searchCustomersByEmail = async (query) => {
    const normalizedEmail = query.email.trim().toLowerCase();
    const customers = await prisma.customer.findMany({
        where: {
            user: {
                isActive: true,
                role: {
                    in: ["Customer", "Reviewer"],
                },
                email: {
                    contains: normalizedEmail,
                    mode: "insensitive",
                },
            },
        },
        select: customerSelect,
        orderBy: {
            user: {
                email: "asc",
            },
        },
        take: query.limit,
    });
    return customers.map(mapCustomerSearchResult);
};
const normalizePhoneNumber = (phoneNumber) => {
    return phoneNumber.replace(/[\s().-]/g, "");
};
export const searchCustomersByPhoneNumber = async (query) => {
    const normalizedPhoneNumber = normalizePhoneNumber(query.phoneNumber.trim());
    const candidates = await prisma.customer.findMany({
        where: {
            user: {
                isActive: true,
                role: {
                    in: ["Customer", "Reviewer"],
                },
                phoneNumber: {
                    not: null,
                },
            },
        },
        select: customerSelect,
        orderBy: {
            user: {
                phoneNumber: "asc",
            },
        },
        take: Math.max(query.limit * 10, 100),
    });
    return candidates
        .filter((customer) => {
        const phoneNumber = customer.user.phoneNumber;
        if (!phoneNumber) {
            return false;
        }
        return normalizePhoneNumber(phoneNumber).includes(normalizedPhoneNumber);
    })
        .slice(0, query.limit)
        .map(mapCustomerSearchResult);
};
export const getCustomerPreferences = async (customerId) => {
    return prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            preferredRestaurantTypes: true,
            preferredMainDishTypes: true,
            preferredPriceRanges: true,
        },
    });
};
export const updateCustomerPreferences = async (customerId, input) => {
    const preferences = await prisma.customer.update({
        where: {
            id: customerId,
        },
        data: {
            preferredRestaurantTypes: input.preferredRestaurantTypes,
            preferredMainDishTypes: input.preferredMainDishTypes,
            preferredPriceRanges: input.preferredPriceRanges,
        },
        select: {
            preferredRestaurantTypes: true,
            preferredMainDishTypes: true,
            preferredPriceRanges: true,
        },
    });
    recommendationCache.invalidateCustomer(customerId);
    return preferences;
};
