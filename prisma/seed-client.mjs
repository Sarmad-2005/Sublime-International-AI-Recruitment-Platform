/**
 * Seed (or repair) a loginable SAUDI_CLIENT so the /client portal can be tested.
 *
 * The demo employer created by seed-jobs.mjs lives only in `public.users` with
 * no Supabase Auth row, so it can't sign in. This script:
 *   1. Creates/updates a real Supabase Auth user (app_metadata.role=SAUDI_CLIENT).
 *   2. Upserts the matching `users` row (id === auth id).
 *   3. Points the existing `saudi_client_profiles` company at that user (so the
 *      client owns the demo jobs), creating one if none exists.
 *   4. Surfaces every TIERED-or-later application on the client's jobs into the
 *      client's candidate pool, so the Talent Pool has content.
 *
 *   node prisma/seed-client.mjs
 *   node prisma/seed-client.mjs you@example.com 'YourPassw0rd!'
 */
import "dotenv/config";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const EMAIL = process.argv[2] ?? "client.demo@sublime-international.com";
const PASSWORD = process.argv[3] ?? "Client#2005";
const ROLE = "SAUDI_CLIENT";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL/DIRECT_URL.",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
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
  // 1) Create or update the Supabase Auth user.
  let authUser = null;
  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: ROLE },
    user_metadata: { role: ROLE, full_name: "Al Faisal Contracting Co." },
  });

  if (created.error) {
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

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");

    // 2) Upsert the Postgres users row (id === auth user id).
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, is_email_verified, is_phone_verified, created_at, updated_at)
       VALUES ($1, $2, 'supabase-auth-managed', $3::user_role, true, false, now(), now())
       ON CONFLICT (id) DO UPDATE
         SET role = EXCLUDED.role, email = EXCLUDED.email, is_email_verified = true, updated_at = now()`,
      [authUser.id, EMAIL, ROLE],
    );
    console.log(`✓ users row upserted (id ${authUser.id})`);

    // 3) Attach a company profile to this user — reuse the existing demo company
    //    if present (so the client owns its jobs), else create a fresh one.
    const existing = await client.query(
      `SELECT id FROM saudi_client_profiles ORDER BY created_at ASC LIMIT 1`,
    );
    let profileId;
    if (existing.rows.length > 0) {
      profileId = existing.rows[0].id;
      await client.query(
        `UPDATE saudi_client_profiles SET user_id = $1, updated_at = now() WHERE id = $2`,
        [authUser.id, profileId],
      );
      console.log(`✓ Linked existing company profile ${profileId} to this user`);
    } else {
      const ins = await client.query(
        `INSERT INTO saudi_client_profiles
           (id, user_id, company_name, country, city, contact_name, designation, contact_phone, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'Al Faisal Contracting Co.', 'Saudi Arabia', 'Riyadh',
                 'Khalid Al-Faisal', 'HR Manager', '+966500000000', now(), now())
         RETURNING id`,
        [authUser.id],
      );
      profileId = ins.rows[0].id;
      console.log(`✓ Created company profile ${profileId}`);
    }

    // 4) Surface TIERED-or-later applications on this client's jobs into the pool.
    const pooled = await client.query(
      `INSERT INTO saudi_client_candidate_pool (id, saudi_client_id, application_id, client_status, added_at)
       SELECT gen_random_uuid(), $1, a.id, 'UNREVIEWED', now()
       FROM applications a
       JOIN job_posts jp ON a.job_post_id = jp.id
       WHERE jp.saudi_client_id = $1
         AND a.status IN ('TIERED','IN_CLIENT_POOL','CLIENT_SHORTLISTED','LIVE_INTERVIEW_SCHEDULED','SELECTED','POST_SELECTION','DEPLOYED')
       ON CONFLICT (application_id) DO NOTHING
       RETURNING application_id`,
      [profileId],
    );
    if (pooled.rows.length > 0) {
      await client.query(
        `UPDATE applications SET status = 'IN_CLIENT_POOL', updated_at = now()
         WHERE id = ANY($1::uuid[]) AND status = 'TIERED'`,
        [pooled.rows.map((r) => r.application_id)],
      );
    }
    console.log(`✓ Added ${pooled.rows.length} candidate(s) to the pool`);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }

  console.log("\nDone. Sign in at /auth/login with:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log("You'll land on /client/dashboard.");
}

main().catch((err) => {
  console.error("Failed to seed client:", err);
  process.exit(1);
});
