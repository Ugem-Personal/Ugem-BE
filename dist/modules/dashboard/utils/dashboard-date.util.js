const VIETNAM_TIME_OFFSET = 7 * 60 * 60 * 1000;
export const getYearRange = (year) => {
    return {
        startDate: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
        endDate: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)),
    };
};
export const getVietnamDateRange = (startDateValue, endDateValue) => {
    return {
        startDate: new Date(`${startDateValue}T00:00:00.000+07:00`),
        endDate: new Date(`${endDateValue}T23:59:59.999+07:00`),
    };
};
export const toVietnamDateKey = (date) => {
    return new Date(date.getTime() + VIETNAM_TIME_OFFSET)
        .toISOString()
        .slice(0, 10);
};
export const createDateKeys = (startDateValue, endDateValue) => {
    const startDate = new Date(`${startDateValue}T00:00:00.000Z`);
    const endDate = new Date(`${endDateValue}T00:00:00.000Z`);
    const dateKeys = [];
    const currentDate = new Date(startDate);
    while (currentDate.getTime() <= endDate.getTime()) {
        dateKeys.push(currentDate.toISOString().slice(0, 10));
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return dateKeys;
};
