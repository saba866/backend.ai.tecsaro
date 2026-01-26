import express from "express";
import { getPerformance } from "../controllers/performance.controller.js";
import { authMiddleware } from "../middlewares/auth.js";

const router = express.Router();
router.get("/:projectId", authMiddleware, getPerformance);
export default router;
