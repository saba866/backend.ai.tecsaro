// src/routes/paymentRoutes.js
import express from "express";
import {
  createOrder,
  verifyPayment,
  handleWebhook,
  getBillingStatus,
} from "../controllers/paymentController.js";

import { authMiddleware } from "../middlewares/auth.js";
const router = express.Router();

// ─────────────────────────────────────────
// WEBHOOK — must use express.raw() NOT express.json()
// Razorpay sends raw body that we need to verify HMAC
// This route is public (no auth) — Razorpay calls it directly
// ─────────────────────────────────────────
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// ─────────────────────────────────────────
// AUTHENTICATED ROUTES
// ─────────────────────────────────────────
router.post("/create-order", authMiddleware, createOrder);
router.post("/verify",       authMiddleware, verifyPayment);
router.get("/status",        authMiddleware, getBillingStatus);

export default router;

// ─────────────────────────────────────────
// HOW TO REGISTER IN server.js:
//
// import paymentRoutes from "./routes/paymentRoutes.js";
//
// ⚠️  Register payment routes BEFORE app.use(express.json())
// The /webhook route applies express.raw() per-route above,
// but if express.json() runs first globally it breaks body parsing.
//
// app.use("/api/payments", paymentRoutes);  // ← BEFORE json()
// app.use(express.json());                  // ← your existing line
// ─────────────────────────────────────────