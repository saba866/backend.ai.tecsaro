import express from "express"
import { supabase } from "../config/supabase.js"

const router = express.Router()

router.get("/db-test", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("seo_crawl")
      .insert([{
        user_id: "00000000-0000-0000-0000-000000000000",
        plan_id: "00000000-0000-0000-0000-000000000000",
        url: "https://example.com",
        status_code: 200,
        response_time: 111,
        issues: { test: "db-test" }
      }])
      .select()

    if (error) throw error

    return res.json({ success: true, data })
  } catch (err) {
    console.error("❌ DB TEST ERROR:", err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
