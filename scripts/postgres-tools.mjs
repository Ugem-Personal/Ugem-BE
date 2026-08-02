import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const executableName = (name) =>
  process.platform === "win32" ? `${name}.exe` : name;

const candidateDirectories = () => {
  const directories = [];
  if (process.env.PG_BIN_DIR) directories.push(process.env.PG_BIN_DIR);

  if (process.platform === "win32") {
    const postgresRoot = "C:\\Program Files\\PostgreSQL";
    if (existsSync(postgresRoot)) {
      const versions = readdirSync(postgresRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
      directories.push(...versions.map((version) => path.join(postgresRoot, version, "bin")));
    }
  }

  return directories;
};

export const findPostgresTool = (name) => {
  const executable = executableName(name);
  for (const directory of candidateDirectories()) {
    const candidate = path.join(directory, executable);
    if (existsSync(candidate)) return candidate;
  }

  // Unix-like systems normally resolve PostgreSQL tools from PATH.
  if (process.platform !== "win32") return executable;

  throw new Error(
    `Không tìm thấy ${executable}. Hãy cài PostgreSQL client hoặc đặt PG_BIN_DIR.`,
  );
};

export const postgresProcessEnv = (databaseUrl, databaseName) => {
  const url = new URL(databaseUrl);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: databaseName || decodeURIComponent(url.pathname.slice(1)),
  };
};

