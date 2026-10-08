// Applies docs/schema.sql to the Neon database referenced by .env.local.
// Usage: node scripts/apply-schema.mjs
// Idempotent: the schema only uses CREATE ... IF NOT EXISTS / CREATE OR REPLACE.
import { readFileSync } from "node:fs";
import pg from "pg";

const envLocal = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = envLocal.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)?.[1];
if (!url) {
  console.error("DATABASE_URL not found in .env.local — run `neon link` first.");
  process.exit(1);
}
// Neon's URL requests SCRAM channel binding; node-postgres does not implement
// it and ignores the key. TLS stays enforced via sslmode=require.
const connectionString = url.replace("channel_binding=require", "channel_binding=disable");

const sql = readFileSync(new URL("../docs/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  // Single simple-query call: Postgres parses the whole file, so $$-quoted
  // function bodies need no special splitting.
  await client.query(sql);
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  console.log(`Schema applied. public tables (${rows.length}):`);
  for (const row of rows) console.log(`  - ${row.table_name}`);
} catch (error) {
  console.error("Failed to apply schema:");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
