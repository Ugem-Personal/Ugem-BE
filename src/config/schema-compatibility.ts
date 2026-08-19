import { logger } from "../common/utils/logger.js";
import { prisma } from "./prisma.js";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 10_000;

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

/**
 * Keeps the running API compatible when the hosting platform has no release
 * phase for Prisma migrations. This must stay small, idempotent and bounded;
 * normal schema evolution still belongs in prisma/migrations.
 */
export const ensureSchemaCompatibility = async () => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
        await transaction.$executeRawUnsafe(
          "SET LOCAL statement_timeout = '10s'",
        );
        await transaction.$executeRawUnsafe(`
          ALTER TABLE "customers"
          ADD COLUMN IF NOT EXISTS "preferredCategoryIds"
          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
        `);
      });

      logger.info("database.schema_compatibility.ready");
      return;
    } catch (error) {
      logger.error("database.schema_compatibility.failed", {
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        error,
      });

      if (attempt < MAX_ATTEMPTS) await wait(RETRY_DELAY_MS);
    }
  }
};
