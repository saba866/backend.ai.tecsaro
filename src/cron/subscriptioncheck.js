import cron from "node-cron";
import Razorpay from "razorpay";
import { supabase } from "../config/supabase.js";

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────
// VERIFY SUBSCRIPTION WITH RAZORPAY
// ─────────────────────────────────────────
async function verifyRazorpaySubscription(subscriptionId) {
  if (!subscriptionId) return "unknown";
  try {
    const sub = await razorpay.subscriptions.fetch(subscriptionId);
    if (["active", "authenticated"].includes(sub.status)) return "active";
    if (["cancelled", "completed", "expired"].includes(sub.status)) return "expired";
    if (sub.status === "halted") return "halted";
    return "unknown";
  } catch (err) {
    console.warn(`   ⚠️  Razorpay fetch failed (${subscriptionId}): ${err.message}`);
    return "unknown";
  }
}

// ─────────────────────────────────────────
// CHECK SUBSCRIPTIONS — Daily at 01:00 UTC
//
// Tables used:
//   plans            → subscription_status, tier, current_period_end,
//                       razorpay_subscription_id, pipeline_status
//   billing_profiles → subscription_status, current_plan_slug,
//                       razorpay_subscription_id, next_billing_date
// ─────────────────────────────────────────
async function checkSubscriptions() {
  console.log("\n🔍 [subscriptionCheck] Starting subscription check...");

  try {
    const now = new Date().toISOString();

    // Load all active paid plans (not trials — expireTrial handles those)
    const { data: activePlans, error: fetchErr } = await supabase
      .from("plans")
      .select(`
        id,
        user_id,
        name,
        tier,
        subscription_status,
        current_period_end,
        razorpay_subscription_id
      `)
      .eq("subscription_status", "active")
      .in("tier", ["starter", "pro"]);

    if (fetchErr) {
      console.error("❌ [subscriptionCheck] Fetch failed:", fetchErr.message);
      return;
    }

    if (!activePlans?.length) {
      console.log("ℹ️  [subscriptionCheck] No active paid plans to check");
      return;
    }

    console.log(`📋 [subscriptionCheck] Checking ${activePlans.length} plan(s)`);

    let active = 0, expired = 0, halted = 0, unknown = 0;

    for (const plan of activePlans) {

      // ── CHECK 1: Period end date passed ──
      if (plan.current_period_end && plan.current_period_end < now) {
        console.log(`   ⚠️  Period ended: "${plan.name}" (${plan.current_period_end})`);

        await supabase.from("plans").update({
          subscription_status: "expired",
          tier:                "free",
          pipeline_status:     "idle",
        }).eq("id", plan.id);

        await supabase.from("billing_profiles").update({
          subscription_status: "expired",
          current_plan_slug:   "free",
          updated_at:          now,
        }).eq("user_id", plan.user_id);

        expired++;
        console.log(`   ✅ Downgraded to free: "${plan.name}"`);
        continue;
      }

      // ── CHECK 2: Verify with Razorpay ──
      if (plan.razorpay_subscription_id) {
        const status = await verifyRazorpaySubscription(plan.razorpay_subscription_id);

        if (status === "expired") {
          console.log(`   ⚠️  Razorpay expired: "${plan.name}"`);

          await supabase.from("plans").update({
            subscription_status: "expired",
            tier:                "free",
            pipeline_status:     "idle",
          }).eq("id", plan.id);

          await supabase.from("billing_profiles").update({
            subscription_status: "expired",
            current_plan_slug:   "free",
            updated_at:          now,
          }).eq("user_id", plan.user_id);

          expired++;
          console.log(`   ✅ Downgraded to free: "${plan.name}"`);

        } else if (status === "halted") {
          // Payment failed — flag but don't downgrade yet (give grace time)
          console.log(`   🚨 Payment halted: "${plan.name}"`);

          await supabase.from("plans").update({
            subscription_status: "payment_failed",
          }).eq("id", plan.id);

          await supabase.from("billing_profiles").update({
            subscription_status: "payment_failed",
            updated_at:          now,
          }).eq("user_id", plan.user_id);

          halted++;

        } else if (status === "active") {
          active++;
        } else {
          unknown++;
        }

        // Small delay to respect Razorpay rate limits
        await new Promise((r) => setTimeout(r, 200));
      } else {
        // No Razorpay ID — only date check, already done above
        active++;
      }
    }

    console.log(`\n✅ [subscriptionCheck] Complete`);
    console.log(`   Active: ${active} | Expired: ${expired} | Halted: ${halted} | Unknown: ${unknown}`);

  } catch (err) {
    console.error("❌ [subscriptionCheck] Crashed:", err.message);
  }
}

export function startSubscriptionCheckCron() {
  console.log("📅 [subscriptionCheck] daily at 01:00 UTC");
  cron.schedule("0 1 * * *", async () => {
    console.log(`\n🕐 [subscriptionCheck] ${new Date().toISOString()}`);
    await checkSubscriptions();
  }, { timezone: "UTC" });
}

export { checkSubscriptions };