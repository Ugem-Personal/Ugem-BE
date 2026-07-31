import { prisma } from "../../config/prisma.js";

import type {
  SearchCustomersByEmailQuery,
  SearchCustomersByPhoneNumberQuery,
} from "./customer.types.js";

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
} as const;

const mapCustomerSearchResult = (customer: {
  id: string;

  user: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    role: string;
    avatarUrl: string | null;
    isActive: boolean;
  };
}) => {
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

export const searchCustomersByEmail = async (
  query: SearchCustomersByEmailQuery,
) => {
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

const normalizePhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.replace(/[\s().-]/g, "");
};

export const searchCustomersByPhoneNumber = async (
  query: SearchCustomersByPhoneNumberQuery,
) => {
  const normalizedPhoneNumber = normalizePhoneNumber(query.phoneNumber.trim());

  /*
   * PostgreSQL/Prisma không thể chuẩn hóa dấu cách và dấu gạch ngay trong
   * contains một cách portable. Lấy một tập ứng viên giới hạn rồi chuẩn hóa
   * ở Node.js để khớp cách FE đang xử lý số điện thoại.
   */
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
