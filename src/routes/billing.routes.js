




import express from "express";
import { authMiddleware } from "../middlewares/auth.js";
import {
  getBillingStatus,
  getBillingUsage,
  getBillingInvoices,
  createSubscription,
  verifyPayment,
  cancelSubscription,
  billingWebhook,  
  getPlanPricing,    // ← NEW
} from "../controllers/billingController.js";

const router = express.Router();

// ── Public pricing (used by CheckoutModal — no hardcoded prices on frontend) ──
router.get("/plans/pricing",  getPlanPricing);

// ── Billing status & usage ──
router.get("/",        authMiddleware, getBillingStatus);
router.get("/usage",   authMiddleware, getBillingUsage);
router.get("/invoices",authMiddleware, getBillingInvoices);

// ── Subscription lifecycle ──
router.post("/subscribe", authMiddleware, createSubscription);
router.post("/verify",    authMiddleware, verifyPayment);
router.post("/cancel",    authMiddleware, cancelSubscription);

// ── Razorpay webhook — raw body required, no auth ──
router.post("/webhook", billingWebhook);

export default router;