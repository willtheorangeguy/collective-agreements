import "./env.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db, pool } from "./client.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

try {
  await migrate(db, { migrationsFolder: dir });
  console.log("migrations applied");
} finally {
  await pool.end();
}
