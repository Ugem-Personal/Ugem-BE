export const paginationMeta = (result) => ({
    pageIndex: result.pageIndex,
    pageSize: result.pageSize,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
});
