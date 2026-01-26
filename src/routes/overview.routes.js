import express from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { getOverviewData } from "../controllers/overview.controller.js";

const router = express.Router();

router.get("/:projectId", authMiddleware, getOverviewData);

export default router;
