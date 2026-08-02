export interface PaginatedResult {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export const paginationMeta = (result: PaginatedResult) => ({
  pageIndex: result.pageIndex,
  pageSize: result.pageSize,
  totalItems: result.totalItems,
  totalPages: result.totalPages,
});

