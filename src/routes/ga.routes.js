import express from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { listGAProperties } from "../controllers/ga.controller.js";

const router = express.Router();
router.get("/properties", authMiddleware, listGAProperties);

export default router;
