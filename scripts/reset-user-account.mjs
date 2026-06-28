#!/usr/bin/env node
/**
 * Usuwa konto email z auth + tworzy na nowo z potwierdzonym emailem i hasłem.
 * Użycie: SUPABASE_DB_PASSWORD=... node scripts/reset-user-account.mjs [email]
 */
import pg from "pg";
import { randomBytes } from "node:crypto";

const projectRef = "hhyadoyozpqamqhiztpw";
const password = process.env.SUPABASE_DB_PASSWORD;
const email = (process.argv[2] ?? "pawelbigos1@gmail.com").trim().toLowerCase();
const fullName = process.env.USER_FULL_NAME ?? "Paweł";

if (!password) {
  console.error("Brak SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const newPassword =
  process.env.NEW_USER_PASSWORD ??
  `Fueled-${randomBytes(4).toString("hex")}!`;

const client = new pg.Client({
  host: "aws-0-eu-west-1.pooler.supabase.com",
  port: 6543,
  user: `postgres.${projectRef}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  await client.query("BEGIN");

  const existing = await client.query(
    "SELECT id FROM auth.users WHERE lower(email) = lower($1)",
    [email]
  );

  if (existing.rows.length) {
    const userId = existing.rows[0].id;
    await client.query("DELETE FROM auth.users WHERE id = $1", [userId]);
    console.log("Usunięto konto:", email, userId);
  } else {
    console.log("Brak istniejącego konta — tworzę nowe.");
  }

  const insert = await client.query(
    `
    WITH new_user AS (
      SELECT gen_random_uuid() AS id
    ),
    inserted AS (
      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        is_super_admin,
        recovery_token,
        email_change,
        email_change_token_new,
        email_change_token_current,
        phone_change,
        phone_change_token,
        reauthentication_token
      )
      SELECT
        new_user.id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        $1::text,
        crypt($2::text, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', $3::text),
        now(),
        now(),
        '',
        false,
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      FROM new_user
      RETURNING id
    )
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      inserted.id,
      jsonb_build_object('sub', inserted.id::text, 'email', $1::text),
      'email',
      inserted.id::text,
      now(),
      now(),
      now()
    FROM inserted
    RETURNING user_id
    `,
    [email, newPassword, fullName]
  );

  const userId = insert.rows[0].user_id;

  await client.query(
    `INSERT INTO public.user_profiles (id, email)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [userId, email]
  );

  await client.query("COMMIT");

  console.log(JSON.stringify({ email, userId, password: newPassword }, null, 2));
} catch (err) {
  await client.query("ROLLBACK");
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
