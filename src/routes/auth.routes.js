import express from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { saveGoogleTokens } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/google", authMiddleware, saveGoogleTokens);

export default router;
