



import { supabase } from "../config/supabase.js";
import { startPromptDiscovery } from "../services/aeo/aeoPrompt.service.js";

// ─────────────────────────────────────────
// AEO PROMPT DISCOVERY JOB
// Triggered after website crawl completes.
// Checks plan tier and generates prompts accordingly:
//   starter → 50 prompts, user picks up to 20
//   pro     → 100 prompts, user picks up to 50
// ─────────────────────────────────────────
export const runPromptDiscoveryJob = async (planId) => {
  console.log(`\n🚀 [PromptDiscoveryJob] Starting for plan: ${planId}`);

  if (!planId) {
    console.error("❌ [PromptDiscoveryJob] No planId provided — aborting");
    return;
  }

  // Verify plan exists and is in the right state
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("id, name, tier, pipeline_status, prompts_approved")
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

  console.log(`📋 Plan: "${plan.name}" | Tier: ${plan.tier}`);

  try {
    await startPromptDiscovery(planId);
    console.log(`✅ [PromptDiscoveryJob] Complete for plan: ${planId}`);
  } catch (err) {
    console.error(`❌ [PromptDiscoveryJob] Failed for plan ${planId}:`, err.message);

    // Mark pipeline as errored so it can be retried
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
    .select("id, name, tier")
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
      console.log(`\n💡 Suggesting prompts for: "${plan.name}" (${plan.tier})`);
      await suggestNewPrompts(plan.id);
    } catch (err) {
      console.error(`❌ Suggestion failed for plan "${plan.name}":`, err.message);
    }
  }

  console.log("\n✅ [WeeklyPromptRefresh] Complete");
};