import crypto    from "crypto"
import Razorpay  from "razorpay"
import { supabase } from "../config/supabase.js"
import apiResponse   from "../utils/apiResponse.js"
import { activateSubscription } from "../services/subscriptionService.js"

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// ─────────────────────────────────────────────────────────────────
// DISCOUNT MAP — add new discount % here when you create new
// Razorpay plans. That's the only time you touch this file.
// ─────────────────────────────────────────────────────────────────
const DISCOUNT_PLAN_MAP = {
  30: {
    starter:        process.env.RAZORPAY_PLAN_STARTER_30OFF,
    starter_yearly: process.env.RAZORPAY_PLAN_STARTER_YEARLY_30OFF,
  },
  50: {
    starter:        process.env.RAZORPAY_PLAN_STARTER_50OFF,
    starter_yearly: process.env.RAZORPAY_PLAN_STARTER_YEARLY_50OFF,
  },
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
async function getCoupon(code) {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("is_active", true)
    .single()

  if (error || !data)  return { error: "Invalid coupon code" }
  if (data.expires_at && new Date(data.expires_at) < new Date())
    return { error: "Coupon has expired" }
  if (data.max_uses !== null && data.used_count >= data.max_uses)
    return { error: "Coupon usage limit reached" }

  return { coupon: data }
}

async function hasRedeemed(couponId, userId) {
  const { data } = await supabase
    .from("coupon_redemptions")
    .select("id")
    .eq("coupon_id", couponId)
    .eq("user_id", userId)
    .maybeSingle()
  return !!data
}

async function recordRedemption(couponId, userId, planId) {
  await supabase.from("coupon_redemptions").insert({
    coupon_id:  couponId,
    user_id:    userId,
    project_id: planId ?? null,
  })
  await supabase
    .from("coupons")
    .update({ used_count: supabase.rpc("increment", { x: 1 }) })
    .eq("id", couponId)

  // Simple increment fallback
  const { data: c } = await supabase.from("coupons").select("used_count").eq("id", couponId).single()
  await supabase.from("coupons").update({ used_count: (c?.used_count ?? 0) + 1 }).eq("id", couponId)
}

async function ensureCustomer(userId, email, name) {
  const { data: billing } = await supabase
    .from("billing_profiles")
    .select("razorpay_customer_id")
    .eq("user_id", userId)
    .single()

  if (billing?.razorpay_customer_id) return billing.razorpay_customer_id

  const customer = await razorpay.customers.create({ name: name ?? email, email, fail_existing: 0 })
  await supabase.from("billing_profiles")
    .update({ razorpay_customer_id: customer.id })
    .eq("user_id", userId)
  return customer.id
}

// ─────────────────────────────────────────────────────────────────
// POST /coupons/validate
// Just checks — no side effects
// ─────────────────────────────────────────────────────────────────
export const validateCoupon = async (req, res) => {
  const userId        = req.user?.id
  const { code }      = req.body

  if (!code) return apiResponse(res, 400, "Coupon code required")

  const { coupon, error } = await getCoupon(code)
  if (error) return apiResponse(res, 400, error)

  if (await hasRedeemed(coupon.id, userId))
    return apiResponse(res, 400, "You have already used this coupon")

  const isBeta     = coupon.discount_type === "percent" && coupon.discount_value === 100
  const isDiscount = coupon.discount_type === "percent" && coupon.discount_value < 100
  const isTrial    = coupon.discount_type === "trial_days" || coupon.discount_type === "fixed"

  let message = ""
  let trialDays = null

  if (isBeta) {
    message   = "🎉 100% free! Pay ₹1 to activate 30 days free access."
    trialDays = 30
  } else if (isDiscount) {
    message = `🎉 ${coupon.discount_value}% discount applied on your subscription!`
  } else if (isTrial) {
    trialDays = coupon.discount_value ?? 30
    message   = `🎉 ${trialDays}-day free trial extension unlocked!`
  }

  return apiResponse(res, 200, "Coupon valid", {
    code:           coupon.code,
    discount_type:  coupon.discount_type,
    discount_value: coupon.discount_value,
    trial_days:     trialDays,
    is_beta:        isBeta,
    is_discount:    isDiscount,
    is_trial:       isTrial,
    message,
  })
}

// ─────────────────────────────────────────────────────────────────
// POST /coupons/apply
// Trial extension only — no payment
// ─────────────────────────────────────────────────────────────────
export const applyCoupon = async (req, res) => {
  const userId        = req.user?.id
  const { code, planId } = req.body

  if (!code || !planId) return apiResponse(res, 400, "code and planId required")

  const { coupon, error } = await getCoupon(code)
  if (error) return apiResponse(res, 400, error)

  if (coupon.discount_type === "percent")
    return apiResponse(res, 400, "This coupon requires payment — use the checkout flow")

  if (await hasRedeemed(coupon.id, userId))
    return apiResponse(res, 400, "You have already used this coupon")

  const { data: plan } = await supabase
    .from("plans")
    .select("id, trial_ends_at")
    .eq("id", planId)
    .eq("user_id", userId)
    .single()

  if (!plan) return apiResponse(res, 404, "Plan not found")

  const trialDays   = coupon.discount_value ?? 30
  const newTrialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)

  await supabase
    .from("plans")
    .update({ trial_ends_at: newTrialEnd.toISOString() })
    .eq("id", planId)
    .eq("user_id", userId)

  await recordRedemption(coupon.id, userId, planId)

  console.log(`🎟️ Trial extended: user=${userId} plan=${planId} days=${trialDays}`)

  return apiResponse(res, 200, "Trial extended!", {
    trial_ends_at: newTrialEnd.toISOString(),
    trial_days:    trialDays,
    message:       `Your trial has been extended by ${trialDays} days!`,
  })
}

// ─────────────────────────────────────────────────────────────────
// POST /coupons/create-symbolic-order
// Beta 100% — ₹1 Razorpay order
// ─────────────────────────────────────────────────────────────────
export const createSymbolicOrder = async (req, res) => {
  const userId        = req.user?.id
  const email         = req.user?.email
  const { code, planId } = req.body

  if (!code || !planId) return apiResponse(res, 400, "code and planId required")

  const { coupon, error } = await getCoupon(code)
  if (error) return apiResponse(res, 400, error)

  if (coupon.discount_type !== "percent" || coupon.discount_value !== 100)
    return apiResponse(res, 400, "This coupon is not a 100% discount coupon")

  if (await hasRedeemed(coupon.id, userId))
    return apiResponse(res, 400, "You have already used this coupon")

  try {
    const order = await razorpay.orders.create({
      amount:   100, // ₹1 in paise
      currency: "INR",
      notes:    { supabase_user_id: userId, coupon_code: code, plan_id: planId },
    })

    return apiResponse(res, 200, "Order created", {
      order_id:        order.id,
      amount:          100,
      currency:        "INR",
      razorpay_key_id: process.env.RAZORPAY_KEY_ID,
      email,
    })
  } catch (err) {
    console.error("[createSymbolicOrder]", err)
    return apiResponse(res, 500, "Failed to create order")
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /coupons/verify-symbolic-order
// Beta 100% — verify ₹1 payment and activate 30 days
// ─────────────────────────────────────────────────────────────────
export const verifySymbolicOrder = async (req, res) => {
  const userId = req.user?.id
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    code,
    planId,
  } = req.body

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !code || !planId)
    return apiResponse(res, 400, "Missing required fields")

  const body     = `${razorpay_order_id}|${razorpay_payment_id}`
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex")

  if (expected !== razorpay_signature)
    return apiResponse(res, 400, "Payment verification failed — invalid signature")

  const { coupon, error } = await getCoupon(code)
  if (error) return apiResponse(res, 400, error)

  const trialDays   = 30
  const newTrialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)

  await supabase
    .from("plans")
    .update({ trial_ends_at: newTrialEnd.toISOString() })
    .eq("id", planId)
    .eq("user_id", userId)

  await recordRedemption(coupon.id, userId, planId)

  await supabase.from("razorpay_orders").insert({
    user_id:             userId,
    razorpay_order_id,
    razorpay_payment_id,
    amount:              100,
    currency:            "INR",
    status:              "paid",
    pricing_plan_slug:   "beta",
  }).select().maybeSingle()

  console.log(`🎟️ Beta activated: user=${userId} plan=${planId} trial_end=${newTrialEnd.toISOString()}`)

  return apiResponse(res, 200, "Plan activated!", {
    trial_ends_at: newTrialEnd.toISOString(),
    trial_days:    trialDays,
    message:       "🎉 Your 30-day free access has been activated!",
  })
}

// ─────────────────────────────────────────────────────────────────
// POST /coupons/create-discounted-subscription
// 30% / 50% discount — creates Razorpay subscription on discounted plan
// ─────────────────────────────────────────────────────────────────
export const createDiscountedSubscription = async (req, res) => {
  const userId        = req.user?.id
  const email         = req.user?.email
  const name          = req.user?.user_metadata?.full_name ?? req.user?.user_metadata?.name ?? email
  const { code, planKey, interval } = req.body

  if (!code || !planKey) return apiResponse(res, 400, "code and planKey required")

  const { coupon, error } = await getCoupon(code)
  if (error) return apiResponse(res, 400, error)

  if (coupon.discount_type !== "percent" || coupon.discount_value === 100)
    return apiResponse(res, 400, "This coupon is not a discount coupon")

  if (await hasRedeemed(coupon.id, userId))
    return apiResponse(res, 400, "You have already used this coupon")

  const discountedPlanId = DISCOUNT_PLAN_MAP[coupon.discount_value]?.[planKey]
  if (!discountedPlanId)
    return apiResponse(res, 400, `No Razorpay plan found for ${planKey} at ${coupon.discount_value}% off — contact support`)

  try {
    const customerId = await ensureCustomer(userId, email, name)

    const subscription = await razorpay.subscriptions.create({
      plan_id:         discountedPlanId,
      customer_notify: 1,
      total_count:     12,
      quantity:        1,
      notes: {
        supabase_user_id: userId,
        plan:             planKey,
        coupon_code:      code,
        discount:         `${coupon.discount_value}%`,
      },
    })

    await supabase.from("billing_profiles")
      .update({ razorpay_subscription_id: subscription.id, subscription_status: "created" })
      .eq("user_id", userId)

    console.log(`💸 Discounted subscription created: user=${userId} plan=${planKey} discount=${coupon.discount_value}%`)

    return apiResponse(res, 200, "Discounted subscription created", {
      subscription_id:  subscription.id,
      razorpay_key_id:  process.env.RAZORPAY_KEY_ID,
      discount_value:   coupon.discount_value,
      original_plan:    planKey,
    })
  } catch (err) {
    console.error("[createDiscountedSubscription]", err)
    return apiResponse(res, 500, err?.error?.description ?? "Failed to create subscription")
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /coupons/verify-discounted-subscription
// 30% / 50% — verify payment and activate plan
// ─────────────────────────────────────────────────────────────────
export const verifyDiscountedSubscription = async (req, res) => {
  const userId = req.user?.id
  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    code,
    planKey,
    interval,
    planId,
  } = req.body

  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature)
    return apiResponse(res, 400, "Missing payment verification fields")

  const body     = `${razorpay_payment_id}|${razorpay_subscription_id}`
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex")

  if (expected !== razorpay_signature)
    return apiResponse(res, 400, "Payment verification failed — invalid signature")

  const { coupon, error } = await getCoupon(code)
  if (error) return apiResponse(res, 400, error)

  try {
    await activateSubscription({
      userId,
      planSlug:               planKey ?? "starter",
      billingInterval:        interval ?? "monthly",
      razorpaySubscriptionId: razorpay_subscription_id,
    })

    await recordRedemption(coupon.id, userId, planId ?? null)

    await supabase.from("razorpay_orders").insert({
      user_id:             userId,
      razorpay_order_id:   razorpay_subscription_id,
      razorpay_payment_id,
      currency:            "INR",
      status:              "paid",
      pricing_plan_slug:   planKey,
      billing_interval:    interval ?? "monthly",
    }).select().maybeSingle()

    console.log(`✅ Discounted subscription verified: user=${userId} plan=${planKey} discount=${coupon.discount_value}%`)

    return apiResponse(res, 200, "Plan activated!", {
      plan:    planKey,
      message: `🎉 ${planKey} plan activated at ${coupon.discount_value}% off!`,
    })
  } catch (err) {
    console.error("[verifyDiscountedSubscription]", err)
    return apiResponse(res, 500, "Failed to activate plan")
  }
}