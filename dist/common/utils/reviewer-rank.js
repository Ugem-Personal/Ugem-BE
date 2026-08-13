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
export const getReviewerCommissionRate = (rank) => {
    switch (rank) {
        case "Diamond":
            return 0.10;
        case "Platinum":
            return 0.08;
        case "Gold":
            return 0.07;
        case "Silver":
            return 0.06;
        case "Bronze":
        default:
            return 0.05;
    }
};
