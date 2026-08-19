export function normalizePreferenceValue(value) {
    const normalized = value
        .trim()
        .toLocaleLowerCase("vi-VN")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    if (normalized === "trung binh")
        return "tam trung";
    return normalized;
}
export function matchesAnyPreference(preferences, merchantValue) {
    const normalizedMerchantValue = normalizePreferenceValue(merchantValue);
    return preferences.some((preference) => {
        const normalizedPreference = normalizePreferenceValue(preference);
        return (normalizedPreference.length > 0 &&
            (normalizedMerchantValue === normalizedPreference ||
                normalizedMerchantValue.includes(normalizedPreference) ||
                normalizedPreference.includes(normalizedMerchantValue)));
    });
}
