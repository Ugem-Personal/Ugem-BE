import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import { RebalancingStatus } from "../generated/prisma/client.js";
import { runRebalancing } from "../modules/rebalancing/rebalancing.service.js";
const REBALANCING_INTERVAL_DAYS = 14;
export const checkAndRunRebalancing = async () => {
    try {
        // Skip if another rebalancing job is already running
        const activeRun = await prisma.rebalancingRun.findFirst({
            where: { status: RebalancingStatus.Running },
        });
        if (activeRun) {
            console.log("[Rebalancing Job] Skipping check: Another rebalancing run is currently in progress.");
            return;
        }
        const lastRun = await prisma.rebalancingRun.findFirst({
            where: {
                status: RebalancingStatus.Completed,
            },
            orderBy: {
                completedAt: "desc",
            },
        });
        if (!lastRun || !lastRun.completedAt) {
            console.log("[Rebalancing Job] Initializing first rebalancing run...");
            await runRebalancing();
            return;
        }
        const now = new Date();
        const daysSinceLastRun = (now.getTime() - new Date(lastRun.completedAt).getTime()) /
            (1000 * 60 * 60 * 24);
        if (daysSinceLastRun >= REBALANCING_INTERVAL_DAYS) {
            console.log(`[Rebalancing Job] Triggering bi-weekly rebalancing (${daysSinceLastRun.toFixed(1)} days since last run)...`);
            await runRebalancing();
        }
        else {
            console.log(`[Rebalancing Job] Skipping run. Last completed ${daysSinceLastRun.toFixed(1)} days ago.`);
        }
    }
    catch (error) {
        console.error("[Rebalancing Job] Error checking rebalancing schedule:", error);
    }
};
export const startRebalancingJob = () => {
    console.log("[Rebalancing Job] Scheduler initialized (Daily check at midnight)");
    // Run initial check on server start
    void checkAndRunRebalancing();
    // Schedule daily check at midnight
    cron.schedule("0 0 * * *", () => {
        void checkAndRunRebalancing();
    });
};
