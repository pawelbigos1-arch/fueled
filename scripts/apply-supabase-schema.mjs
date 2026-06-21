#!/usr/bin/env node
/**
 * Stosuje supabase/sql/*.sql na projekcie Postgres (wymaga SUPABASE_DB_PASSWORD).
 * Użycie: SUPABASE_DB_PASSWORD=... node scripts/apply-supabase-schema.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const projectRef = process.env.SUPABASE_PROJECT_REF ?? "hhyadoyozpqamqhiztpw";
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Brak SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, "..", "supabase", "sql");
const files = readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Supabase DB host is IPv6-only on newer projects; literal avoids ENOTFOUND on IPv4-only resolvers. */
const dbHost =
  process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com";

const client = process.env.DATABASE_URL
  ? new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new pg.Client({
      host: dbHost,
      port: 6543,
      user: `postgres.${projectRef}`,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    });

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(join(sqlDir, file), "utf8");
    console.log(`Applying ${file}...`);
    await client.query(sql);
    console.log(`OK: ${file}`);
  }
  console.log("Schema applied successfully.");
} catch (err) {
  console.error("Schema apply failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
