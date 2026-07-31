import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const url = new URL(databaseUrl);
const databaseName = url.pathname.slice(1);

if (!databaseName) {
  console.error("DATABASE_URL must include a database name.");
  process.exit(1);
}

url.pathname = "/postgres";
url.search = "";

const client = new Client({ connectionString: url.toString() });

try {
  await client.connect();
  const existing = await client.query(
    "select 1 from pg_database where datname = $1",
    [databaseName],
  );

  if (existing.rowCount) {
    console.log(`Database already exists: ${databaseName}`);
  } else {
    await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
    console.log(`Created database: ${databaseName}`);
  }
} finally {
  await client.end();
}
