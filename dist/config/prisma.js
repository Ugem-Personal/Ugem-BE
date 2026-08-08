import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";
const isLocalHost = env.DATABASE_URL.includes("localhost") ||
    env.DATABASE_URL.includes("127.0.0.1");
const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl: isLocalHost ? false : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
