import express from "express";
import { authMiddleware } from "../middlewares/auth.js";
import {
  getIntegrations,
  saveApiIntegration,
  verifyScript,
  disconnectIntegration
} from "../controllers/integration.controller.js";

const router = express.Router();

router.get("/", authMiddleware, getIntegrations);
router.post("/connect-api", authMiddleware, saveApiIntegration);
router.post("/verify-script", verifyScript);
router.delete("/:id", authMiddleware, disconnectIntegration);

export default router;
