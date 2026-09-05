import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

let dir = import.meta.dirname;
for (let i = 0; i < 6; i++) {
  if (existsSync(path.join(dir, ".env"))) break;
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}

dotenv.config({ path: path.join(dir, ".env"), quiet: true });
