import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { logger } from "./common/utils/logger.js";
import { setShuttingDown } from "./modules/health/health.service.js";
import { startRebalancingJob } from "./jobs/rebalancing.job.js";
import { ensureSchemaCompatibility } from "./config/schema-compatibility.js";
const SHUTDOWN_TIMEOUT_MS = 10_000;
const startServer = async () => {
    try {
        await prisma.$connect();
        logger.info("database.connected");
        await ensureSchemaCompatibility();
        startRebalancingJob();
        const server = app.listen(env.PORT, () => {
            logger.info("server.started", {
                port: env.PORT,
                environment: env.NODE_ENV,
            });
        });
        let shutdownStarted = false;
        const shutdown = async (signal, exitCode = 0) => {
            if (shutdownStarted)
                return;
            shutdownStarted = true;
            setShuttingDown(true);
            logger.info("server.shutdown.started", { signal });
            const forceExitTimer = setTimeout(() => {
                logger.error("server.shutdown.timed_out", {
                    timeoutMs: SHUTDOWN_TIMEOUT_MS,
                });
                process.exit(1);
            }, SHUTDOWN_TIMEOUT_MS);
            forceExitTimer.unref();
            server.close(async () => {
                try {
                    await prisma.$disconnect();
                    clearTimeout(forceExitTimer);
                    logger.info("server.shutdown.completed");
                    process.exit(exitCode);
                }
                catch (error) {
                    logger.error("server.shutdown.failed", { error });
                    process.exit(1);
                }
            });
            server.closeIdleConnections?.();
        };
        process.on("SIGINT", () => void shutdown("SIGINT"));
        process.on("SIGTERM", () => void shutdown("SIGTERM"));
        process.on("unhandledRejection", (error) => {
            logger.error("process.unhandled_rejection", { error });
        });
        process.on("uncaughtException", (error) => {
            logger.error("process.uncaught_exception", { error });
            void shutdown("uncaughtException", 1);
        });
    }
    catch (error) {
        logger.error("server.start_failed", { error });
        await prisma.$disconnect();
        process.exit(1);
    }
};
void startServer();
