import express from "express";
import {
  getBillingStatus,
  getBillingUsage,
  getBillingInvoices,
  createSubscription,
  verifyPayment,
  cancelSubscription,
  billingWebhook,
} from "../controllers/billingController.js";
import { authMiddleware } from "../middlewares/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// WEBHOOK — raw body required for HMAC signature verification
// ─────────────────────────────────────────────────────────────────
router.post("/webhook", express.raw({ type: "application/json" }), billingWebhook);

// ─────────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES
// ─────────────────────────────────────────────────────────────────
router.get("/",         authMiddleware, getBillingStatus);   // plan + subscription info
router.get("/usage",    authMiddleware, getBillingUsage);    // prompts/pages/competitors usage
router.get("/invoices", authMiddleware, getBillingInvoices); // invoice history

router.post("/subscribe", authMiddleware, createSubscription); // create Razorpay subscription
router.post("/verify",    authMiddleware, verifyPayment);      // verify + activate after checkout
router.post("/cancel",    authMiddleware, cancelSubscription); // cancel subscription

export default router;