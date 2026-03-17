



// import { supabase } from "../config/supabase.js";
// import { startPromptDiscovery } from "../services/aeo/aeoPrompt.service.js";

// // ─────────────────────────────────────────
// // AEO PROMPT DISCOVERY JOB
// // Triggered after website crawl completes.
// // Checks plan tier and generates prompts accordingly:
// //   starter → 50 prompts, user picks up to 20
// //   pro     → 100 prompts, user picks up to 50
// // ─────────────────────────────────────────
// export const runPromptDiscoveryJob = async (planId) => {
//   console.log(`\n🚀 [PromptDiscoveryJob] Starting for plan: ${planId}`);

//   if (!planId) {
//     console.error("❌ [PromptDiscoveryJob] No planId provided — aborting");
//     return;
//   }

//   // Verify plan exists and is in the right state
//   const { data: plan, error: planErr } = await supabase
//     .from("plans")
//     .select("id, name, tier, pipeline_status, prompts_approved")
//     .eq("id", planId)
//     .single();

//   if (planErr || !plan) {
//     console.error(`❌ [PromptDiscoveryJob] Plan not found: ${planErr?.message}`);
//     return;
//   }

//   // Skip if prompts already approved — don't regenerate
//   if (plan.prompts_approved) {
//     console.log(`⏭️  [PromptDiscoveryJob] Prompts already approved for "${plan.name}" — skipping`);
//     return;
//   }

//   // Skip if already waiting for review (job fired twice)
//   if (plan.pipeline_status === "awaiting_prompt_review") {
//     console.log(`⏭️  [PromptDiscoveryJob] Already awaiting review for "${plan.name}" — skipping`);
//     return;
//   }

//   console.log(`📋 Plan: "${plan.name}" | Tier: ${plan.tier}`);

//   try {
//     await startPromptDiscovery(planId);
//     console.log(`✅ [PromptDiscoveryJob] Complete for plan: ${planId}`);
//   } catch (err) {
//     console.error(`❌ [PromptDiscoveryJob] Failed for plan ${planId}:`, err.message);

//     // Mark pipeline as errored so it can be retried
//     await supabase
//       .from("plans")
//       .update({ pipeline_status: "prompt_discovery_error" })
//       .eq("id", planId);
//   }
// };

// // ─────────────────────────────────────────
// // SCHEDULED: WEEKLY PROMPT REFRESH
// // Runs for all active plans to surface new
// // prompt suggestions based on gap analysis.
// // Called by cron — not triggered per-plan.
// // ─────────────────────────────────────────
// export const runWeeklyPromptRefreshJob = async () => {
//   console.log("\n🔄 [WeeklyPromptRefresh] Starting...");

//   // Only refresh plans that have approved prompts and are actively running
//   const { data: plans, error } = await supabase
//     .from("plans")
//     .select("id, name, tier")
//     .eq("prompts_approved", true)
//     .eq("pipeline_status", "running");

//   if (error) {
//     console.error("❌ [WeeklyPromptRefresh] Failed to load plans:", error.message);
//     return;
//   }

//   if (!plans?.length) {
//     console.log("⏭️  [WeeklyPromptRefresh] No active plans found");
//     return;
//   }

//   console.log(`📋 [WeeklyPromptRefresh] Processing ${plans.length} plans...`);

//   const { suggestNewPrompts } = await import("../services/aeo/aeoPrompt.service.js");

//   for (const plan of plans) {
//     try {
//       console.log(`\n💡 Suggesting prompts for: "${plan.name}" (${plan.tier})`);
//       await suggestNewPrompts(plan.id);
//     } catch (err) {
//       console.error(`❌ Suggestion failed for plan "${plan.name}":`, err.message);
//     }
//   }

//   console.log("\n✅ [WeeklyPromptRefresh] Complete");
// };





import { supabase } from "../config/supabase.js";
import { startPromptDiscovery } from "../services/aeo/aeoPrompt.service.js";

// ─────────────────────────────────────────
// GET EFFECTIVE PLAN LIMITS
// Source of truth: billing_profiles.current_plan_slug
// Fallback: plans.tier → pricing_plans lookup
// ─────────────────────────────────────────
async function getEffectivePlanLimits(userId, fallbackTier = "free") {
  // 1. Get current plan slug from billing_profiles
  const { data: billing } = await supabase
    .from("billing_profiles")
    .select("current_plan_slug, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  const isActive = !billing?.subscription_status ||
    ["active", "trial", "created"].includes(billing.subscription_status);

  const effectiveSlug = (isActive && billing?.current_plan_slug)
    ? billing.current_plan_slug
    : fallbackTier;

  // 2. Pull limits live from pricing_plans
  const { data: pricingPlan } = await supabase
    .from("pricing_plans")
    .select("prompts_generate, prompts_select_max, prompts_select_min, competitors_limit, pages_limit, engines")
    .eq("slug", effectiveSlug)
    .eq("is_active", true)
    .maybeSingle();

  // Fallback to free limits if slug not found
  return {
    tier:               effectiveSlug,
    promptsGenerate:    pricingPlan?.prompts_generate    ?? 20,
    promptsSelectMax:   pricingPlan?.prompts_select_max  ?? 10,
    promptsSelectMin:   pricingPlan?.prompts_select_min  ?? 3,
    competitorsLimit:   pricingPlan?.competitors_limit   ?? 3,
    pagesLimit:         pricingPlan?.pages_limit         ?? 5,
    engines:            pricingPlan?.engines             ?? ["gemini"],
  };
}

// ─────────────────────────────────────────
// AEO PROMPT DISCOVERY JOB
// Triggered after website crawl completes.
// Limits come from billing_profiles → pricing_plans (live)
//   free    → 20 prompts,  picks up to 10
//   starter → 50 prompts,  picks up to 20
//   pro     → 100 prompts, picks up to 50
// ─────────────────────────────────────────
export const runPromptDiscoveryJob = async (planId) => {
  console.log(`\n🚀 [PromptDiscoveryJob] Starting for plan: ${planId}`);

  if (!planId) {
    console.error("❌ [PromptDiscoveryJob] No planId provided — aborting");
    return;
  }

  // Fetch plan + user_id
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("id, name, tier, user_id, pipeline_status, prompts_approved")
    .eq("id", planId)
    .single();

  if (planErr || !plan) {
    console.error(`❌ [PromptDiscoveryJob] Plan not found: ${planErr?.message}`);
    return;
  }

  // Skip if prompts already approved — don't regenerate
  if (plan.prompts_approved) {
    console.log(`⏭️  [PromptDiscoveryJob] Prompts already approved for "${plan.name}" — skipping`);
    return;
  }

  // Skip if already waiting for review (job fired twice)
  if (plan.pipeline_status === "awaiting_prompt_review") {
    console.log(`⏭️  [PromptDiscoveryJob] Already awaiting review for "${plan.name}" — skipping`);
    return;
  }

  // Get live limits from billing_profiles → pricing_plans
  const limits = await getEffectivePlanLimits(plan.user_id, plan.tier);

  console.log(`📋 Plan: "${plan.name}" | Tier: ${limits.tier} | Generate: ${limits.promptsGenerate} | Select max: ${limits.promptsSelectMax}`);

  // Sync limits onto the plan row so downstream jobs don't need to re-fetch
  await supabase
    .from("plans")
    .update({
      tier:                  limits.tier,
      prompts_generate_count: limits.promptsGenerate,
      prompt_select_max:     limits.promptsSelectMax,
      prompt_select_min:     limits.promptsSelectMin,
      updated_at:            new Date().toISOString(),
    })
    .eq("id", planId);

  try {
    await startPromptDiscovery(planId);
    console.log(`✅ [PromptDiscoveryJob] Complete for plan: ${planId}`);
  } catch (err) {
    console.error(`❌ [PromptDiscoveryJob] Failed for plan ${planId}:`, err.message);

    await supabase
      .from("plans")
      .update({ pipeline_status: "prompt_discovery_error" })
      .eq("id", planId);
  }
};

// ─────────────────────────────────────────
// SCHEDULED: WEEKLY PROMPT REFRESH
// Runs for all active plans to surface new
// prompt suggestions based on gap analysis.
// Called by cron — not triggered per-plan.
// ─────────────────────────────────────────
export const runWeeklyPromptRefreshJob = async () => {
  console.log("\n🔄 [WeeklyPromptRefresh] Starting...");

  // Only refresh plans that have approved prompts and are actively running
  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, name, tier, user_id")
    .eq("prompts_approved", true)
    .eq("pipeline_status", "running");

  if (error) {
    console.error("❌ [WeeklyPromptRefresh] Failed to load plans:", error.message);
    return;
  }

  if (!plans?.length) {
    console.log("⏭️  [WeeklyPromptRefresh] No active plans found");
    return;
  }

  console.log(`📋 [WeeklyPromptRefresh] Processing ${plans.length} plans...`);

  const { suggestNewPrompts } = await import("../services/aeo/aeoPrompt.service.js");

  for (const plan of plans) {
    try {
      // Get live limits for each plan individually
      const limits = await getEffectivePlanLimits(plan.user_id, plan.tier);
      console.log(`\n💡 Suggesting prompts for: "${plan.name}" (${limits.tier})`);
      await suggestNewPrompts(plan.id, limits);
    } catch (err) {
      console.error(`❌ Suggestion failed for plan "${plan.name}":`, err.message);
    }
  }

  console.log("\n✅ [WeeklyPromptRefresh] Complete");
};