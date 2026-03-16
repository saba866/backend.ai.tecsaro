


import { supabase } from "../config/supabase.js"

import { runAnswerJob }           from "../jobs/aeoAnswer.job.js"
import { runVisibilityJob }       from "../jobs/aeoVisibility.job.js"
import { runAeoGapJob }           from "../jobs/aeoGap.job.js"
import { runRecommendationJob }   from "../jobs/aeoRecommendation.job.js"
import { runAeoScoreJob }         from "../jobs/aeoScore.job.js"
import { runAeoScoreExplainJob }  from "../jobs/aeoScoreExplain.job.js"
import { buildCompetitorSummary } from "../jobs/aeoCompetitorSummary.job.js"
import { suggestNewPrompts }      from "../services/aeo/aeoPrompt.service.js"

const CONCURRENT_PLANS      = 3
const DELAY_BETWEEN_BATCHES = 5000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function logCronRun(cronName, total, success, failed, durationSecs) {
  await supabase.from("aeo_cron_logs").insert({
    cron_name:     cronName,
    plans_total:   total,
    plans_success: success,
    plans_failed:  failed,
    duration_secs: durationSecs,
    ran_at:        new Date().toISOString(),
  })
}

async function safeRun(jobName, planId, planName, fn) {
  try {
    console.log(`      ▶️  [${jobName}]`)
    await fn()
    console.log(`      ✅ [${jobName}] done`)
  } catch (err) {
    console.error(`      ❌ [${jobName}] failed: ${err.message}`)
  }
}

async function getEligiblePlans() {
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, tier, subscription_status, pipeline_status, prompts_approved, last_daily_tracking")
    .eq("prompts_approved", true)
    .in("subscription_status", ["active", "trial"])
    .in("tier", ["starter", "pro"])
    .neq("pipeline_status", "running")

  if (error) {
    console.error("❌ Failed to fetch eligible plans:", error.message)
    return []
  }
  return data || []
}

// ─────────────────────────────────────────
// DAILY VISIBILITY ONLY
// Runs: visibility + score + explain
// Schedule: daily 02:00 UTC
// ─────────────────────────────────────────
async function processDailyVisibilityPlan(plan) {
  const start = Date.now()
  console.log(`\n   🚀 "${plan.name}" [${plan.tier}]`)

  try {
    await safeRun("VisibilityJob",   plan.id, plan.name, () => runVisibilityJob(plan.id))
    await sleep(1000)
    await safeRun("ScoreJob",        plan.id, plan.name, () => runAeoScoreJob(plan.id))
    await sleep(1000)
    await safeRun("ScoreExplainJob", plan.id, plan.name, () => runAeoScoreExplainJob(plan.id))

    await supabase.from("plans")
      .update({ last_daily_tracking: new Date().toISOString() })
      .eq("id", plan.id)

    const secs = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`\n   ✅ "${plan.name}" done in ${secs}s`)
    return { name: plan.name, status: "success" }
  } catch (err) {
    console.error(`\n   ❌ "${plan.name}" failed: ${err.message}`)
    return { name: plan.name, status: "failed", error: err.message }
  }
}

export async function runDailyVisibility() {
  console.log("\n🌐 [dailyVisibility] Starting...")
  const runStart = Date.now()

  const plans = await getEligiblePlans()
  if (!plans.length) {
    console.log("ℹ️  [dailyVisibility] No eligible plans")
    return { success: 0, failed: 0 }
  }

  console.log(`📋 [dailyVisibility] ${plans.length} plan(s) | batches of ${CONCURRENT_PLANS}`)

  let success = 0, failed = 0

  for (let i = 0; i < plans.length; i += CONCURRENT_PLANS) {
    const batch    = plans.slice(i, i + CONCURRENT_PLANS)
    const batchNum = Math.floor(i / CONCURRENT_PLANS) + 1
    const total    = Math.ceil(plans.length / CONCURRENT_PLANS)

    console.log(`\n📦 Batch ${batchNum}/${total}: ${batch.map((p) => p.name).join(", ")}`)
    const results = await Promise.all(batch.map(processDailyVisibilityPlan))
    for (const r of results) r.status === "success" ? success++ : failed++

    if (i + CONCURRENT_PLANS < plans.length) {
      console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s...`)
      await sleep(DELAY_BETWEEN_BATCHES)
    }
  }

  const durationSecs = ((Date.now() - runStart) / 1000).toFixed(1)
  await logCronRun("dailyVisibility", plans.length, success, failed, parseFloat(durationSecs))
  console.log(`\n✅ [dailyVisibility] Done in ${durationSecs}s | Success: ${success} | Failed: ${failed}`)
  return { success, failed }
}

// ─────────────────────────────────────────
// MONTHLY FULL PIPELINE
// Runs: answers + visibility + gaps +
//       recommendations + competitor summary +
//       score + explain + prompts
// NO schema job — removed
// Schedule: 1st of month 03:00 UTC
// ─────────────────────────────────────────
async function processFullPipelinePlan(plan) {
  const start = Date.now()
  console.log(`\n   🚀 Full pipeline: "${plan.name}" [${plan.tier}]`)

  try {
    await safeRun("AnswerJob",         plan.id, plan.name, () => runAnswerJob(plan.id))
    await sleep(2000)
    await safeRun("VisibilityJob",     plan.id, plan.name, () => runVisibilityJob(plan.id))
    await sleep(2000)
    await safeRun("GapJob",            plan.id, plan.name, () => runAeoGapJob(plan.id))
    await sleep(1000)
    await safeRun("RecommendationJob", plan.id, plan.name, () => runRecommendationJob(plan.id))
    await sleep(1000)
    await safeRun("CompetitorSummary", plan.id, plan.name, () => buildCompetitorSummary(plan.id))
    await sleep(1000)
    await safeRun("ScoreJob",          plan.id, plan.name, () => runAeoScoreJob(plan.id))
    await sleep(1000)
    await safeRun("ScoreExplainJob",   plan.id, plan.name, () => runAeoScoreExplainJob(plan.id))
    await sleep(2000)
    await safeRun("PromptSuggestions", plan.id, plan.name, () => suggestNewPrompts(plan.id))

    await supabase.from("plans").update({
      last_daily_tracking:   new Date().toISOString(),
      last_weekly_refresh:   new Date().toISOString(),
      last_monthly_pipeline: new Date().toISOString(),
    }).eq("id", plan.id)

    const secs = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`\n   ✅ "${plan.name}" full pipeline done in ${secs}s`)
    return { name: plan.name, status: "success" }
  } catch (err) {
    console.error(`\n   ❌ "${plan.name}" full pipeline failed: ${err.message}`)
    return { name: plan.name, status: "failed", error: err.message }
  }
}

export async function runMonthlyFullPipeline() {
  console.log("\n🔧 [monthlyPipeline] Starting full pipeline...")
  const runStart = Date.now()

  const plans = await getEligiblePlans()
  if (!plans.length) {
    console.log("ℹ️  [monthlyPipeline] No eligible plans")
    return { success: 0, failed: 0 }
  }

  console.log(`📋 [monthlyPipeline] ${plans.length} plan(s) | batches of ${CONCURRENT_PLANS}`)

  let success = 0, failed = 0

  for (let i = 0; i < plans.length; i += CONCURRENT_PLANS) {
    const batch    = plans.slice(i, i + CONCURRENT_PLANS)
    const batchNum = Math.floor(i / CONCURRENT_PLANS) + 1
    const total    = Math.ceil(plans.length / CONCURRENT_PLANS)

    console.log(`\n📦 Batch ${batchNum}/${total}: ${batch.map((p) => p.name).join(", ")}`)
    const results = await Promise.all(batch.map(processFullPipelinePlan))
    for (const r of results) r.status === "success" ? success++ : failed++

    if (i + CONCURRENT_PLANS < plans.length) {
      console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s...`)
      await sleep(DELAY_BETWEEN_BATCHES)
    }
  }

  const durationSecs = ((Date.now() - runStart) / 1000).toFixed(1)
  await logCronRun("monthlyPipeline", plans.length, success, failed, parseFloat(durationSecs))
  console.log(`\n✅ [monthlyPipeline] Done in ${durationSecs}s | Success: ${success} | Failed: ${failed}`)
  return { success, failed }
}