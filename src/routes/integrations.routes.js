import express from "express"
import { supabase } from "../config/supabase.js"
import { authMiddleware } from "../middlewares/auth.js"

const router = express.Router()
router.get("/status", authMiddleware, async (req, res) => {
  const { data: integrations } = await supabase
    .from("user_integrations")
    .select("provider")
    .eq("user_id", req.user.id)

  const { data: plans } = await supabase
    .from("plans")
    .select("ga_property_id")
    .eq("user_id", req.user.id)

  const hasGoogle = integrations?.some(i => i.provider === "google")
  const hasGA = plans?.some(p => p.ga_property_id)

  res.json({
    google: hasGoogle,
    gaConfigured: hasGA
  })
})


export default router


