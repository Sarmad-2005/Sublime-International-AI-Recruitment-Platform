/**
 * Seed a Stage-1 trade assessment (M4) for every job that doesn't have one.
 *
 * Without this, the assessment entry screen shows "No assessment yet" because
 * the apply flow only creates applications — nothing provisions a
 * `TradeAssessment` or its questions. This attaches a generic safety / trade
 * knowledge assessment (6 questions) to each job so the take/submit/result
 * flow has real data.
 *
 * Option/answer JSON matches what the assessment service parses:
 *   options:        [{ id, text }]            (image options also allow imageUrl)
 *   correct_answers: ["<option id>", ...]      (one id for single-answer types)
 *
 * Idempotent: skips any job that already has an assessment.
 *
 *   node prisma/seed-assessments.mjs
 */
import "dotenv/config";
import pg from "pg";

/** id prefixes keep option ids stable & unique per question. */
const QUESTIONS = [
  {
    type: "MCQ",
    text: "What should you always wear when working on a construction site?",
    options: [
      { id: "o1", text: "A hard hat and appropriate PPE" },
      { id: "o2", text: "Sandals for comfort" },
      { id: "o3", text: "Only sunglasses" },
      { id: "o4", text: "No special equipment is needed" },
    ],
    correct: ["o1"],
  },
  {
    type: "MCQ",
    text: "Before operating electrical equipment, you should first:",
    options: [
      { id: "o1", text: "Check it for damage and ensure it is properly grounded" },
      { id: "o2", text: "Start it immediately to save time" },
      { id: "o3", text: "Remove the safety guards" },
      { id: "o4", text: "Ignore the manufacturer's instructions" },
    ],
    correct: ["o1"],
  },
  {
    type: "MULTI_SELECT",
    text: "Which of the following are Personal Protective Equipment (PPE)? Select all that apply.",
    options: [
      { id: "o1", text: "Safety gloves" },
      { id: "o2", text: "Hard hat" },
      { id: "o3", text: "Mobile phone" },
      { id: "o4", text: "Safety boots" },
    ],
    correct: ["o1", "o2", "o4"],
  },
  {
    type: "SCENARIO",
    text: "You notice a frayed electrical cable on the equipment you are about to use. What is the safest action?",
    options: [
      { id: "o1", text: "Stop, tag it out, and report it to your supervisor" },
      { id: "o2", text: "Keep using it carefully" },
      { id: "o3", text: "Wrap tape over it and continue" },
      { id: "o4", text: "Ignore it — it's not your job" },
    ],
    correct: ["o1"],
  },
  {
    type: "MCQ",
    text: "The correct way to lift a heavy object is to:",
    options: [
      { id: "o1", text: "Bend your knees and keep your back straight" },
      { id: "o2", text: "Bend at the waist with straight legs" },
      { id: "o3", text: "Lift quickly with one hand" },
      { id: "o4", text: "Twist your body while lifting" },
    ],
    correct: ["o1"],
  },
  {
    type: "MCQ",
    text: "A water-based fire extinguisher is suitable for fires involving:",
    options: [
      { id: "o1", text: "Ordinary combustibles such as wood and paper" },
      { id: "o2", text: "Live electrical equipment" },
      { id: "o3", text: "Cooking oil" },
      { id: "o4", text: "Flammable gas" },
    ],
    correct: ["o1"],
  },
];

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: jobs } = await client.query(
      `select jp.id, jp.title
         from job_posts jp
         left join trade_assessments ta on ta.job_post_id = jp.id
        where ta.id is null`,
    );

    if (jobs.length === 0) {
      console.log("Every job already has an assessment — nothing to seed.");
      return;
    }

    let created = 0;
    for (const job of jobs) {
      const { rows: assessmentRows } = await client.query(
        `insert into trade_assessments
           (id, job_post_id, title, description, time_limit_minutes, passing_score,
            total_questions, allow_retake, retake_cooldown_days, randomize_questions,
            randomize_answers, is_active, created_at, updated_at)
         values
           (gen_random_uuid(), $1, $2, $3, 10, 60, $4, true, 0, true, true, true, now(), now())
         returning id`,
        [
          job.id,
          `${job.title} — Trade Assessment`,
          "A short workplace-safety and trade-knowledge screening. You need 60% to pass and advance to the AI interview.",
          QUESTIONS.length,
        ],
      );
      const assessmentId = assessmentRows[0].id;

      for (let i = 0; i < QUESTIONS.length; i++) {
        const q = QUESTIONS[i];
        await client.query(
          `insert into assessment_questions
             (id, assessment_id, type, question_text, image_url, options, correct_answers,
              points, order_index, created_at, updated_at)
           values
             (gen_random_uuid(), $1, $2::question_type, $3, null, $4::jsonb, $5::jsonb, 1, $6, now(), now())`,
          [
            assessmentId,
            q.type,
            q.text,
            JSON.stringify(q.options),
            JSON.stringify(q.correct),
            i + 1,
          ],
        );
      }
      created += 1;
      console.log(`Seeded assessment for "${job.title}" (${QUESTIONS.length} questions).`);
    }

    console.log(`Done — created ${created} assessment(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
