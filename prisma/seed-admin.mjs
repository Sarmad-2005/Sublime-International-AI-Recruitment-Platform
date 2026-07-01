/**
 * Seed (or promote) an admin user so the /admin portal can be tested.
 *
 * Access to /admin/dashboard is gated in two places that BOTH must agree:
 *   1. The Edge middleware reads the role from Supabase `app_metadata.role`.
 *   2. The server layout/page read it from the Postgres `users.role` column.
 * This script sets both, using the Supabase service-role key + a direct pg
 * connection — the same env the app already uses.
 *
 * Idempotent: creates the auth user if missing, otherwise resets its password
 * and role, then upserts the matching `users` row.
 *
 *   node prisma/seed-admin.mjs
 *   node prisma/seed-admin.mjs you@example.com 'YourPassw0rd!' SUPER_ADMIN
 */
import "dotenv/config";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const EMAIL = process.argv[2] ?? "sarmadrizvi2005@gmail.com";
const PASSWORD = process.argv[3] ?? "Sarmad#2005";
const ROLE = process.argv[4] ?? "ADMIN"; // ADMIN | SUPER_ADMIN

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.",
  );
  process.exit(1);
}
if (!["ADMIN", "SUPER_ADMIN"].includes(ROLE)) {
  console.error(`Invalid role "${ROLE}". Use ADMIN or SUPER_ADMIN.`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  // Paginate the admin user list and match by email (no direct get-by-email API).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  // 1) Create or update the Supabase Auth user (with app_metadata.role).
  let authUser = null;

  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: ROLE },
    user_metadata: { role: ROLE, full_name: "SIORP Administrator" },
  });

  if (created.error) {
    // Most likely the user already exists — find and update it instead.
    authUser = await findUserByEmail(EMAIL);
    if (!authUser) throw created.error;

    const updated = await admin.auth.admin.updateUserById(authUser.id, {
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role: ROLE },
    });
    if (updated.error) throw updated.error;
    authUser = updated.data.user;
    console.log(`↻ Updated existing auth user ${EMAIL} → ${ROLE}`);
  } else {
    authUser = created.data.user;
    console.log(`+ Created auth user ${EMAIL} → ${ROLE}`);
  }

  // 2) Upsert the matching Postgres users row (id === auth user id).
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, is_email_verified, is_phone_verified, created_at, updated_at)
       VALUES ($1, $2, 'supabase-auth-managed', $3::user_role, true, false, now(), now())
       ON CONFLICT (id) DO UPDATE
         SET role = EXCLUDED.role,
             email = EXCLUDED.email,
             is_email_verified = true,
             updated_at = now()`,
      [authUser.id, EMAIL, ROLE],
    );
    console.log(`✓ users row upserted (id ${authUser.id})`);
  } finally {
    await client.end();
  }

  console.log("\nDone. Sign in at /auth/login with:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log("You'll land on /admin/dashboard.");
}

main().catch((err) => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
