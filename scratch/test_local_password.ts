import pg from "pg";

async function testLocalPassword() {
  const client = new pg.Client({
    connectionString: "postgresql://postgres:Manhcuong6524%3F%3F@localhost:5432/postgres",
  });
  try {
    await client.connect();
    console.log("SUCCESS! Connected to local PostgreSQL!");
    const dbs = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
    console.log("Databases on local postgres:", dbs.rows.map(r => r.datname));
    await client.end();
  } catch (err) {
    console.error("Local connect error:", err.message);
  }
}

testLocalPassword();
