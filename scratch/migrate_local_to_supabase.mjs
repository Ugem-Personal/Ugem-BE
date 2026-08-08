import "dotenv/config";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { findPostgresTool, postgresProcessEnv } from "../scripts/postgres-tools.mjs";

const localDbUrl = "postgresql://postgres:Manhcuong6524%3F%3F@localhost:5432/ugem_db";
const supabaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl) throw new Error("DATABASE_URL env is missing");

const backupDir = path.resolve(process.cwd(), "backups");
mkdirSync(backupDir, { recursive: true });

const dumpPath = path.join(backupDir, "local_full_migration.dump");

const pgDump = findPostgresTool("pg_dump");
const pgRestore = findPostgresTool("pg_restore");

console.log("Step 1: Exporting local DB 'ugem_db'...");
const dumpEnv = postgresProcessEnv(localDbUrl, "ugem_db");
const dumpRes = spawnSync(
  pgDump,
  ["--format=custom", "--no-owner", "--no-acl", "--data-only", "--file", dumpPath],
  { env: dumpEnv, stdio: "inherit" }
);

if (dumpRes.status !== 0) throw new Error(`Export failed with code ${dumpRes.status}`);

console.log("Step 2: Restoring local data to Supabase...");
const restoreRes = spawnSync(
  pgRestore,
  ["--no-owner", "--no-acl", "--data-only", "--disable-triggers", "--dbname=" + supabaseUrl, dumpPath],
  { stdio: "inherit" }
);

console.log("Migration finished with code:", restoreRes.status);
