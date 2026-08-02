import "dotenv/config";

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { findPostgresTool, postgresProcessEnv } from "./postgres-tools.mjs";

const sourceDatabaseUrl = process.env.DATABASE_URL;
if (!sourceDatabaseUrl) throw new Error("DATABASE_URL is missing");

const sourceUrl = new URL(sourceDatabaseUrl);
const sourceDatabase = decodeURIComponent(sourceUrl.pathname.slice(1));
const explicitRestoreUrl = process.env.RESTORE_TEST_DATABASE_URL?.trim();
const restoreUrl = explicitRestoreUrl
  ? new URL(explicitRestoreUrl)
  : new URL(sourceDatabaseUrl);
if (!explicitRestoreUrl) restoreUrl.pathname = `/${sourceDatabase}_restore_test`;

const restoreDatabase = decodeURIComponent(restoreUrl.pathname.slice(1));
if (
  !/^[A-Za-z0-9_]+_restore_test$/.test(restoreDatabase) ||
  restoreDatabase === sourceDatabase
) {
  throw new Error(
    `Restore bị từ chối: database '${restoreDatabase}' phải kết thúc bằng _restore_test`,
  );
}

const requestedDump = process.argv.find((argument) => argument.startsWith("--dump="));
let dumpPath = requestedDump
  ? path.resolve(requestedDump.slice("--dump=".length))
  : undefined;

if (!dumpPath) {
  const backupDirectory = path.resolve(process.cwd(), "backups");
  const candidates = existsSync(backupDirectory)
    ? readdirSync(backupDirectory)
        .filter((name) => name.endsWith(".dump"))
        .sort()
    : [];
  const latest = candidates.at(-1);
  if (latest) dumpPath = path.join(backupDirectory, latest);
}
if (!dumpPath || !existsSync(dumpPath)) {
  throw new Error("Không tìm thấy backup. Chạy npm run db:backup trước.");
}

const adminUrl = new URL(sourceDatabaseUrl);
adminUrl.pathname = "/postgres";
const adminPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: adminUrl.toString() }),
});

try {
  await adminPrisma.$executeRawUnsafe(
    `DROP DATABASE IF EXISTS "${restoreDatabase}" WITH (FORCE)`,
  );
  await adminPrisma.$executeRawUnsafe(`CREATE DATABASE "${restoreDatabase}"`);
} finally {
  await adminPrisma.$disconnect();
}

const pgRestore = findPostgresTool("pg_restore");
const restore = spawnSync(
  pgRestore,
  ["--dbname", restoreDatabase, "--no-owner", "--no-acl", dumpPath],
  {
    env: postgresProcessEnv(restoreUrl.toString(), restoreDatabase),
    stdio: "inherit",
  },
);
if (restore.status !== 0) {
  throw new Error(`pg_restore failed with exit code ${restore.status}`);
}

const restoredPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: restoreUrl.toString() }),
});
try {
  const [migrations, users, orders, uatUsers] = await Promise.all([
    restoredPrisma.$queryRaw`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
    `,
    restoredPrisma.user.count(),
    restoredPrisma.order.count(),
    restoredPrisma.user.count({ where: { email: { endsWith: "@uat.ugem.local" } } }),
  ]);

  console.log(`Restore drill passed: ${restoreDatabase}`);
  console.log(`migrations=${migrations[0]?.count ?? 0n}`);
  console.log(`users=${users}`);
  console.log(`orders=${orders}`);
  console.log(`uatUsers=${uatUsers}`);
} finally {
  await restoredPrisma.$disconnect();
}
