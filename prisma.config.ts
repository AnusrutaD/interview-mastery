import { defineConfig } from "prisma/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Prisma 7 doesn't auto-load .env before running this config file — do it manually.
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["'](.*)["']$/, "$1");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

export default defineConfig({
  datasource: {
    // DIRECT_URL = non-pooled connection, required for Prisma migrate on Supabase
    url: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!,
  },
});
