



import cron    from "node-cron";
import { supabase } from "../config/supabase.js";

// ── INDEPENDENT JOBS (no pipeline dependency) ──
import { runAnswerJob }           from "../jobs/aeoAnswer.job.js";
import { runVisibilityJob }     from "../jobs/aeoVisibility.job.js";
import { runAeoGapJob }           from "../jobs/aeoGap.job.js";
import { runRecommendationJob }   from "../jobs/aeoRecommendation.job.js";
import { runAeoScoreJob }         from "../jobs/aeoScore.job.js";
import { runAeoScoreExplainJob }  from "../jobs/aeoScoreExplain.job.js";
import { buildCompetitorSummary } from "../jobs/aeoCompetitorSummary.job.js";
import { suggestNewPrompts }      from "../services/aeo/aeoPrompt.service.js";
import { runSchemaJob }        from "../jobs/aeoSchema.job.js";

const CONCURRENT_PLANS      = 3;
const DELAY_BETWEEN_BATCHES = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────
// LOG TO aeo_cron_logs
// ─────────────────────────────────────────
async function logCronRun(cronName, total, success, failed, durationSecs) {
  await supabase.from("aeo_cron_logs").insert({
    cron_name:     cronName,
    plans_total:   total,
    plans_success: success,
    plans_failed:  failed,
    duration_secs: durationSecs,
    ran_at:        new Date().toISOString(),
  });
}

// ─────────────────────────────────────────
// SAFE JOB RUNNER
// Catches errors so one job failure doesn't
// stop the rest of the plan's jobs
// ─────────────────────────────────────────
async function safeRun(jobName, planId, planName, fn) {
  try {
    console.log(`      ▶️  [${jobName}]`);
    await fn();
    console.log(`      ✅ [${jobName}] done`);
  } catch (err) {
    console.error(`      ❌ [${jobName}] failed: ${err.message}`);
  }
}

// ─────────────────────────────────────────
// PROCESS SINGLE PLAN
// Runs all jobs independently — one failure
// doesn't block the others
// ─────────────────────────────────────────
async function processPlan(plan) {
  const start = Date.now();
  console.log(`\n   🚀 "${plan.name}" [${plan.tier}]`);

  try {
    // 1. Generate AI answers for active prompts
    await safeRun("AnswerJob", plan.id, plan.name, () =>
      runAnswerJob(plan.id)
    );
    await sleep(2000);

    // 2. Track brand + competitor visibility
    await safeRun("VisibilityJob", plan.id, plan.name, () =>
      runVisibilityJob(plan.id)
    );
    await sleep(2000);

    // 3. Find queries where brand is missing
    await safeRun("GapJob", plan.id, plan.name, () =>
      runAeoGapJob(plan.id)
    );
    await sleep(1000);

    // 4. Generate recommendations for each gap
    await safeRun("RecommendationJob", plan.id, plan.name, () =>
      runRecommendationJob(plan.id)
    );
    await sleep(1000);

    // 5. Update competitor visibility summary
    await safeRun("CompetitorSummary", plan.id, plan.name, () =>
      buildCompetitorSummary(plan.id)
    );
    await sleep(1000);

    // 6. Calculate + INSERT new score (keeps history for graph)
    await safeRun("ScoreJob", plan.id, plan.name, () =>
      runAeoScoreJob(plan.id)
    );
    await sleep(1000);

    // 7. AI score explanation
    await safeRun("ScoreExplainJob", plan.id, plan.name, () =>
      runAeoScoreExplainJob(plan.id)
    );

    // 8. Update tracking timestamp
    await supabase
      .from("plans")
      .update({ last_daily_tracking: new Date().toISOString() })
      .eq("id", plan.id);

    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n   ✅ "${plan.name}" done in ${secs}s`);
    return { name: plan.name, status: "success" };

  } catch (err) {
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\n   ❌ "${plan.name}" failed after ${secs}s: ${err.message}`);
    return { name: plan.name, status: "failed", error: err.message };
  }
}

// ─────────────────────────────────────────
// PROCESS SINGLE PLAN — WEEKLY JOBS
// Schema + prompt suggestions (run less often)
// ─────────────────────────────────────────
async function processWeeklyPlan(plan) {
  console.log(`\n   📅 Weekly: "${plan.name}" [${plan.tier}]`);

  // Schema job — every Sunday
  await safeRun("SchemaJob", plan.id, plan.name, () =>
    runSchemaJob(plan.id)
  );
  await sleep(2000);

  // Prompt suggestions — every Monday (called separately)
  await supabase
    .from("plans")
    .update({ last_weekly_refresh: new Date().toISOString() })
    .eq("id", plan.id);
}

// ─────────────────────────────────────────
// GET ACTIVE PLANS
// Only plans with approved prompts that
// are not currently mid-pipeline
// ─────────────────────────────────────────
async function getEligiblePlans() {
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, tier, subscription_status, pipeline_status, prompts_approved, last_daily_tracking")
    .eq("prompts_approved", true)
    .in("subscription_status", ["active", "trial"])
    .in("tier", ["starter", "pro"])
    .neq("pipeline_status", "running");

  if (error) {
    console.error("❌ Failed to fetch eligible plans:", error.message);
    return [];
  }

  return data || [];
}

// ─────────────────────────────────────────
// DAILY VISIBILITY — runs at 02:00 UTC
// ─────────────────────────────────────────
async function runDailyVisibility() {
  console.log("\n🌐 [dailyVisibility] Starting...");
  const runStart = Date.now();

  const plans = await getEligiblePlans();

  if (!plans.length) {
    console.log("ℹ️  [dailyVisibility] No eligible plans");
    return;
  }

  console.log(`📋 [dailyVisibility] ${plans.length} plan(s) | batches of ${CONCURRENT_PLANS}`);

  let success = 0;
  let failed  = 0;

  for (let i = 0; i < plans.length; i += CONCURRENT_PLANS) {
    const batch    = plans.slice(i, i + CONCURRENT_PLANS);
    const batchNum = Math.floor(i / CONCURRENT_PLANS) + 1;
    const total    = Math.ceil(plans.length / CONCURRENT_PLANS);

    console.log(`\n📦 Batch ${batchNum}/${total}: ${batch.map((p) => p.name).join(", ")}`);

    const results = await Promise.all(batch.map(processPlan));

    for (const r of results) {
      r.status === "success" ? success++ : failed++;
    }

    if (i + CONCURRENT_PLANS < plans.length) {
      console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  const durationSecs = ((Date.now() - runStart) / 1000).toFixed(1);

  await logCronRun("dailyVisibility", plans.length, success, failed, parseFloat(durationSecs));

  console.log(`\n✅ [dailyVisibility] Done in ${durationSecs}s`);
  console.log(`   Success: ${success} | Failed: ${failed}`);
}

// ─────────────────────────────────────────
// WEEKLY SCHEMA — runs every Sunday 03:00 UTC
// ─────────────────────────────────────────
async function runWeeklySchema() {
  console.log("\n📅 [weeklySchema] Starting...");
  const runStart = Date.now();

  const plans = await getEligiblePlans();

  if (!plans.length) {
    console.log("ℹ️  [weeklySchema] No eligible plans");
    return;
  }

  let success = 0;
  let failed  = 0;

  for (const plan of plans) {
    try {
      await safeRun("SchemaJob", plan.id, plan.name, () =>
        runSchemaJob(plan.id)
      );
      success++;
    } catch {
      failed++;
    }
    await sleep(3000);
  }

  const durationSecs = ((Date.now() - runStart) / 1000).toFixed(1);
  await logCronRun("weeklySchema", plans.length, success, failed, parseFloat(durationSecs));

  console.log(`✅ [weeklySchema] Done in ${durationSecs}s | Success: ${success} | Failed: ${failed}`);
}

// ─────────────────────────────────────────
// WEEKLY PROMPT SUGGESTIONS — runs every Monday 04:00 UTC
// ─────────────────────────────────────────
async function runWeeklyPromptSuggestions() {
  console.log("\n💡 [weeklyPrompts] Starting...");
  const runStart = Date.now();

  const plans = await getEligiblePlans();

  if (!plans.length) {
    console.log("ℹ️  [weeklyPrompts] No eligible plans");
    return;
  }

  let success = 0;
  let failed  = 0;

  for (const plan of plans) {
    try {
      await safeRun("PromptSuggestions", plan.id, plan.name, () =>
        suggestNewPrompts(plan.id)
      );
      success++;
    } catch {
      failed++;
    }
    await sleep(2000);
  }

  const durationSecs = ((Date.now() - runStart) / 1000).toFixed(1);
  await logCronRun("weeklyPrompts", plans.length, success, failed, parseFloat(durationSecs));

  console.log(`✅ [weeklyPrompts] Done in ${durationSecs}s | Success: ${success} | Failed: ${failed}`);
}

// ─────────────────────────────────────────
// REGISTER ALL AEO CRONS
// ─────────────────────────────────────────
export function startDailyVisibilityCron() {
  // Daily tracking — 02:00 UTC
  console.log("📅 [dailyVisibility]    daily at 02:00 UTC");
  cron.schedule("0 2 * * *", async () => {
    console.log(`\n🕑 [dailyVisibility] ${new Date().toISOString()}`);
    await runDailyVisibility();
  }, { timezone: "UTC" });

  // Weekly schema — every Sunday 03:00 UTC
  console.log("📅 [weeklySchema]       every Sunday at 03:00 UTC");
  cron.schedule("0 3 * * 0", async () => {
    console.log(`\n🕒 [weeklySchema] ${new Date().toISOString()}`);
    await runWeeklySchema();
  }, { timezone: "UTC" });

  // Weekly prompt suggestions — every Monday 04:00 UTC
  console.log("📅 [weeklyPrompts]      every Monday at 04:00 UTC");
  cron.schedule("0 4 * * 1", async () => {
    console.log(`\n🕓 [weeklyPrompts] ${new Date().toISOString()}`);
    await runWeeklyPromptSuggestions();
  }, { timezone: "UTC" });

  // Health check — every hour
  cron.schedule("0 * * * *", async () => {
    const plans = await getEligiblePlans();
    console.log(`💓 [health] ${plans.length} active plan(s) | ${new Date().toISOString()}`);
  });
}

export { runDailyVisibility, runWeeklySchema, runWeeklyPromptSuggestions };