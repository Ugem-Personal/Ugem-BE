import "dotenv/config";
import pg from "pg";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { findPostgresTool, postgresProcessEnv } from "../scripts/postgres-tools.mjs";

const supabaseUrl = process.env.DATABASE_URL;
if (!supabaseUrl) throw new Error("DATABASE_URL missing");

const localDbUrl = "postgresql://postgres:Manhcuong6524%3F%3F@localhost:5432/ugem_db";

async function main() {
  console.log("Step 1: Connecting to Supabase to clear old data...");
  const client = new pg.Client({ connectionString: supabaseUrl });
  await client.connect();

  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != '_prisma_migrations';
  `);
  
  const tables = tablesRes.rows.map(r => `"${r.table_name}"`).join(", ");
  if (tables.length > 0) {
    console.log("Truncating tables:", tables);
    await client.query(`TRUNCATE TABLE ${tables} CASCADE;`);
  }
  await client.end();

  console.log("Step 2: Exporting data-only from local ugem_db...");
  const backupDir = path.resolve(process.cwd(), "backups");
  const dumpPath = path.join(backupDir, "local_data_only.dump");

  const pgDump = findPostgresTool("pg_dump");
  const pgRestore = findPostgresTool("pg_restore");

  const dumpEnv = postgresProcessEnv(localDbUrl, "ugem_db");
  const dumpRes = spawnSync(
    pgDump,
    ["--format=custom", "--no-owner", "--no-acl", "--data-only", "--file", dumpPath],
    { env: dumpEnv, stdio: "inherit" }
  );
  if (dumpRes.status !== 0) throw new Error(`Dump failed: ${dumpRes.status}`);

  console.log("Step 3: Restoring data to Supabase...");
  const restoreRes = spawnSync(
    pgRestore,
    ["--no-owner", "--no-acl", "--data-only", "--disable-triggers", "--dbname=" + supabaseUrl, dumpPath],
    { stdio: "inherit" }
  );

  console.log("Migration complete! Status code:", restoreRes.status);
}

main().catch(console.error);
