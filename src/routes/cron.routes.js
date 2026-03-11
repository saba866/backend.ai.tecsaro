import express from "express"
import { expireTrials }          from "../cron/expireTrial.js"
import { resetMonthlyUsage }     from "../cron/resetUsage.js"
import { checkSubscriptions }    from "../cron/subscription.js"
import { sendDailyReports, sendMonthlyReports } from "../cron/sendReports.js"
import { runDailyVisibility, runMonthlyFullPipeline } from "../cron/runDailyVisibility.js"

const router = express.Router()

// ── Auth middleware — only Cloud Scheduler can call these ────────
const cronAuth = (req, res, next) => {
  const secret = req.headers["x-cron-secret"]
  if (secret !== process.env.CRON_SECRET) {
    console.warn(`⛔ [cronAuth] Unauthorized attempt from ${req.ip}`)
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

// ── Routes ───────────────────────────────────────────────────────
// Daily 00:00 UTC
router.post("/expire-trials",        cronAuth, async (req, res) => {
  try {
    const result = await expireTrials()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Daily 01:00 UTC
router.post("/subscription-check",   cronAuth, async (req, res) => {
  try {
    const result = await checkSubscriptions()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// 1st of month 00:05 UTC
router.post("/reset-usage",          cronAuth, async (req, res) => {
  try {
    const result = await resetMonthlyUsage()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Daily 02:00 UTC
router.post("/daily-visibility",     cronAuth, async (req, res) => {
  try {
    const result = await runDailyVisibility()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// 1st of month 03:00 UTC
router.post("/monthly-pipeline",     cronAuth, async (req, res) => {
  try {
    const result = await runMonthlyFullPipeline()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Daily 09:00 UTC
router.post("/send-daily-reports",   cronAuth, async (req, res) => {
  try {
    const result = await sendDailyReports()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// 1st of month 10:00 UTC
router.post("/send-monthly-reports", cronAuth, async (req, res) => {
  try {
    const result = await sendMonthlyReports()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

export default router