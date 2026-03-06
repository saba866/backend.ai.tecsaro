import express from "express";
import {
  getPricingPlans,
  createProject,
  getProjectPlan,
  changeProjectPlan
} from "../controllers/pricingController.js";

const router = express.Router();

router.get("/pricing", getPricingPlans);
router.post("/project/create", createProject);
router.get("/project/:id/plan", getProjectPlan);
router.post("/project/change-plan", changeProjectPlan);

export default router;