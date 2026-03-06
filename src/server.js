



import dotenv from "dotenv";
dotenv.config();

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLERS
// Must be registered before any other imports
// ─────────────────────────────────────────
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise);
  if (reason instanceof Error) {
    console.error("Error Message:", reason.message);
    console.error("Stack Trace:",   reason.stack);
  } else if (typeof reason === "object" && reason !== null) {
    console.error("Rejection Reason:", JSON.stringify(reason, null, 2));
  } else {
    console.error("Rejection Reason:", reason);
  }
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:");
  console.error("Error Message:", error.message);
  console.error("Stack Trace:",   error.stack);
  process.exit(1);
});

// ─────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────
import express      from "express";
import cors         from "cors";
import cookieParser from "cookie-parser";

import { startAllCrons } from "./cron/index.js";

// ── Routes ──
import paymentRoutes      from "./routes/paymentRoutes.js";
import authRoutes         from "./routes/auth.routes.js";
import planRoutes         from "./routes/plan.routes.js";
import gaRoutes           from "./routes/ga.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";
import googleRoutes       from "./routes/google.routes.js";
import pricingRoutes      from "./routes/pricingRoutes.js";
import aeoRoutes          from "./routes/aeo.routes.js";
import testRoute          from "./routes/test.route.js";
import profileRoutes from "./routes/profile.routes.js";
import billingRoutes from "./routes/billing.routes.js";

// ─────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────
const app = express();

app.use(cookieParser());

app.use(cors({
  origin:      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:  "ok",
    backend: "running",
    time:    new Date().toISOString(),
  });
});

// Webhook must be before express.json()
// app.post(
//   "/billing/webhook",
//   express.raw({ type: "application/json" }),
//   billingWebhook
// );

// Webhook must be before express.json()

app.use(express.json());
// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────
app.use("/payments", paymentRoutes);
app.use("/auth",             authRoutes);
app.use("/plans",            planRoutes);
app.use("/profile", profileRoutes);
app.use("/billing", billingRoutes);
app.use("/api/ga",           gaRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/google",       googleRoutes);
app.use("/aeo",              aeoRoutes);
app.use("/",                 pricingRoutes);
app.use("/",                 testRoute);

// ─────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error:   "Not Found",
    message: `Route ${req.method} ${req.path} does not exist`,
  });
});

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Express Error Handler:");
  console.error("Error Message:", err.message);
  console.error("Stack Trace:",   err.stack);

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
//   console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

//   // Start all cron jobs after server is listening
//   startAllCrons();
// });

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

  try {
    startAllCrons();
    console.log("✅ Cron jobs started");
  } catch (error) {
    console.error("❌ Cron startup error:", error);
  }
});