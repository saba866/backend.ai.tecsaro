




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




// Fallback if pricing_plans table is empty or errors
const HARDCODED_FALLBACK = {
  starter: {
    name: "Starter", description: "For founders and small businesses starting with AEO",
    monthly_price: 2999, yearly_price: 29990, yearly_per_month: 2499,
    monthly_plan_key: "starter", yearly_plan_key: "starter_yearly",
    monthly_display: "₹2,999", yearly_display: "₹29,990",
    features: ["1 brand / project", "Up to 20 prompts tracked", "Track up to 5 competitors", "ChatGPT & Gemini", "AEO Visibility Score", "Schema generation", "7-day free trial"],
    is_popular: false, trial_days: 7,
  },
  pro: {
    name: "Pro", description: "For growing teams serious about AI answer visibility",
    monthly_price: 7999, yearly_price: 79990, yearly_per_month: 6666,
    monthly_plan_key: "pro", yearly_plan_key: "pro_yearly",
    monthly_display: "₹7,999", yearly_display: "₹79,990",
    features: ["Up to 3 brands / projects", "Up to 50 prompts tracked", "Track up to 15 competitors", "ChatGPT, Gemini & Perplexity", "Advanced recommendations", "Exportable reports", "7-day free trial"],
    is_popular: true, trial_days: 7,
  },
};

// ─────────────────────────────────────────────────────────────────
// GET /billing/plans/pricing
// Reads from pricing_plans table — no hardcoded values
// Replace the existing getPlanPricing function in billing.controller.js
// ─────────────────────────────────────────────────────────────────
export const getPlanPricing = async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from("pricing_plans")
      .select(`
        slug, name, is_popular, trial_days,
        price_monthly, price_yearly, price_yearly_monthly,
        price_monthly_display, price_yearly_display,
        brands_limit, prompts_limit, competitors_limit,
        pages_limit, engines,
        razorpay_monthly_plan_id, razorpay_yearly_plan_id
      `)
      .eq("is_active", true)
      .in("slug", ["starter", "pro"])
      .order("price_monthly", { ascending: true });

    if (error) throw error;

    if (!rows?.length) {
      // Fallback to hardcoded if table is empty
      return res.status(200).json({ success: true, data: HARDCODED_FALLBACK });
    }

    // Shape into { starter: {...}, pro: {...} }
    const data = {};
    for (const row of rows) {
      const tier = row.slug; // "starter" | "pro"

      // Build feature list from DB limits + engines
      const features = [
        `${row.brands_limit} brand${row.brands_limit !== 1 ? "s" : ""} / project${row.brands_limit !== 1 ? "s" : ""}`,
        `Up to ${row.prompts_limit} prompts tracked`,
        `Track up to ${row.competitors_limit} competitors`,
        (row.engines ?? []).join(" & "),
        "AEO Visibility Score",
        "Schema generation",
        "Recommendations",
        `${row.trial_days ?? 7}-day free trial`,
      ].filter(Boolean);

      data[tier] = {
        name:             row.name,
        description:      tier === "pro"
          ? "For growing teams serious about AI answer visibility"
          : "For founders and small businesses starting with AEO",
        monthly_price:    row.price_monthly,
        yearly_price:     row.price_yearly,
        yearly_per_month: row.price_yearly_monthly ?? Math.round(row.price_yearly / 12),
        monthly_plan_key: tier,
        yearly_plan_key:  `${tier}_yearly`,
        monthly_display:  row.price_monthly_display ?? `₹${row.price_monthly.toLocaleString("en-IN")}`,
        yearly_display:   row.price_yearly_display  ?? `₹${row.price_yearly.toLocaleString("en-IN")}`,
        features,
        is_popular:       row.is_popular ?? (tier === "pro"),
        trial_days:       row.trial_days ?? 7,
      };
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[getPlanPricing]", err);
    // Fallback to hardcoded on error so checkout never breaks
    return res.status(200).json({ success: true, data: HARDCODED_FALLBACK });
  }
};


// ─────────────────────────────────────────────────────────────────
// GET /billing
// ─────────────────────────────────────────────────────────────────
export const getBillingStatus = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return apiResponse(res, 401, "Unauthorized");

  try {
    const billing  = await ensureBillingProfile(userId);
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