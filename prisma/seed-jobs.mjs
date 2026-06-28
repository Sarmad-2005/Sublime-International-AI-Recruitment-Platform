/**
 * Seed sample active job posts for the candidate Job Board.
 *
 * The app's DB had no Saudi clients and no jobs, so the board (and its
 * country/sector filters, which are derived from active jobs) rendered empty.
 * This creates one demo employer and a spread of ACTIVE jobs across countries,
 * sectors, salaries and benefits so the board, filters and apply flow have data.
 *
 * Idempotent: it only inserts jobs when `job_posts` is currently empty, and it
 * reuses the demo client if it already exists.
 *
 *   node prisma/seed-jobs.mjs
 */
import "dotenv/config";
import pg from "pg";

const SAR = (major) => major * 100; // halalas (minor units)
const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

const CLIENT_EMAIL = "employer.demo@sublime-international.com";

const JOBS = [
  {
    title: "Senior Electrician",
    sector: "CONSTRUCTION",
    trade: "Electrician",
    country: "Saudi Arabia",
    city: "Riyadh",
    vacancies: 5,
    salaryMin: SAR(1800),
    salaryMax: SAR(2500),
    contractDurationMonths: 24,
    description:
      "Install, maintain and repair electrical systems on large commercial construction sites. Read blueprints and ensure all work meets Saudi electrical safety codes.",
    requirements:
      "Minimum 3 years experience as an electrician\nAble to read electrical drawings\nValid trade certificate\nGulf experience preferred",
    benefits:
      "Free shared accommodation provided. Medical insurance and company transport to site. Annual air ticket.",
    postedDaysAgo: 1,
  },
  {
    title: "Plumber",
    sector: "CONSTRUCTION",
    trade: "Plumber",
    country: "Saudi Arabia",
    city: "Jeddah",
    vacancies: 8,
    salaryMin: SAR(1400),
    salaryMax: SAR(1900),
    contractDurationMonths: 24,
    description:
      "Fit and repair pipework, fixtures and drainage systems for residential and commercial buildings.",
    requirements:
      "2+ years plumbing experience\nFamiliar with PPR and PVC fitting\nPhysically fit",
    benefits:
      "Accommodation and transport provided. Medical coverage included.",
    postedDaysAgo: 3,
  },
  {
    title: "Steel Fixer",
    sector: "CONSTRUCTION",
    trade: "Steel Fixer",
    country: "Qatar",
    city: "Doha",
    vacancies: 10,
    salaryMin: SAR(1600),
    salaryMax: SAR(2100),
    contractDurationMonths: 18,
    description:
      "Cut, bend and fix steel reinforcement bars for concrete structures on major infrastructure projects.",
    requirements:
      "Experience reading bar bending schedules\n2 years on-site experience\nSafety conscious",
    benefits:
      "Employer-provided housing, meals allowance and transportation. Medical insurance.",
    postedDaysAgo: 6,
  },
  {
    title: "Caregiver",
    sector: "HEALTHCARE_SUPPORT",
    trade: "Caregiver",
    country: "Saudi Arabia",
    city: "Dammam",
    vacancies: 6,
    salaryMin: SAR(1500),
    salaryMax: SAR(2000),
    contractDurationMonths: 24,
    description:
      "Provide personal care and daily-living support to elderly and recovering patients in a home-care setting.",
    requirements:
      "Caregiving or nursing-aide certificate\nCompassionate and patient\nBasic English communication",
    benefits:
      "Accommodation, food and medical insurance provided by the employer.",
    postedDaysAgo: 9,
  },
  {
    title: "Staff Nurse",
    sector: "NURSING",
    trade: "Nurse",
    country: "United Arab Emirates",
    city: "Abu Dhabi",
    vacancies: 4,
    salaryMin: SAR(3500),
    salaryMax: SAR(5000),
    contractDurationMonths: 36,
    description:
      "Deliver patient care in a busy multi-specialty hospital. Administer medication, monitor vitals and support physicians.",
    requirements:
      "BSc Nursing\nValid nursing license\nMinimum 2 years hospital experience\nDHA/HAAD eligibility preferred",
    benefits:
      "Hospital accommodation, full medical cover and transport. Annual leave with air ticket.",
    postedDaysAgo: 4,
  },
  {
    title: "Laboratory Technician",
    sector: "MEDICAL_PROFESSIONALS",
    trade: "Lab Technician",
    country: "Saudi Arabia",
    city: "Riyadh",
    vacancies: 3,
    salaryMin: SAR(3000),
    salaryMax: SAR(4200),
    contractDurationMonths: 24,
    description:
      "Perform clinical laboratory tests, analyse samples and maintain lab equipment to support diagnosis.",
    requirements:
      "Diploma or degree in Medical Lab Technology\nExperience with automated analysers\nAttention to detail",
    benefits:
      "Medical insurance and transport allowance provided. Housing allowance.",
    postedDaysAgo: 12,
  },
  {
    title: "HVAC Technician",
    sector: "CONSTRUCTION",
    trade: "HVAC Technician",
    country: "Kuwait",
    city: "Kuwait City",
    vacancies: 5,
    salaryMin: SAR(1700),
    salaryMax: SAR(2300),
    contractDurationMonths: 24,
    description:
      "Install and service air-conditioning and refrigeration units in commercial buildings.",
    requirements:
      "3 years HVAC experience\nKnowledge of chillers and split units\nTrade certificate",
    benefits:
      "Accommodation, transport and medical insurance provided.",
    postedDaysAgo: 2,
  },
  {
    title: "IT Support Engineer",
    sector: "DATA_TECHNOLOGY",
    trade: "IT Support",
    country: "Saudi Arabia",
    city: "Riyadh",
    vacancies: 2,
    salaryMin: SAR(4000),
    salaryMax: SAR(6000),
    contractDurationMonths: 36,
    description:
      "Provide first- and second-line IT support, manage user accounts and maintain network hardware.",
    requirements:
      "Degree in IT or related field\n2+ years support experience\nWindows & networking fundamentals\nEnglish fluency",
    benefits:
      "Housing allowance, medical insurance and annual air ticket. Transport provided.",
    postedDaysAgo: 5,
  },
];

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: jobCountRows } = await client.query(
      "select count(*)::int as n from job_posts",
    );
    if (jobCountRows[0].n > 0) {
      console.log(`job_posts already has ${jobCountRows[0].n} rows — skipping seed.`);
      return;
    }

    // Demo employer (public.users → saudi_client_profiles). No Supabase auth row
    // is needed: public.users has no FK to auth.users.
    const { rows: existingClient } = await client.query(
      "select scp.id from saudi_client_profiles scp join users u on u.id = scp.user_id where u.email = $1",
      [CLIENT_EMAIL],
    );

    let clientId;
    if (existingClient.length > 0) {
      clientId = existingClient[0].id;
      console.log("Reusing existing demo client:", clientId);
    } else {
      const { rows: userRows } = await client.query(
        `insert into users (id, email, password_hash, role, is_email_verified, created_at, updated_at)
         values (gen_random_uuid(), $1, 'supabase-auth-managed', 'SAUDI_CLIENT', true, now(), now())
         returning id`,
        [CLIENT_EMAIL],
      );
      const userId = userRows[0].id;
      const { rows: clientRows } = await client.query(
        `insert into saudi_client_profiles (id, user_id, company_name, country, city, contact_name, contact_phone, created_at, updated_at)
         values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now(), now())
         returning id`,
        [userId, "Al Faisal Contracting Co.", "Saudi Arabia", "Riyadh", "Khalid Al Faisal", "+966500000000"],
      );
      clientId = clientRows[0].id;
      console.log("Created demo client:", clientId);
    }

    let inserted = 0;
    for (const j of JOBS) {
      await client.query(
        `insert into job_posts
           (id, saudi_client_id, title, description, sector, trade, country, city, vacancies,
            salary_min, salary_max, salary_currency, benefits, requirements,
            contract_duration_months, deadline, status, published_at, created_at, updated_at)
         values
           (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, 'SAR', $11, $12,
            $13, $14, 'ACTIVE', $15, now(), now())`,
        [
          clientId,
          j.title,
          j.description,
          j.sector,
          j.trade,
          j.country,
          j.city,
          j.vacancies,
          j.salaryMin,
          j.salaryMax,
          j.benefits,
          j.requirements,
          j.contractDurationMonths,
          daysFromNow(45),
          daysAgo(j.postedDaysAgo),
        ],
      );
      inserted += 1;
    }
    console.log(`Inserted ${inserted} active jobs.`);

    const { rows: countries } = await client.query(
      "select country, count(*)::int n from job_posts where status='ACTIVE' group by country order by country",
    );
    console.log("Active job countries:", JSON.stringify(countries));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
