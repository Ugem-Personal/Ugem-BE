import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";
const isLocalHost = env.DATABASE_URL.includes("localhost") ||
    env.DATABASE_URL.includes("127.0.0.1");
const runtimeDatabaseUrl = new URL(env.DATABASE_URL);
runtimeDatabaseUrl.searchParams.delete("sslmode");
const pool = new pg.Pool({
    connectionString: runtimeDatabaseUrl.toString(),
    ssl: isLocalHost ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    max: 10,
    idleTimeoutMillis: 30000,
});
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
