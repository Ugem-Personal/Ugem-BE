export const calculateReviewerRank = (successfulOrders) => {
    if (successfulOrders >= 100)
        return "Diamond";
    if (successfulOrders >= 50)
        return "Platinum";
    if (successfulOrders >= 20)
        return "Gold";
    if (successfulOrders >= 5)
        return "Silver";
    return "Bronze";
};
