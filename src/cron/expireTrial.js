// import cron from "node-cron";
// import { supabase } from "../config/supabase.js";

// // ─────────────────────────────────────────
// // EXPIRE TRIALS — Daily at midnight UTC
// //
// // Tables used:
// //   plans          → trial_ends_at, subscription_status, tier
// //   billing_profiles → subscription_status, current_plan_slug
// // ─────────────────────────────────────────
// async function expireTrials() {
//   console.log("\n⏰ [expireTrial] Starting trial expiry check...");

//   try {
//     const now = new Date().toISOString();

//     // Find plans where trial has ended and status is still "trial"
//     const { data: expiredPlans, error: fetchErr } = await supabase
//       .from("plans")
//       .select("id, user_id, name, tier, trial_ends_at, subscription_status")
//       .eq("subscription_status", "trial")
//       .lt("trial_ends_at", now)
//       .not("trial_ends_at", "is", null);

//     if (fetchErr) {
//       console.error("❌ [expireTrial] Failed to fetch:", fetchErr.message);
//       return;
//     }

//     if (!expiredPlans?.length) {
//       console.log("✅ [expireTrial] No expired trials found");
//       return;
//     }

//     console.log(`📋 [expireTrial] Found ${expiredPlans.length} expired trial(s)`);

//     const planIds = expiredPlans.map((p) => p.id);
//     const userIds = expiredPlans.map((p) => p.user_id);

//     // Update plans table
//     const { error: planErr } = await supabase
//       .from("plans")
//       .update({
//         subscription_status: "expired",
//         tier:                "free",
//         pipeline_status:     "idle",
//       })
//       .in("id", planIds);

//     if (planErr) console.error("❌ [expireTrial] Plan update failed:", planErr.message);

//     // Update billing_profiles table
//     const { error: billingErr } = await supabase
//       .from("billing_profiles")
//       .update({
//         subscription_status: "expired",
//         current_plan_slug:   "free",
//         updated_at:          now,
//       })
//       .in("user_id", userIds)
//       .eq("subscription_status", "trial");

//     if (billingErr) console.error("❌ [expireTrial] Billing update failed:", billingErr.message);

//     for (const plan of expiredPlans) {
//       console.log(`   → Expired: "${plan.name}" | user: ${plan.user_id} | ended: ${plan.trial_ends_at}`);
//     }

//     console.log(`✅ [expireTrial] ${expiredPlans.length} trial(s) expired`);

//   } catch (err) {
//     console.error("❌ [expireTrial] Crashed:", err.message);
//   }
// }

// export function startExpireTrialCron() {
//   console.log("📅 [expireTrial] daily at 00:00 UTC");
//   cron.schedule("0 0 * * *", async () => {
//     console.log(`\n🕛 [expireTrial] ${new Date().toISOString()}`);
//     await expireTrials();
//   }, { timezone: "UTC" });
// }

// export { expireTrials };






import { supabase } from "../config/supabase.js"

export async function expireTrials() {
  console.log("\n⏰ [expireTrial] Starting trial expiry check...")

  try {
    const now = new Date().toISOString()

    const { data: expiredPlans, error: fetchErr } = await supabase
      .from("plans")
      .select("id, user_id, name, tier, trial_ends_at, subscription_status")
      .eq("subscription_status", "trial")
      .lt("trial_ends_at", now)
      .not("trial_ends_at", "is", null)

    if (fetchErr) {
      console.error("❌ [expireTrial] Failed to fetch:", fetchErr.message)
      throw fetchErr
    }

    if (!expiredPlans?.length) {
      console.log("✅ [expireTrial] No expired trials found")
      return { expired: 0 }
    }

    console.log(`📋 [expireTrial] Found ${expiredPlans.length} expired trial(s)`)

    const planIds = expiredPlans.map((p) => p.id)
    const userIds = expiredPlans.map((p) => p.user_id)

    const { error: planErr } = await supabase
      .from("plans")
      .update({ subscription_status: "expired", tier: "free", pipeline_status: "idle" })
      .in("id", planIds)

    if (planErr) console.error("❌ [expireTrial] Plan update failed:", planErr.message)

    const { error: billingErr } = await supabase
      .from("billing_profiles")
      .update({ subscription_status: "expired", current_plan_slug: "free", updated_at: now })
      .in("user_id", userIds)
      .eq("subscription_status", "trial")

    if (billingErr) console.error("❌ [expireTrial] Billing update failed:", billingErr.message)

    for (const plan of expiredPlans) {
      console.log(`   → Expired: "${plan.name}" | user: ${plan.user_id} | ended: ${plan.trial_ends_at}`)
    }

    console.log(`✅ [expireTrial] ${expiredPlans.length} trial(s) expired`)
    return { expired: expiredPlans.length }

  } catch (err) {
    console.error("❌ [expireTrial] Crashed:", err.message)
    throw err
  }
}