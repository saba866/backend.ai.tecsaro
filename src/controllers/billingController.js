// import Razorpay from "razorpay";
// import crypto   from "crypto";
// import { supabase } from "../config/supabase.js";
// import apiResponse   from "../utils/apiResponse.js";
// import {
//   ensureBillingProfile,
//   activateSubscription,
//   deactivateSubscription,
//   getUserBySubscriptionId,
//   isWebhookProcessed,
//   saveWebhookEvent,
// } from "../services/subscriptionService.js";

// // ─────────────────────────────────────────────────────────────────
// // RAZORPAY CLIENT
// // ─────────────────────────────────────────────────────────────────
// const razorpay = new Razorpay({
//   key_id:     process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });
// const PLANS = {
//   // ── Monthly ──
//   starter: {
//     plan_id:  process.env.RAZORPAY_PLAN_STARTER,
//     amount:   7900 * 100,
//     currency: "INR",
//     name:     "Starter Plan",
//     interval: "monthly",
//     tier:     "starter",
//   },
//   pro: {
//     plan_id:  process.env.RAZORPAY_PLAN_PRO,
//     amount:    24499 * 100,
//     currency: "INR",
//     name:     "Pro Plan",
//     interval: "monthly",
//     tier:     "pro",
//   },
//   // ── Yearly ──
//   starter_yearly: {
//     plan_id:  process.env.RAZORPAY_PLAN_STARTER_YEARLY,
//     amount:   69000 * 100,
//     currency: "INR",
//     name:     "Starter Plan (Annual)",
//     interval: "yearly",
//     tier:     "starter",
//   },
//   pro_yearly: {
//     plan_id:  process.env.RAZORPAY_PLAN_PRO_YEARLY,
//     amount:    244999. * 100,
//     currency: "INR",
//     name:     "Pro Plan (Annual)",
//     interval: "yearly",
//     tier:     "pro",
//   },
// };
// const TIER_LIMITS = {
//   starter: { prompts: 20, pages: 10, competitors: 5,  projects: 1  },
//   pro:     { prompts: 50, pages: 50, competitors: 20, projects: 5  },
//   free:    { prompts: 0,  pages: 0,  competitors: 0,  projects: 0  },
// };

// // ─────────────────────────────────────────────────────────────────
// // GET /billing
// // Returns current subscription status for the billing page
// // ─────────────────────────────────────────────────────────────────
// export const getBillingStatus = async (req, res) => {
//   const userId = req.user?.id;
//   if (!userId) return apiResponse(res, 401, "Unauthorized");

//   try {
//     // billing_profiles is source of truth
//     const billing = await ensureBillingProfile(userId);

//     const isActive = ["active", "authenticated"].includes(billing?.subscription_status ?? "");
//     const tier     = billing?.plan ?? "starter";

//     // Also grab period dates from plans table (more granular)
//     const { data: plan } = await supabase
//       .from("plans")
//       .select("current_period_start, current_period_end, tier")
//       .eq("user_id", userId)
//       .order("created_at", { ascending: false })
//       .limit(1)
//       .maybeSingle();

//     return res.status(200).json({
//       success: true,
//       data: {
//         tier,
//         razorpay_customer_id:     billing?.razorpay_customer_id     ?? null,
//         razorpay_subscription_id: billing?.razorpay_subscription_id ?? null,
//         subscription_status:      billing?.subscription_status      ?? "inactive",
//         current_period_start:     plan?.current_period_start        ?? null,
//         current_period_end:       billing?.next_billing_date        ?? plan?.current_period_end ?? null,
//         is_active:                isActive,
//         is_pro:                   tier === "pro",
//         razorpay_key_id:          process.env.RAZORPAY_KEY_ID,
//       },
//     });
//   } catch (err) {
//     console.error("[getBillingStatus]", err);
//     return apiResponse(res, 500, "Failed to load billing info");
//   }
// };

// // ─────────────────────────────────────────────────────────────────
// // GET /billing/usage
// // Returns current usage counts vs plan limits
// // ─────────────────────────────────────────────────────────────────
// export const getBillingUsage = async (req, res) => {
//   const userId = req.user?.id;
//   if (!userId) return apiResponse(res, 401, "Unauthorized");

//   try {
//     const billing = await ensureBillingProfile(userId);
//     const tier    = billing?.plan ?? "starter";
//     const limits  = TIER_LIMITS[tier] ?? TIER_LIMITS.starter;

//     // Count active plans (projects)
//     const { count: projectsUsed } = await supabase
//       .from("plans")
//       .select("*", { count: "exact", head: true })
//       .eq("user_id", userId);

//     // Get active plan for prompt/page/competitor counts
//     const { data: activePlan } = await supabase
//       .from("plans")
//       .select("id")
//       .eq("user_id", userId)
//       .order("created_at", { ascending: false })
//       .limit(1)
//       .maybeSingle();

//     let promptsUsed     = 0;
//     let pagesUsed       = 0;
//     let competitorsUsed = 0;

//     if (activePlan?.id) {
//       const [promptRes, pageRes, compRes] = await Promise.all([
//         supabase.from("aeo_prompts").select("*", { count: "exact", head: true })
//           .eq("plan_id", activePlan.id).eq("status", "active"),
//         supabase.from("aeo_pages").select("*", { count: "exact", head: true })
//           .eq("plan_id", activePlan.id),
//         supabase.from("aeo_competitors").select("*", { count: "exact", head: true })
//           .eq("plan_id", activePlan.id).eq("approved", true).neq("status", "ignored"),
//       ]);
//       promptsUsed     = promptRes.count     ?? 0;
//       pagesUsed       = pageRes.count       ?? 0;
//       competitorsUsed = compRes.count       ?? 0;
//     }

//     // Next reset = next billing date
//     const resetDate = billing?.next_billing_date ?? null;

//     return res.status(200).json({
//       success: true,
//       data: {
//         prompts_used:     promptsUsed,
//         prompts_max:      limits.prompts,
//         pages_used:       pagesUsed,
//         pages_max:        limits.pages,
//         competitors_used: competitorsUsed,
//         competitors_max:  limits.competitors,
//         projects_used:    projectsUsed ?? 0,
//         projects_max:     limits.projects,
//         reset_date:       resetDate,
//       },
//     });
//   } catch (err) {
//     console.error("[getBillingUsage]", err);
//     return apiResponse(res, 500, "Failed to load usage");
//   }
// };

// // ─────────────────────────────────────────────────────────────────
// // GET /billing/invoices
// // Returns invoice history from razorpay_orders table
// // ─────────────────────────────────────────────────────────────────
// export const getBillingInvoices = async (req, res) => {
//   const userId = req.user?.id;
//   if (!userId) return apiResponse(res, 401, "Unauthorized");

//   try {
//     const { data: orders, error } = await supabase
//       .from("razorpay_orders")
//       .select("razorpay_order_id, razorpay_payment_id, amount, currency, status, pricing_plan_slug, created_at")
//       .eq("user_id", userId)
//       .order("created_at", { ascending: false })
//       .limit(20);

//     if (error) throw error;

//     const invoices = (orders ?? []).map((o, i) => ({
//       id:     o.razorpay_payment_id ?? o.razorpay_order_id ?? `INV-${String(i + 1).padStart(4, "0")}`,
//       date:   new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
//       amount: o.amount ? `₹${(o.amount / 100).toLocaleString("en-IN")}` : "₹0",
//       status: o.status === "paid" ? "Paid" : o.status === "created" ? "Pending" : o.status ?? "—",
//     }));

//     return res.status(200).json({ success: true, data: invoices });
//   } catch (err) {
//     console.error("[getBillingInvoices]", err);
//     return apiResponse(res, 500, "Failed to load invoices");
//   }
// };

// // ─────────────────────────────────────────────────────────────────
// // POST /billing/subscribe
// // Creates a Razorpay subscription → frontend opens checkout
// // ─────────────────────────────────────────────────────────────────
// export const createSubscription = async (req, res) => {
//   console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID)
// console.log("RAZORPAY_PLAN_STARTER:", process.env.RAZORPAY_PLAN_STARTER)
// console.log("RAZORPAY_PLAN_PRO:", process.env.RAZORPAY_PLAN_PRO)
//   const userId = req.user?.id;
//   const email  = req.user?.email;
//   const name   = req.user?.user_metadata?.full_name ?? req.user?.user_metadata?.name ?? email;

//   if (!userId) return apiResponse(res, 401, "Unauthorized");

//   const { plan } = req.body;
//   if (!plan || !PLANS[plan]) {
//     return apiResponse(res, 400, `Invalid plan. Choose: ${Object.keys(PLANS).join(" | ")}`);
//   }

//   const planConfig = PLANS[plan];
//   if (!planConfig.plan_id) {
//     return apiResponse(res, 500, `RAZORPAY_PLAN_${plan.toUpperCase()} is not set in .env`);
//   }

//   try {
//     const billing    = await ensureBillingProfile(userId);
//     let customerId   = billing?.razorpay_customer_id;

//     // Create Razorpay customer if needed
//     if (!customerId) {
//       const customer = await razorpay.customers.create({
//         name:          name ?? email,
//         email,
//         fail_existing: 0,
//       });
//       customerId = customer.id;

//       await supabase.from("billing_profiles")
//         .update({ razorpay_customer_id: customerId })
//         .eq("user_id", userId);

//       console.log(`👤 Razorpay customer created: ${customerId}`);
//     }

//     // Create subscription
//     const subscription = await razorpay.subscriptions.create({
//       plan_id:         planConfig.plan_id,
//       customer_notify: 1,
//       total_count:     12,
//       quantity:        1,
//       notes:           { supabase_user_id: userId, plan },
//     });

//     // Save subscription ID immediately
//     await supabase.from("billing_profiles")
//       .update({
//         razorpay_subscription_id: subscription.id,
//         subscription_status:      "created",
//       })
//       .eq("user_id", userId);

//     console.log(`💳 Subscription created: ${subscription.id} | user=${userId} | plan=${plan}`);

//     return res.status(200).json({
//       success:         true,
//       subscription_id: subscription.id,
//       razorpay_key_id: process.env.RAZORPAY_KEY_ID,
//       plan,
//       amount:          planConfig.amount,
//       currency:        planConfig.currency,
//       plan_name:       planConfig.name,
//     });
//   } catch (err) {
//     console.error("[createSubscription]", err);
//     return apiResponse(res, 500, err?.error?.description ?? "Failed to create subscription");
//   }
// };

// // ─────────────────────────────────────────────────────────────────
// // POST /billing/verify
// // Called by frontend after Razorpay checkout — verifies + activates
// // ─────────────────────────────────────────────────────────────────
// export const verifyPayment = async (req, res) => {
//   const userId = req.user?.id;
//   if (!userId) return apiResponse(res, 401, "Unauthorized");

//   const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan } = req.body;

//   if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
//     return apiResponse(res, 400, "Missing payment verification fields");
//   }

//   // Verify HMAC signature
//   const body     = `${razorpay_payment_id}|${razorpay_subscription_id}`;
//   const expected = crypto
//     .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//     .update(body)
//     .digest("hex");

//   if (expected !== razorpay_signature) {
//     console.warn(`[verifyPayment] Signature mismatch | user=${userId}`);
//     return apiResponse(res, 400, "Payment verification failed — invalid signature");
//   }

//   try {
//     const resolvedPlan = plan ?? "starter";

//   await activateSubscription({
//   userId,
//   planSlug:               resolvedPlan,
//   billingInterval:        PLANS[resolvedPlan]?.interval ?? "monthly",
//   razorpaySubscriptionId: razorpay_subscription_id,
// });


//     // Save to orders table for invoice history
//     await supabase.from("razorpay_orders").upsert({
//       user_id:             userId,
//       razorpay_order_id:   razorpay_subscription_id,
//       razorpay_payment_id: razorpay_payment_id,
//       razorpay_signature:  razorpay_signature,
//       amount:              PLANS[resolvedPlan]?.amount ?? 0,
//       currency:            "INR",
//       status:              "paid",
//       pricing_plan_slug:   resolvedPlan,
//       billing_interval:    "monthly",
//     }, { onConflict: "razorpay_order_id" });

//     console.log(`✅ Payment verified: user=${userId} plan=${resolvedPlan}`);

//     return res.status(200).json({ success: true, message: `${resolvedPlan} plan activated`, plan: resolvedPlan });
//   } catch (err) {
//     console.error("[verifyPayment]", err);
//     return apiResponse(res, 500, "Failed to activate plan");
//   }
// };

// // ─────────────────────────────────────────────────────────────────
// // POST /billing/cancel
// // ─────────────────────────────────────────────────────────────────
// export const cancelSubscription = async (req, res) => {
//   const userId = req.user?.id;
//   if (!userId) return apiResponse(res, 401, "Unauthorized");

//   const cancelAtCycleEnd = req.body?.cancel_at_cycle_end === true ? 1 : 0;

//   try {
//     const billing = await ensureBillingProfile(userId);

//     if (!billing?.razorpay_subscription_id) {
//       return apiResponse(res, 400, "No active subscription found");
//     }

//     await razorpay.subscriptions.cancel(billing.razorpay_subscription_id, cancelAtCycleEnd);

//     if (cancelAtCycleEnd) {
//       await supabase.from("billing_profiles")
//         .update({ subscription_status: "pending_cancellation" })
//         .eq("user_id", userId);
//     } else {
//       await deactivateSubscription(userId, "canceled");
//     }

//     const message = cancelAtCycleEnd
//       ? "Subscription will cancel at end of billing period"
//       : "Subscription cancelled immediately";

//     console.log(`❌ Subscription cancelled: user=${userId} immediate=${!cancelAtCycleEnd}`);
//     return res.status(200).json({ success: true, message });
//   } catch (err) {
//     console.error("[cancelSubscription]", err);
//     return apiResponse(res, 500, err?.error?.description ?? "Failed to cancel subscription");
//   }
// };

// // ─────────────────────────────────────────────────────────────────
// // POST /billing/webhook
// // Razorpay lifecycle events — must receive raw body
// // ─────────────────────────────────────────────────────────────────
// export const billingWebhook = async (req, res) => {
//   const receivedSig = req.headers["x-razorpay-signature"];
//   const secret      = process.env.RAZORPAY_WEBHOOK_SECRET;

//   const expectedSig = crypto
//     .createHmac("sha256", secret)
//     .update(req.body)
//     .digest("hex");

//   if (receivedSig !== expectedSig) {
//     console.warn("[webhook] Signature mismatch");
//     return res.status(400).json({ error: "Invalid signature" });
//   }

//   let payload;
//   try {
//     payload = JSON.parse(req.body.toString());
//   } catch {
//     return res.status(400).json({ error: "Invalid JSON body" });
//   }

//   const event   = payload.event;
//   const eventId = payload.id;
//   const entity  = payload.payload?.subscription?.entity ?? {};
//   const payment = payload.payload?.payment?.entity      ?? {};

//   console.log(`[webhook] ${event} | id=${eventId}`);

//   // Idempotency — skip already-processed events
//   if (eventId && await isWebhookProcessed(eventId)) {
//     console.log(`[webhook] Already processed: ${eventId}`);
//     return res.status(200).json({ received: true });
//   }

//   try {
//     switch (event) {

//       case "subscription.activated": {
//         const notes  = entity.notes ?? {};
//         const userId = notes.supabase_user_id;
//         const plan   = notes.plan ?? "starter";
//         if (userId) {
//           await activateSubscription({
//             userId,
//             planSlug:               plan,
//             razorpaySubscriptionId: entity.id,
//           });
//           // Also update period dates directly
//           await supabase.from("plans").update({
//             current_period_start: entity.current_start ? new Date(entity.current_start * 1000).toISOString() : null,
//             current_period_end:   entity.current_end   ? new Date(entity.current_end   * 1000).toISOString() : null,
//           }).eq("user_id", userId);
//           console.log(`✅ [webhook] Activated: user=${userId} plan=${plan}`);
//         }
//         break;
//       }

//       case "subscription.charged": {
//         const record = await getUserBySubscriptionId(entity.id);
//         if (record) {
//           await activateSubscription({
//             userId:                 record.user_id,
//             planSlug:               record.current_plan_slug ?? "starter",
//             razorpaySubscriptionId: entity.id,
//           });
//           // Save renewal as invoice
//           await supabase.from("razorpay_orders").insert({
//             user_id:             record.user_id,
//             razorpay_order_id:   payment.order_id  ?? entity.id,
//             razorpay_payment_id: payment.id        ?? null,
//             amount:              payment.amount     ?? 0,
//             currency:            payment.currency   ?? "INR",
//             status:              "paid",
//             pricing_plan_slug:   record.current_plan_slug,
//             billing_interval:    "monthly",
//           }).select().maybeSingle(); // ignore duplicate errors
//           console.log(`🔄 [webhook] Renewed: user=${record.user_id}`);
//         }
//         break;
//       }

//       case "subscription.cancelled": {
//         const record = await getUserBySubscriptionId(entity.id);
//         if (record) {
//           await deactivateSubscription(record.user_id, "canceled");
//           console.log(`❌ [webhook] Cancelled: user=${record.user_id}`);
//         }
//         break;
//       }

//       case "subscription.halted": {
//         const record = await getUserBySubscriptionId(entity.id);
//         if (record) {
//           await supabase.from("billing_profiles")
//             .update({ subscription_status: "halted", updated_at: new Date().toISOString() })
//             .eq("user_id", record.user_id);
//           await supabase.from("plans")
//             .update({ subscription_status: "payment_failed" })
//             .eq("user_id", record.user_id);
//           console.warn(`⚠️  [webhook] Halted: user=${record.user_id}`);
//         }
//         break;
//       }

//       case "payment.failed":
//         console.warn(`[webhook] Payment failed: payment_id=${payment.id}`);
//         break;

//       default:
//         console.log(`[webhook] Unhandled: ${event}`);
//     }

//     if (eventId) {
//       await saveWebhookEvent({ razorpayEventId: eventId, eventType: event, payload, status: "processed" });
//     }
//   } catch (err) {
//     console.error(`[webhook] Error processing ${event}:`, err.message);
//     if (eventId) {
//       await saveWebhookEvent({ razorpayEventId: eventId, eventType: event, payload, status: "error" });
//     }
//   }

//   return res.status(200).json({ received: true });
// };




import Razorpay from "razorpay";
import crypto   from "crypto";
import { supabase } from "../config/supabase.js";
import apiResponse   from "../utils/apiResponse.js";
import {
  ensureBillingProfile,
  activateSubscription,
  deactivateSubscription,
  getUserBySubscriptionId,
  isWebhookProcessed,
  saveWebhookEvent,
} from "../services/subscriptionService.js";

// ─────────────────────────────────────────────────────────────────
// RAZORPAY CLIENT
// ─────────────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────
// PLANS — single source of truth for pricing across the whole app
// Prices in paise (× 100) for Razorpay, display prices in ₹
// ─────────────────────────────────────────────────────────────────
const PLANS = {
  // ── Monthly ──
  starter: {
    plan_id:       process.env.RAZORPAY_PLAN_STARTER,
    amount:        299900,        // ₹2,999 in paise
    display_price: "₹2,999",
    currency:      "INR",
    name:          "Starter Plan",
    interval:      "monthly",
    tier:          "starter",
  },
  pro: {
    plan_id:       process.env.RAZORPAY_PLAN_PRO,
    amount:        799900,        // ₹7,999 in paise
    display_price: "₹7,999",
    currency:      "INR",
    name:          "Pro Plan",
    interval:      "monthly",
    tier:          "pro",
  },
  // ── Yearly ──
  starter_yearly: {
    plan_id:       process.env.RAZORPAY_PLAN_STARTER_YEARLY,
    amount:        2999000,       // ₹29,990 in paise
    display_price: "₹29,990",
    currency:      "INR",
    name:          "Starter Plan (Annual)",
    interval:      "yearly",
    tier:          "starter",
  },
  pro_yearly: {
    plan_id:       process.env.RAZORPAY_PLAN_PRO_YEARLY,
    amount:        7999000,       // ₹79,990 in paise
    display_price: "₹79,990",
    currency:      "INR",
    name:          "Pro Plan (Annual)",
    interval:      "yearly",
    tier:          "pro",
  },
};

const TIER_LIMITS = {
  starter: { prompts: 20, pages: 10, competitors: 5,  projects: 1 },
  pro:     { prompts: 50, pages: 50, competitors: 20, projects: 5 },
  free:    { prompts: 0,  pages: 0,  competitors: 0,  projects: 0 },
};

// ─────────────────────────────────────────────────────────────────
// GET /billing/plans/pricing
// Returns plan pricing for CheckoutModal — no hardcoded values on frontend
// ─────────────────────────────────────────────────────────────────
export const getPlanPricing = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      starter: {
        name:             "Starter",
        description:      "For founders and small businesses starting with AEO",
        monthly_price:    2999,
        yearly_price:     29990,
        monthly_plan_key: "starter",
        yearly_plan_key:  "starter_yearly",
        features: [
          "1 brand / website",
          "Up to 20 prompts tracked",
          "Track up to 5 competitors",
          "ChatGPT & Gemini",
          "AEO Visibility Score",
          "Schema generation",
          "Recommendations",
          "7-day free trial",
        ],
      },
      pro: {
        name:             "Pro",
        description:      "For growing teams serious about AI answer visibility",
        monthly_price:    7999,
        yearly_price:     79990,
        monthly_plan_key: "pro",
        yearly_plan_key:  "pro_yearly",
        features: [
          "Up to 3 brands / websites",
          "Up to 50 prompts tracked",
          "Track up to 15 competitors",
          "ChatGPT, Gemini & Perplexity",
          "Advanced AEO Visibility Score",
          "Schema generation",
          "Advanced recommendations",
          "Exportable reports",
          "7-day free trial",
        ],
      },
    },
  });
};

// ─────────────────────────────────────────────────────────────────
// GET /billing
// ─────────────────────────────────────────────────────────────────
export const getBillingStatus = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return apiResponse(res, 401, "Unauthorized");

  try {
    const billing = await ensureBillingProfile(userId);

    const isActive = ["active", "authenticated"].includes(billing?.subscription_status ?? "");
    const tier     = billing?.plan ?? "starter";

    const { data: plan } = await supabase
      .from("plans")
      .select("current_period_start, current_period_end, tier")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.status(200).json({
      success: true,
      data: {
        tier,
        razorpay_customer_id:     billing?.razorpay_customer_id     ?? null,
        razorpay_subscription_id: billing?.razorpay_subscription_id ?? null,
        subscription_status:      billing?.subscription_status      ?? "inactive",
        current_period_start:     plan?.current_period_start        ?? null,
        current_period_end:       billing?.next_billing_date        ?? plan?.current_period_end ?? null,
        is_active:                isActive,
        is_pro:                   tier === "pro",
        razorpay_key_id:          process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    console.error("[getBillingStatus]", err);
    return apiResponse(res, 500, "Failed to load billing info");
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /billing/usage
// ─────────────────────────────────────────────────────────────────
export const getBillingUsage = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return apiResponse(res, 401, "Unauthorized");

  try {
    const billing = await ensureBillingProfile(userId);
    const tier    = billing?.plan ?? "starter";
    const limits  = TIER_LIMITS[tier] ?? TIER_LIMITS.starter;

    const { count: projectsUsed } = await supabase
      .from("plans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { data: activePlan } = await supabase
      .from("plans")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let promptsUsed = 0, pagesUsed = 0, competitorsUsed = 0;

    if (activePlan?.id) {
      const [promptRes, pageRes, compRes] = await Promise.all([
        supabase.from("aeo_prompts").select("*", { count: "exact", head: true })
          .eq("plan_id", activePlan.id).eq("status", "active"),
        supabase.from("aeo_pages").select("*", { count: "exact", head: true })
          .eq("plan_id", activePlan.id),
        supabase.from("aeo_competitors").select("*", { count: "exact", head: true })
          .eq("plan_id", activePlan.id).eq("approved", true).neq("status", "ignored"),
      ]);
      promptsUsed     = promptRes.count ?? 0;
      pagesUsed       = pageRes.count   ?? 0;
      competitorsUsed = compRes.count   ?? 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        prompts_used:     promptsUsed,
        prompts_max:      limits.prompts,
        pages_used:       pagesUsed,
        pages_max:        limits.pages,
        competitors_used: competitorsUsed,
        competitors_max:  limits.competitors,
        projects_used:    projectsUsed ?? 0,
        projects_max:     limits.projects,
        reset_date:       billing?.next_billing_date ?? null,
      },
    });
  } catch (err) {
    console.error("[getBillingUsage]", err);
    return apiResponse(res, 500, "Failed to load usage");
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /billing/invoices
// ─────────────────────────────────────────────────────────────────
export const getBillingInvoices = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return apiResponse(res, 401, "Unauthorized");

  try {
    const { data: orders, error } = await supabase
      .from("razorpay_orders")
      .select("razorpay_order_id, razorpay_payment_id, amount, currency, status, pricing_plan_slug, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const invoices = (orders ?? []).map((o, i) => ({
      id:     o.razorpay_payment_id ?? o.razorpay_order_id ?? `INV-${String(i + 1).padStart(4, "0")}`,
      date:   new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      amount: o.amount ? `₹${(o.amount / 100).toLocaleString("en-IN")}` : "₹0",
      status: o.status === "paid" ? "Paid" : o.status === "created" ? "Pending" : o.status ?? "—",
    }));

    return res.status(200).json({ success: true, data: invoices });
  } catch (err) {
    console.error("[getBillingInvoices]", err);
    return apiResponse(res, 500, "Failed to load invoices");
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /billing/subscribe
// ─────────────────────────────────────────────────────────────────
export const createSubscription = async (req, res) => {
  const userId = req.user?.id;
  const email  = req.user?.email;
  const name   = req.user?.user_metadata?.full_name ?? req.user?.user_metadata?.name ?? email;

  if (!userId) return apiResponse(res, 401, "Unauthorized");

  const { plan } = req.body;
  if (!plan || !PLANS[plan]) {
    return apiResponse(res, 400, `Invalid plan. Choose: ${Object.keys(PLANS).join(" | ")}`);
  }

  const planConfig = PLANS[plan];
  if (!planConfig.plan_id) {
    return apiResponse(res, 500, `RAZORPAY_PLAN_${plan.toUpperCase()} is not set in .env`);
  }

  try {
    const billing  = await ensureBillingProfile(userId);
    let customerId = billing?.razorpay_customer_id;

    if (!customerId) {
      const customer = await razorpay.customers.create({
        name: name ?? email, email, fail_existing: 0,
      });
      customerId = customer.id;
      await supabase.from("billing_profiles")
        .update({ razorpay_customer_id: customerId })
        .eq("user_id", userId);
      console.log(`👤 Razorpay customer created: ${customerId}`);
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id:         planConfig.plan_id,
      customer_notify: 1,
      total_count:     12,
      quantity:        1,
      notes:           { supabase_user_id: userId, plan },
    });

    await supabase.from("billing_profiles")
      .update({ razorpay_subscription_id: subscription.id, subscription_status: "created" })
      .eq("user_id", userId);

    console.log(`💳 Subscription created: ${subscription.id} | user=${userId} | plan=${plan}`);

    return res.status(200).json({
      success:         true,
      subscription_id: subscription.id,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID,
      plan,
      amount:          planConfig.amount,
      currency:        planConfig.currency,
      plan_name:       planConfig.name,
    });
  } catch (err) {
    console.error("[createSubscription]", err);
    return apiResponse(res, 500, err?.error?.description ?? "Failed to create subscription");
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /billing/verify
// ─────────────────────────────────────────────────────────────────
export const verifyPayment = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return apiResponse(res, 401, "Unauthorized");

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan } = req.body;

  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    return apiResponse(res, 400, "Missing payment verification fields");
  }

  const body     = `${razorpay_payment_id}|${razorpay_subscription_id}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expected !== razorpay_signature) {
    console.warn(`[verifyPayment] Signature mismatch | user=${userId}`);
    return apiResponse(res, 400, "Payment verification failed — invalid signature");
  }

  try {
    const resolvedPlan = plan ?? "starter";

    await activateSubscription({
      userId,
      planSlug:               resolvedPlan,
      billingInterval:        PLANS[resolvedPlan]?.interval ?? "monthly",
      razorpaySubscriptionId: razorpay_subscription_id,
    });

    await supabase.from("razorpay_orders").upsert({
      user_id:             userId,
      razorpay_order_id:   razorpay_subscription_id,
      razorpay_payment_id: razorpay_payment_id,
      razorpay_signature:  razorpay_signature,
      amount:              PLANS[resolvedPlan]?.amount ?? 0,
      currency:            "INR",
      status:              "paid",
      pricing_plan_slug:   resolvedPlan,
      billing_interval:    PLANS[resolvedPlan]?.interval ?? "monthly",
    }, { onConflict: "razorpay_order_id" });

    console.log(`✅ Payment verified: user=${userId} plan=${resolvedPlan}`);
    return res.status(200).json({ success: true, message: `${resolvedPlan} plan activated`, plan: resolvedPlan });
  } catch (err) {
    console.error("[verifyPayment]", err);
    return apiResponse(res, 500, "Failed to activate plan");
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /billing/cancel
// ─────────────────────────────────────────────────────────────────
export const cancelSubscription = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return apiResponse(res, 401, "Unauthorized");

  const cancelAtCycleEnd = req.body?.cancel_at_cycle_end === true ? 1 : 0;

  try {
    const billing = await ensureBillingProfile(userId);

    if (!billing?.razorpay_subscription_id) {
      return apiResponse(res, 400, "No active subscription found");
    }

    await razorpay.subscriptions.cancel(billing.razorpay_subscription_id, cancelAtCycleEnd);

    if (cancelAtCycleEnd) {
      await supabase.from("billing_profiles")
        .update({ subscription_status: "pending_cancellation" })
        .eq("user_id", userId);
    } else {
      await deactivateSubscription(userId, "canceled");
    }

    const message = cancelAtCycleEnd
      ? "Subscription will cancel at end of billing period"
      : "Subscription cancelled immediately";

    console.log(`❌ Subscription cancelled: user=${userId} immediate=${!cancelAtCycleEnd}`);
    return res.status(200).json({ success: true, message });
  } catch (err) {
    console.error("[cancelSubscription]", err);
    return apiResponse(res, 500, err?.error?.description ?? "Failed to cancel subscription");
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /billing/webhook
// ─────────────────────────────────────────────────────────────────
export const billingWebhook = async (req, res) => {
  const receivedSig = req.headers["x-razorpay-signature"];
  const secret      = process.env.RAZORPAY_WEBHOOK_SECRET;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("hex");

  if (receivedSig !== expectedSig) {
    console.warn("[webhook] Signature mismatch");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const event   = payload.event;
  const eventId = payload.id;
  const entity  = payload.payload?.subscription?.entity ?? {};
  const payment = payload.payload?.payment?.entity      ?? {};

  console.log(`[webhook] ${event} | id=${eventId}`);

  if (eventId && await isWebhookProcessed(eventId)) {
    console.log(`[webhook] Already processed: ${eventId}`);
    return res.status(200).json({ received: true });
  }

  try {
    switch (event) {

      case "subscription.activated": {
        const notes  = entity.notes ?? {};
        const userId = notes.supabase_user_id;
        const plan   = notes.plan ?? "starter";
        if (userId) {
          await activateSubscription({ userId, planSlug: plan, razorpaySubscriptionId: entity.id });
          await supabase.from("plans").update({
            current_period_start: entity.current_start ? new Date(entity.current_start * 1000).toISOString() : null,
            current_period_end:   entity.current_end   ? new Date(entity.current_end   * 1000).toISOString() : null,
          }).eq("user_id", userId);
          console.log(`✅ [webhook] Activated: user=${userId} plan=${plan}`);
        }
        break;
      }

      case "subscription.charged": {
        const record = await getUserBySubscriptionId(entity.id);
        if (record) {
          await activateSubscription({
            userId:                 record.user_id,
            planSlug:               record.current_plan_slug ?? "starter",
            razorpaySubscriptionId: entity.id,
          });
          await supabase.from("razorpay_orders").insert({
            user_id:             record.user_id,
            razorpay_order_id:   payment.order_id ?? entity.id,
            razorpay_payment_id: payment.id       ?? null,
            amount:              payment.amount    ?? 0,
            currency:            payment.currency  ?? "INR",
            status:              "paid",
            pricing_plan_slug:   record.current_plan_slug,
            billing_interval:    "monthly",
          }).select().maybeSingle();
          console.log(`🔄 [webhook] Renewed: user=${record.user_id}`);
        }
        break;
      }

      case "subscription.cancelled": {
        const record = await getUserBySubscriptionId(entity.id);
        if (record) {
          await deactivateSubscription(record.user_id, "canceled");
          console.log(`❌ [webhook] Cancelled: user=${record.user_id}`);
        }
        break;
      }

      case "subscription.halted": {
        const record = await getUserBySubscriptionId(entity.id);
        if (record) {
          await supabase.from("billing_profiles")
            .update({ subscription_status: "halted", updated_at: new Date().toISOString() })
            .eq("user_id", record.user_id);
          await supabase.from("plans")
            .update({ subscription_status: "payment_failed" })
            .eq("user_id", record.user_id);
          console.warn(`⚠️  [webhook] Halted: user=${record.user_id}`);
        }
        break;
      }

      case "payment.failed":
        console.warn(`[webhook] Payment failed: payment_id=${payment.id}`);
        break;

      default:
        console.log(`[webhook] Unhandled: ${event}`);
    }

    if (eventId) {
      await saveWebhookEvent({ razorpayEventId: eventId, eventType: event, payload, status: "processed" });
    }
  } catch (err) {
    console.error(`[webhook] Error processing ${event}:`, err.message);
    if (eventId) {
      await saveWebhookEvent({ razorpayEventId: eventId, eventType: event, payload, status: "error" });
    }
  }

  return res.status(200).json({ received: true });
};