// src/services/subscriptionService.js
// ALL database logic lives here — never in controllers
import { supabase } from "../config/supabase.js";

// ─────────────────────────────────────────
// GET BILLING PROFILE
// ─────────────────────────────────────────
export async function getBillingProfile(userId) {
  const { data, error } = await supabase
    .from("billing_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch billing profile: ${error.message}`);
  return data;
}

// ─────────────────────────────────────────
// ENSURE BILLING PROFILE EXISTS
// Creates one if missing — call before every order
// ─────────────────────────────────────────
export async function ensureBillingProfile(userId) {
  const existing = await getBillingProfile(userId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("billing_profiles")
    .insert({
      user_id:              userId,
      subscription_status:  "trial",
      status:               "trial",
      current_plan_slug:    "starter",
      plan:                 "starter",
      billing_interval:     "monthly",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create billing profile: ${error.message}`);
  return data;
}

// ─────────────────────────────────────────
// ACTIVATE SUBSCRIPTION AFTER PAYMENT
//
// billing_profiles columns updated:
//   subscription_status, status, current_plan_slug,
//   plan, billing_interval, next_billing_date,
//   razorpay_subscription_id, razorpay_customer_id,
//   updated_at
//
// plans columns updated:
//   tier, subscription_status,
//   current_period_start, current_period_end
// ─────────────────────────────────────────
export async function activateSubscription({
  userId,
  planSlug,
  billingInterval        = "monthly",
  razorpaySubscriptionId = null,
  razorpayCustomerId     = null,
}) {
  const now             = new Date();
  const periodDays      = billingInterval === "yearly" ? 365 : 30;
  const nextBillingDate = new Date(now);
  nextBillingDate.setDate(nextBillingDate.getDate() + periodDays);

  // Derive tier: "starter_yearly" → "starter", "pro" → "pro"
  const tier = planSlug.replace("_yearly", "").replace("_monthly", "");

  // ── UPDATE billing_profiles ──
  const billingPayload = {
    subscription_status: "active",
    status:              "active",
    current_plan_slug:   planSlug,
    plan:                tier,
    billing_interval:    billingInterval,
    next_billing_date:   nextBillingDate.toISOString(),
    updated_at:          now.toISOString(),
  };

  if (razorpaySubscriptionId) billingPayload.razorpay_subscription_id = razorpaySubscriptionId;
  if (razorpayCustomerId)     billingPayload.razorpay_customer_id     = razorpayCustomerId;

  const { error: billingErr } = await supabase
    .from("billing_profiles")
    .update(billingPayload)
    .eq("user_id", userId);

  if (billingErr) throw new Error(`Billing profile update failed: ${billingErr.message}`);

  // ── UPDATE plans ──
  const plansPayload = {
    tier,
    subscription_status:  "active",
    current_period_start: now.toISOString(),
    current_period_end:   nextBillingDate.toISOString(),
  };
  if (razorpaySubscriptionId) plansPayload.razorpay_subscription_id = razorpaySubscriptionId;

  const { error: plansErr } = await supabase
    .from("plans")
    .update(plansPayload)
    .eq("user_id", userId);

  if (plansErr) {
    // Non-fatal — billing_profiles is source of truth
    console.warn(`⚠️  [subscriptionService] plans update failed (non-fatal): ${plansErr.message}`);
  }

  console.log(`✅ [subscriptionService] Activated: user=${userId} plan=${planSlug} interval=${billingInterval}`);
  return { userId, planSlug, tier, nextBillingDate: nextBillingDate.toISOString() };
}

// ─────────────────────────────────────────
// DEACTIVATE — DOWNGRADE TO FREE
// ─────────────────────────────────────────
export async function deactivateSubscription(userId, reason = "cancelled") {
  const now = new Date().toISOString();

  await supabase.from("billing_profiles").update({
    subscription_status: reason,
    status:              "expired",
    current_plan_slug:   "free",
    plan:                "free",
    updated_at:          now,
  }).eq("user_id", userId);

  await supabase.from("plans").update({
    tier:                "free",
    subscription_status: "expired",
  }).eq("user_id", userId);

  console.log(`⚠️  [subscriptionService] Deactivated: user=${userId} reason=${reason}`);
}

// ─────────────────────────────────────────
// FLAG PAYMENT FAILED — grace period, no downgrade yet
// ─────────────────────────────────────────
export async function flagPaymentFailed(userId) {
  await supabase.from("billing_profiles").update({
    subscription_status: "payment_failed",
    updated_at:          new Date().toISOString(),
  }).eq("user_id", userId);

  console.log(`🚨 [subscriptionService] Payment failed: user=${userId}`);
}

// ─────────────────────────────────────────
// SAVE ORDER (audit trail)
// ─────────────────────────────────────────
export async function saveOrder({
  userId, razorpayOrderId, amount,
  currency, planSlug, billingInterval, notes = {},
}) {
  const { data, error } = await supabase
    .from("razorpay_orders")
    .insert({
      user_id:           userId,
      razorpay_order_id: razorpayOrderId,
      amount,
      currency,
      status:            "created",
      pricing_plan_slug: planSlug,
      billing_interval:  billingInterval,
      notes,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save order: ${error.message}`);
  return data;
}

// ─────────────────────────────────────────
// UPDATE ORDER STATUS AFTER PAYMENT
// ─────────────────────────────────────────
export async function updateOrderStatus({
  razorpayOrderId, razorpayPaymentId,
  razorpaySignature = null, status,
}) {
  const { error } = await supabase
    .from("razorpay_orders")
    .update({
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature:  razorpaySignature,
      status,
      updated_at:          new Date().toISOString(),
    })
    .eq("razorpay_order_id", razorpayOrderId);

  if (error) throw new Error(`Failed to update order: ${error.message}`);
}

// ─────────────────────────────────────────
// WEBHOOK IDEMPOTENCY
// ─────────────────────────────────────────
export async function isWebhookProcessed(razorpayEventId) {
  const { data } = await supabase
    .from("razorpay_webhook_events")
    .select("id")
    .eq("razorpay_event_id", razorpayEventId)
    .maybeSingle();
  return !!data;
}

export async function saveWebhookEvent({
  razorpayEventId, eventType, payload, status = "processed",
}) {
  const { error } = await supabase
    .from("razorpay_webhook_events")
    .insert({ razorpay_event_id: razorpayEventId, event_type: eventType, payload, status });

  if (error) console.warn(`⚠️  Webhook log failed: ${error.message}`);
}

// ─────────────────────────────────────────
// LOOKUP HELPERS FOR WEBHOOKS
// ─────────────────────────────────────────
export async function getUserBySubscriptionId(razorpaySubscriptionId) {
  const { data, error } = await supabase
    .from("billing_profiles")
    .select("user_id, current_plan_slug, billing_interval")
    .eq("razorpay_subscription_id", razorpaySubscriptionId)
    .maybeSingle();

  if (error) throw new Error(`Failed to find user by subscription: ${error.message}`);
  return data;
}

export async function getUserByOrderId(razorpayOrderId) {
  const { data, error } = await supabase
    .from("razorpay_orders")
    .select("user_id, pricing_plan_slug, billing_interval")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  if (error) throw new Error(`Failed to find user by order: ${error.message}`);
  return data;
}