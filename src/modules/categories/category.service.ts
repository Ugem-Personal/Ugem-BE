import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

const categorySelect = {
  id: true,
  parentId: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  children: {
    where: {
      isActive: true,
    },
    select: {
      id: true,
      parentId: true,
      name: true,
      description: true,
      isActive: true,
    },
    orderBy: {
      name: "asc" as const,
    },
  },
};

export const getCategories = async () => {
  return prisma.category.findMany({
    where: {
      parentId: null,
      isActive: true,
    },
    select: categorySelect,
    orderBy: {
      name: "asc",
    },
  });
};

export const getAllCategoriesForManagement = async () => {
  return prisma.category.findMany({
    select: categorySelect,
    orderBy: [
      {
        parentId: "asc",
      },
      {
        name: "asc",
      },
    ],
  });
};

export const createCategory = async (input: {
  name: string;
  description?: string | null;
  parentId?: string | null;
}) => {
  const parentId = input.parentId || null;

  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: {
        id: parentId,
      },
    });

    if (!parent) {
      throw new AppError(404, "Không tìm thấy danh mục cha");
    }
  }

  const duplicate = await prisma.category.findFirst({
    where: {
      parentId,
      name: {
        equals: input.name.trim(),
        mode: "insensitive",
      },
    },
  });

  if (duplicate) {
    throw new AppError(409, "Tên danh mục đã tồn tại trong cùng cấp");
  }

  return prisma.category.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      parentId,
    },
  });
};

export const updateCategory = async (
  categoryId: string,
  input: {
    name?: string;
    description?: string | null;
    parentId?: string | null;
    isActive?: boolean;
  },
) => {
  const category = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
  });

  if (!category) {
    throw new AppError(404, "Không tìm thấy danh mục");
  }

  const parentId =
    input.parentId !== undefined ? input.parentId || null : undefined;

  if (parentId === categoryId) {
    throw new AppError(400, "Danh mục không thể làm cha của chính nó");
  }

  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: {
        id: parentId,
      },
    });

    if (!parent) {
      throw new AppError(404, "Không tìm thấy danh mục cha");
    }
  }

  return prisma.category.update({
    where: {
      id: categoryId,
    },
    data: {
      name: input.name?.trim(),
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : undefined,
      parentId,
      isActive: input.isActive,
    },
  });
};

export const deleteCategory = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
    include: {
      _count: {
        select: {
          foodCategories: true,
          children: true,
        },
      },
    },
  });

  if (!category) {
    throw new AppError(404, "Không tìm thấy danh mục");
  }

  if (category._count.foodCategories > 0 || category._count.children > 0) {
    return prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        isActive: false,
      },
    });
  }

  return prisma.category.delete({
    where: {
      id: categoryId,
    },
  });
};

export const getChildCategories = async (parentId: string) => {
  const parentCategory = await prisma.category.findUnique({
    where: {
      id: parentId,
    },

    select: {
      id: true,
      isActive: true,
    },
  });

  if (!parentCategory || !parentCategory.isActive) {
    throw new AppError(404, "Không tìm thấy danh mục cha");
  }

  return prisma.category.findMany({
    where: {
      parentId,
      isActive: true,
    },

    select: {
      id: true,
      parentId: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },

    orderBy: {
      name: "asc",
    },
  });
};
