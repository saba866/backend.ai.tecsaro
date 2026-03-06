import express from "express";
import { syncProfile, getProfile, updateProfile } from "../controllers/profileController.js";

import {authMiddleware} from "../middlewares/auth.js";

const router = express.Router();
// POST /profile/sync  → called right after signup/login, creates/upserts the profiles row
router.post("/sync",  authMiddleware, syncProfile);

// GET  /profile       → sidebar + settings page
router.get("/",       authMiddleware, getProfile);

// PATCH /profile      → settings page name update (auto-regenerates avatar initial)
router.patch("/",     authMiddleware, updateProfile);

export default router;