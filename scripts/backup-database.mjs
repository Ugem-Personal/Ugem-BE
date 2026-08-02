import "dotenv/config";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { findPostgresTool, postgresProcessEnv } from "./postgres-tools.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is missing");

const url = new URL(databaseUrl);
const databaseName = decodeURIComponent(url.pathname.slice(1));
if (!databaseName) throw new Error("DATABASE_URL must include a database name");

const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
const backupDirectory = path.resolve(process.cwd(), "backups");
mkdirSync(backupDirectory, { recursive: true });

const requestedPath = process.argv.find((argument) => argument.startsWith("--output="));
const backupPath = requestedPath
  ? path.resolve(requestedPath.slice("--output=".length))
  : path.join(backupDirectory, `${databaseName}-${timestamp}.dump`);

const pgDump = findPostgresTool("pg_dump");
const pgRestore = findPostgresTool("pg_restore");
const environment = postgresProcessEnv(databaseUrl, databaseName);

const dump = spawnSync(
  pgDump,
  ["--format=custom", "--no-owner", "--no-acl", "--file", backupPath],
  { env: environment, stdio: "inherit" },
);
if (dump.status !== 0) throw new Error(`pg_dump failed with exit code ${dump.status}`);

const verify = spawnSync(pgRestore, ["--list", backupPath], {
  env: environment,
  stdio: ["ignore", "ignore", "inherit"],
});
if (verify.status !== 0) throw new Error("Backup verification failed");

console.log(`Backup verified: ${backupPath}`);
console.log(`BACKUP_FILE=${backupPath}`);

