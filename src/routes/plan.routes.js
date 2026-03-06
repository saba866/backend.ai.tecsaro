import express from "express";
import { createPlan, getPlans, getPlanById, saveGAProperty } from "../controllers/plan.controller.js";
import {authMiddleware} from "../middlewares/auth.js";

const router = express.Router();

// Create plan
router.post("/", authMiddleware, createPlan);

// Get all plans
router.get("/", authMiddleware, getPlans);

// Get single plan
router.get("/:id", authMiddleware, getPlanById);
router.post("/:id/ga-property", authMiddleware, saveGAProperty)
export default router;
