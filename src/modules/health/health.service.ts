import { prisma } from "../../config/prisma.js";

let shuttingDown = false;

export const setShuttingDown = (value: boolean) => {
  shuttingDown = value;
};

export const isShuttingDown = () => shuttingDown;

export const checkDatabaseReadiness = async () => {
  if (shuttingDown) {
    return { ready: false, database: "UNKNOWN" as const };
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Database health check timed out")),
          8000,
        );
      }),
    ]);

    return { ready: true, database: "UP" as const };
  } catch (err: any) {
    return { ready: false, database: (err?.message || err?.code || "DOWN") as any };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};
