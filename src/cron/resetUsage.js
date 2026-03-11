// import cron from "node-cron";
// import { supabase } from "../config/supabase.js";

// // ─────────────────────────────────────────
// // RESET MONTHLY USAGE
// // Runs on 1st of every month at 00:05 UTC
// // Resets usage counters for paid users only
// // Free users don't track usage the same way
// // ─────────────────────────────────────────

// async function resetMonthlyUsage() {
//   console.log("\n🔄 [resetUsage] Starting monthly usage reset...");

//   try {
//     const now = new Date().toISOString();

//     // Load all paid billing profiles (starter + pro)
//     const { data: paidProfiles, error: fetchErr } = await supabase
//       .from("billing_profiles")
//       .select("id, user_id, plan, status")
//       .in("status", ["active", "trial"])
//       .in("plan", ["starter", "pro"]);

//     if (fetchErr) {
//       console.error("❌ [resetUsage] Failed to fetch paid profiles:", fetchErr.message);
//       return;
//     }

//     if (!paidProfiles?.length) {
//       console.log("ℹ️  [resetUsage] No paid users to reset");
//       return;
//     }

//     console.log(`📋 [resetUsage] Resetting usage for ${paidProfiles.length} paid user(s)`);

//     const userIds = paidProfiles.map((p) => p.user_id);

//     // Reset usage counters on plans table
//     const { error: planResetErr } = await supabase
//       .from("plans")
//       .update({
//         prompts_used_this_month:    0,
//         visibility_runs_this_month: 0,
//         reports_sent_this_month:    0,
//         usage_reset_at:             now,
//         updated_at:                 now,
//       })
//       .in("user_id", userIds);

//     if (planResetErr) {
//       console.error("❌ [resetUsage] Failed to reset plan usage:", planResetErr.message);
//     } else {
//       console.log(`   ✅ Plan usage counters reset for ${userIds.length} users`);
//     }

//     // Reset billing profile usage counters if they exist
//     const profileIds = paidProfiles.map((p) => p.id);

//     const { error: billingResetErr } = await supabase
//       .from("billing_profiles")
//       .update({
//         api_calls_this_month: 0,
//         usage_reset_at:       now,
//         updated_at:           now,
//       })
//       .in("id", profileIds);

//     if (billingResetErr) {
//       // Non-fatal — columns might not exist yet
//       console.warn("⚠️  [resetUsage] Billing usage reset skipped:", billingResetErr.message);
//     } else {
//       console.log(`   ✅ Billing usage counters reset`);
//     }

//     // Log per-plan breakdown
//     const starterCount = paidProfiles.filter((p) => p.plan === "starter").length;
//     const proCount     = paidProfiles.filter((p) => p.plan === "pro").length;

//     console.log(`\n✅ [resetUsage] Monthly reset complete`);
//     console.log(`   Starter: ${starterCount} users | Pro: ${proCount} users`);
//     console.log(`   Reset at: ${now}`);

//   } catch (err) {
//     console.error("❌ [resetUsage] Unexpected error:", err.message);
//   }
// }

// // ─────────────────────────────────────────
// // REGISTER CRON
// // Monthly on 1st at 00:05 UTC: "5 0 1 * *"
// // 5 minutes after midnight so expireTrial
// // runs first and usage resets reflect new status
// // ─────────────────────────────────────────
// export function startResetUsageCron() {
//   console.log("📅 [resetUsage] Cron registered — 1st of month at 00:05 UTC");

//   cron.schedule("5 0 1 * *", async () => {
//     console.log(`\n🕛 [resetUsage] Triggered at ${new Date().toISOString()}`);
//     await resetMonthlyUsage();
//   }, { timezone: "UTC" });
// }

// export { resetMonthlyUsage };


import { supabase } from "../config/supabase.js"

export async function resetMonthlyUsage() {
  console.log("\n🔄 [resetUsage] Starting monthly usage reset...")

  try {
    const now = new Date().toISOString()

    const { data: paidProfiles, error: fetchErr } = await supabase
      .from("billing_profiles")
      .select("user_id, plan, status")  // ← removed id
      .in("status", ["active", "trial"])
      .in("plan", ["starter", "pro"])

    if (fetchErr) {
      console.error("❌ [resetUsage] Failed to fetch paid profiles:", fetchErr.message)
      throw fetchErr
    }

    if (!paidProfiles?.length) {
      console.log("ℹ️  [resetUsage] No paid users to reset")
      return { reset: 0 }
    }

    console.log(`📋 [resetUsage] Resetting usage for ${paidProfiles.length} paid user(s)`)

    const userIds = paidProfiles.map((p) => p.user_id)

    // Reset plans table
    const { error: planResetErr } = await supabase
      .from("plans")
      .update({
        prompts_used_this_month:    0,
        visibility_runs_this_month: 0,
        reports_sent_this_month:    0,
        usage_reset_at:             now,
        updated_at:                 now,
      })
      .in("user_id", userIds)

    if (planResetErr) console.error("❌ [resetUsage] Failed to reset plan usage:", planResetErr.message)
    else console.log(`   ✅ Plan usage counters reset for ${userIds.length} users`)

    // Reset billing_profiles table — use user_id not id
    const { error: billingResetErr } = await supabase
      .from("billing_profiles")
      .update({ api_calls_this_month: 0, usage_reset_at: now, updated_at: now })
      .in("user_id", userIds)  // ← fixed: was profileIds

    if (billingResetErr) console.warn("⚠️  [resetUsage] Billing usage reset skipped:", billingResetErr.message)
    else console.log(`   ✅ Billing usage counters reset`)

    const starterCount = paidProfiles.filter((p) => p.plan === "starter").length
    const proCount     = paidProfiles.filter((p) => p.plan === "pro").length

    console.log(`\n✅ [resetUsage] Monthly reset complete`)
    console.log(`   Starter: ${starterCount} | Pro: ${proCount} | Reset at: ${now}`)

    return { reset: paidProfiles.length, starter: starterCount, pro: proCount }

  } catch (err) {
    console.error("❌ [resetUsage] Unexpected error:", err.message)
    throw err
  }
}