// src/controllers/paymentController.js
// No DB logic here — all delegated to subscriptionService
import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import apiResponse from "../utils/apiResponse.js";
import {
  ensureBillingProfile,
  getBillingProfile,
  activateSubscription,
  deactivateSubscription,
  flagPaymentFailed,
  saveOrder,
  updateOrderStatus,
  isWebhookProcessed,
  saveWebhookEvent,
  getUserBySubscriptionId,
  getUserByOrderId,
} from "../services/subscriptionService.js";

// ─────────────────────────────────────────
// CREATE ORDER
// POST /api/payments/create-order
// Body: { planSlug, billingInterval, amount, currency? }
//
// Flow:
// 1. Frontend calls this with plan details
// 2. We create a Razorpay order and return order_id
// 3. Frontend opens Razorpay checkout with order_id
// 4. On success, frontend calls /verify
// ─────────────────────────────────────────
export const createOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return apiResponse(res, 401, "Unauthorized");

    const {
      planSlug,
      billingInterval = "monthly",
      amount,           // in paise — ₹499 = 49900
      currency = "INR",
    } = req.body;

    if (!planSlug || !amount) {
      return apiResponse(res, 400, "planSlug and amount are required");
    }

    // Ensure billing profile row exists for this user
    await ensureBillingProfile(userId);

    // Create order in Razorpay
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: `rcpt_${userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        user_id:          userId,
        plan_slug:        planSlug,
        billing_interval: billingInterval,
      },
    });

    console.log(`📦 [createOrder] ${order.id} | user=${userId} | plan=${planSlug} | ₹${amount / 100}`);

    // Persist to DB for webhook lookup and audit trail
    await saveOrder({
      userId,
      razorpayOrderId: order.id,
      amount,
      currency,
      planSlug,
      billingInterval,
      notes: order.notes,
    });

    return apiResponse(res, 200, "Order created", {
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      key:      process.env.RAZORPAY_KEY_ID, // frontend needs this for checkout
    });

  } catch (err) {
    console.error("❌ [createOrder]", err.message);
    return apiResponse(res, 500, "Failed to create order");
  }
};

// ─────────────────────────────────────────
// VERIFY PAYMENT
// POST /api/payments/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, planSlug, billingInterval }
//
// Flow:
// 1. Frontend sends the 3 Razorpay values after checkout
// 2. We verify HMAC signature (prevents fraud)
// 3. On valid signature → activate subscription
// ─────────────────────────────────────────
export const verifyPayment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return apiResponse(res, 401, "Unauthorized");

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planSlug,
      billingInterval = "monthly",
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return apiResponse(res, 400, "razorpay_order_id, razorpay_payment_id and razorpay_signature required");
    }

    // ── VERIFY HMAC SIGNATURE ──
    // Razorpay signs: "order_id|payment_id" with your key_secret
    // If this doesn't match, the request is fraudulent
    const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      console.warn(`⚠️  [verifyPayment] Invalid signature: user=${userId} order=${razorpay_order_id}`);
      return apiResponse(res, 400, "Payment verification failed — invalid signature");
    }

    // ── ACTIVATE SUBSCRIPTION ──
    await activateSubscription({ userId, planSlug, billingInterval });

    // ── UPDATE ORDER RECORD ──
    await updateOrderStatus({
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status:            "paid",
    });

    console.log(`✅ [verifyPayment] user=${userId} payment=${razorpay_payment_id}`);

    return apiResponse(res, 200, "Payment verified — subscription activated", {
      planSlug,
      billingInterval,
    });

  } catch (err) {
    console.error("❌ [verifyPayment]", err.message);
    return apiResponse(res, 500, "Payment verification failed");
  }
};

// ─────────────────────────────────────────
// WEBHOOK HANDLER
// POST /api/payments/webhook
//
// ⚠️  This route MUST use express.raw() middleware
//     (not express.json) so we can verify the signature.
//     This is handled in paymentRoutes.js per-route.
//
// Events handled:
//   payment.captured         → activate
//   subscription.activated   → activate
//   subscription.cancelled   → deactivate
//   subscription.halted      → flag payment failed
//   subscription.completed   → deactivate (ended naturally)
// ─────────────────────────────────────────
export const handleWebhook = async (req, res) => {
  try {
    const webhookSecret     = process.env.RAZORPAY_WEBHOOK_SECRET;
    const receivedSignature = req.headers["x-razorpay-signature"];

    // ── VERIFY WEBHOOK SIGNATURE ──
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body) // req.body is raw Buffer here
      .digest("hex");

    if (receivedSignature !== expectedSignature) {
      console.warn("⚠️  [webhook] Invalid signature — rejected");
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    // Parse after signature verified
    const event   = JSON.parse(req.body.toString());
    const eventId = event.id;
    const type    = event.event;
    const payload = event.payload;

    console.log(`\n📡 [webhook] ${type} | id=${eventId}`);

    // ── IDEMPOTENCY CHECK ──
    // Razorpay retries failed webhooks — prevent double-processing
    const alreadyDone = await isWebhookProcessed(eventId);
    if (alreadyDone) {
      console.log(`⏭️  [webhook] Already processed: ${eventId}`);
      return res.status(200).json({ status: "already_processed" });
    }

    // ── ROUTE BY EVENT TYPE ──
    switch (type) {

      case "payment.captured": {
        const payment        = payload.payment?.entity;
        const orderId        = payment?.order_id;
        const subscriptionId = payload.subscription?.entity?.id || null;

        let userId, planSlug, billingInterval;

        if (subscriptionId) {
          const profile = await getUserBySubscriptionId(subscriptionId);
          if (!profile) { console.warn(`No profile for sub: ${subscriptionId}`); break; }
          userId = profile.user_id;
          planSlug = profile.current_plan_slug;
          billingInterval = profile.billing_interval;
        } else if (orderId) {
          const record = await getUserByOrderId(orderId);
          if (!record) { console.warn(`No order record: ${orderId}`); break; }
          userId = record.user_id;
          planSlug = record.pricing_plan_slug;
          billingInterval = record.billing_interval;

          await updateOrderStatus({
            razorpayOrderId:   orderId,
            razorpayPaymentId: payment.id,
            status:            "paid",
          });
        } else {
          console.warn(`⚠️  payment.captured has no order_id or subscription_id`);
          break;
        }

        await activateSubscription({
          userId, planSlug, billingInterval,
          razorpaySubscriptionId: subscriptionId,
          razorpayCustomerId:     payment?.customer_id || null,
        });

        console.log(`✅ [webhook] payment.captured → activated: user=${userId}`);
        break;
      }

      case "subscription.activated": {
        const sub = payload.subscription?.entity;
        if (!sub) break;

        const profile = await getUserBySubscriptionId(sub.id);
        if (!profile) { console.warn(`No profile for sub: ${sub.id}`); break; }

        await activateSubscription({
          userId:                 profile.user_id,
          planSlug:               profile.current_plan_slug,
          billingInterval:        profile.billing_interval,
          razorpaySubscriptionId: sub.id,
        });

        console.log(`✅ [webhook] subscription.activated: user=${profile.user_id}`);
        break;
      }

      case "subscription.cancelled": {
        const sub = payload.subscription?.entity;
        if (!sub) break;
        const profile = await getUserBySubscriptionId(sub.id);
        if (!profile) break;
        await deactivateSubscription(profile.user_id, "cancelled");
        console.log(`⚠️  [webhook] subscription.cancelled: user=${profile.user_id}`);
        break;
      }

      case "subscription.halted": {
        // Payment failed — Razorpay is retrying
        // Flag but don't downgrade yet (grace period)
        const sub = payload.subscription?.entity;
        if (!sub) break;
        const profile = await getUserBySubscriptionId(sub.id);
        if (!profile) break;
        await flagPaymentFailed(profile.user_id);
        console.log(`🚨 [webhook] subscription.halted: user=${profile.user_id}`);
        break;
      }

      case "subscription.completed": {
        // All billing cycles completed — subscription ended naturally
        const sub = payload.subscription?.entity;
        if (!sub) break;
        const profile = await getUserBySubscriptionId(sub.id);
        if (!profile) break;
        await deactivateSubscription(profile.user_id, "completed");
        console.log(`⚠️  [webhook] subscription.completed: user=${profile.user_id}`);
        break;
      }

      default:
        console.log(`ℹ️  [webhook] Unhandled event: ${type}`);
    }

    // ── LOG EVENT (idempotency record) ──
    await saveWebhookEvent({ razorpayEventId: eventId, eventType: type, payload: event });

    // Always 200 — returning 500 causes Razorpay to retry indefinitely
    return res.status(200).json({ status: "ok" });

  } catch (err) {
    console.error("❌ [webhook] Crashed:", err.message);
    return res.status(200).json({ status: "error", message: err.message });
  }
};

// ─────────────────────────────────────────
// GET BILLING STATUS
// GET /api/payments/status
// ─────────────────────────────────────────
export const getBillingStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return apiResponse(res, 401, "Unauthorized");

    const profile = await getBillingProfile(userId);
    if (!profile) return apiResponse(res, 404, "Billing profile not found");

    return apiResponse(res, 200, "Billing status", {
      plan:               profile.plan,
      status:             profile.status,
      subscriptionStatus: profile.subscription_status,
      currentPlanSlug:    profile.current_plan_slug,
      billingInterval:    profile.billing_interval,
      nextBillingDate:    profile.next_billing_date,
    });

  } catch (err) {
    console.error("❌ [getBillingStatus]", err.message);
    return apiResponse(res, 500, "Failed to load billing status");
  }
};