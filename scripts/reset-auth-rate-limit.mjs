#!/usr/bin/env node
import pg from "pg";

const projectRef = "hhyadoyozpqamqhiztpw";
const password = process.env.SUPABASE_DB_PASSWORD;
const email = process.env.RESET_EMAIL ?? "pawelbigos1@gmail.com";

if (!password) {
  console.error("Brak SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const client = new pg.Client({
  host: "aws-0-eu-west-1.pooler.supabase.com",
  port: 6543,
  user: `postgres.${projectRef}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const userRes = await client.query(
  "SELECT id, email, created_at, last_sign_in_at FROM auth.users WHERE lower(email) = lower($1)",
  [email]
);
console.log("users:", userRes.rows);

const flowBefore = await client.query(
  "SELECT count(*)::int AS n FROM auth.flow_state"
);
console.log("flow_state before:", flowBefore.rows[0].n);

const ottBefore = await client.query(
  "SELECT count(*)::int AS n FROM auth.one_time_tokens"
);
console.log("one_time_tokens before:", ottBefore.rows[0].n);

await client.query("DELETE FROM auth.flow_state");
await client.query("DELETE FROM auth.one_time_tokens");

const flowAfter = await client.query(
  "SELECT count(*)::int AS n FROM auth.flow_state"
);
console.log("flow_state after:", flowAfter.rows[0].n);

await client.end();
console.log("Auth OTP state cleared. Rate limit may still apply for ~1h on Supabase side.");
