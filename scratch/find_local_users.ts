import pg from "pg";

async function checkLocal() {
  const passwords = ["postgres", "123456", "admin", "root"];
  for (const pwd of passwords) {
    const client = new pg.Client({
      connectionString: `postgresql://postgres:${pwd}@localhost:5432/ugem`,
    });
    try {
      await client.connect();
      console.log(`Connected to local PostgreSQL with password: ${pwd}`);
      const res = await client.query('SELECT email, role, "fullName" FROM "User"');
      console.log("Local Users:", res.rows);
      await client.end();
      return res.rows;
    } catch (e) {
      // try next
    }
  }

  for (const pwd of passwords) {
    const client = new pg.Client({
      connectionString: `postgresql://postgres:${pwd}@localhost:5432/ugem_db`,
    });
    try {
      await client.connect();
      console.log(`Connected to local ugem_db with password: ${pwd}`);
      const res = await client.query('SELECT email, role, "fullName" FROM "User"');
      console.log("Local Users:", res.rows);
      await client.end();
      return res.rows;
    } catch (e) {
      // try next
    }
  }
  console.log("Could not connect to local PostgreSQL.");
}

checkLocal();
