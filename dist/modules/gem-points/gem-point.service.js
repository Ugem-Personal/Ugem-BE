import { GEM_POINT_POLICY, } from "../../common/constants/gem-point-policy.js";
import { GEM_POINT_TRANSACTION_TYPE } from "../../common/constants/gem-point-transaction.js";
import { calculateContributionRank } from "../../common/utils/contribution-rank.js";
const getTransactionType = (action) => GEM_POINT_TRANSACTION_TYPE[action];
export const awardGemPoints = async (transaction, params) => {
    const amount = GEM_POINT_POLICY[params.action];
    const transactionType = getTransactionType(params.action);
    const rewardKey = `${params.customerId}:${transactionType}:${params.referenceId}`;
    // Claim the reward first. The database unique key makes this idempotent,
    // while skipDuplicates keeps a replay from aborting its surrounding tx.
    const claim = await transaction.reviewerPointTransaction.createMany({
        data: [{
                reviewerId: params.customerId,
                amount,
                pointsAfter: 0,
                type: transactionType,
                reason: params.reason ?? null,
                referenceId: params.referenceId,
                rewardKey,
            }],
        skipDuplicates: true,
    });
    if (claim.count === 0) {
        return {
            awarded: false,
            amount: 0,
            pointsAfter: 0,
            contributionRank: null,
        };
    }
    const customer = await transaction.customer.update({
        where: { id: params.customerId },
        data: {
            gemPoints: { increment: amount },
        },
        select: {
            gemPoints: true,
        },
    });
    const contributionRank = calculateContributionRank(customer.gemPoints);
    await transaction.customer.update({
        where: { id: params.customerId },
        data: { contributionRank },
    });
    await transaction.reviewerPointTransaction.update({
        where: { rewardKey },
        data: { pointsAfter: customer.gemPoints },
    });
    return {
        awarded: true,
        amount,
        pointsAfter: customer.gemPoints,
        contributionRank,
    };
};
