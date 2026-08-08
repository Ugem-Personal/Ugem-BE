import { prisma } from "../../config/prisma.js";
let shuttingDown = false;
export const setShuttingDown = (value) => {
    shuttingDown = value;
};
export const isShuttingDown = () => shuttingDown;
export const checkDatabaseReadiness = async () => {
    if (shuttingDown) {
        return { ready: false, database: "UNKNOWN" };
    }
    let timeout;
    try {
        await Promise.race([
            prisma.$queryRaw `SELECT 1`,
            new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error("Database health check timed out")), 8000);
            }),
        ]);
        return { ready: true, database: "UP" };
    }
    catch (err) {
        return { ready: false, database: (err?.message || err?.code || "DOWN") };
    }
    finally {
        if (timeout)
            clearTimeout(timeout);
    }
};
