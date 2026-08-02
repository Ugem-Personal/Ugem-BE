import "dotenv/config";
import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
const getTestDatabaseUrl = () => {
    const explicitTestUrl = process.env.TEST_DATABASE_URL?.trim();
    const sourceUrl = explicitTestUrl || process.env.DATABASE_URL;
    if (!sourceUrl) {
        throw new Error("Thiếu DATABASE_URL hoặc TEST_DATABASE_URL");
    }
    const url = new URL(sourceUrl);
    const currentDatabase = decodeURIComponent(url.pathname.slice(1));
    const testDatabase = explicitTestUrl
        ? currentDatabase
        : `${currentDatabase}_test`;
    if (!/^[A-Za-z0-9_]+$/.test(testDatabase) || !testDatabase.endsWith("_test")) {
        throw new Error(`E2E từ chối database '${testDatabase}'. Tên database phải kết thúc bằng _test.`);
    }
    url.pathname = `/${testDatabase}`;
    return { testDatabase, testDatabaseUrl: url.toString() };
};
const ensureTestDatabase = async (testDatabase, testDatabaseUrl) => {
    const adminUrl = new URL(testDatabaseUrl);
    adminUrl.pathname = "/postgres";
    const adminPrisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: adminUrl.toString() }),
    });
    try {
        const databases = await adminPrisma.$queryRawUnsafe("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists", testDatabase);
        if (!databases[0]?.exists) {
            await adminPrisma.$executeRawUnsafe(`CREATE DATABASE "${testDatabase}"`);
            console.log(`Đã tạo database E2E ${testDatabase}.`);
        }
    }
    finally {
        await adminPrisma.$disconnect();
    }
};
const runCommand = (command, args, environment) => {
    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        env: environment,
        stdio: "inherit",
    });
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} thất bại`);
    }
};
const run = async () => {
    const { testDatabase, testDatabaseUrl } = getTestDatabaseUrl();
    await ensureTestDatabase(testDatabase, testDatabaseUrl);
    const testEnvironment = {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: testDatabaseUrl,
        JWT_ACCESS_SECRET: process.env.E2E_JWT_ACCESS_SECRET ||
            "e2e-access-secret-that-is-long-enough-123456",
        JWT_REFRESH_SECRET: process.env.E2E_JWT_REFRESH_SECRET ||
            "e2e-refresh-secret-that-is-long-enough-123456",
        SEPAY_WEBHOOK_API_KEY: process.env.E2E_SEPAY_WEBHOOK_API_KEY ||
            "e2e-sepay-key-with-at-least-32-characters",
    };
    runCommand(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], testEnvironment);
    runCommand(process.execPath, [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "vitest.e2e.config.ts",
        ...process.argv.slice(2),
    ], testEnvironment);
};
run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
