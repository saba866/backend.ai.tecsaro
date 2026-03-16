




import express from "express"

import { resetMonthlyUsage }     from "../cron/resetUsage.js"
import { checkSubscriptions }    from "../cron/subscription.js"
import { sendDailyReports, sendMonthlyReports }       from "../cron/sendReports.js"
import { runDailyVisibility, runMonthlyFullPipeline } from "../cron/runDailyVisibility.js"

const router = express.Router()

// ── Auth middleware ───────────────────────────────────────────────
const cronAuth = (req, res, next) => {
  const secret = req.headers["x-cron-secret"]
  if (secret !== process.env.CRON_SECRET) {
    console.warn(`⛔ [cronAuth] Unauthorized attempt from ${req.ip}`)
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

// ── Helper: fire and forget for long-running jobs ────────────────
// Immediately returns 200 so connection doesn't drop
// Job continues running in background
function fireAndForget(res, jobName, jobFn) {
  // Acknowledge immediately
  res.status(200).json({ ok: true, status: "started", job: jobName })

  // Run job in background — don't await
  jobFn()
    .then((result) => {
      console.log(`✅ [${jobName}] completed:`, JSON.stringify(result))
    })
    .catch((err) => {
      console.error(`❌ [${jobName}] failed:`, err.message)
    })
}

// ── Routes ────────────────────────────────────────────────────────

// Daily 00:00 UTC — fast job, await is fine
router.post("/expire-trials", cronAuth, async (req, res) => {
  try {
    const result = await expireTrials()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Daily 01:00 UTC — fast job, await is fine
router.post("/subscription-check", cronAuth, async (req, res) => {
  try {
    const result = await checkSubscriptions()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// 1st of month 00:05 UTC — fast job, await is fine
router.post("/reset-usage", cronAuth, async (req, res) => {
  try {
    const result = await resetMonthlyUsage()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Daily 02:00 UTC — long running, fire and forget
router.post("/daily-visibility", cronAuth, (req, res) => {
  fireAndForget(res, "dailyVisibility", runDailyVisibility)
})

// 1st of month 03:00 UTC — very long running, fire and forget
router.post("/monthly-pipeline", cronAuth, (req, res) => {
  fireAndForget(res, "monthlyPipeline", runMonthlyFullPipeline)
})

// Daily 09:00 UTC — medium job, fire and forget
router.post("/send-daily-reports", cronAuth, (req, res) => {
  fireAndForget(res, "sendDailyReports", sendDailyReports)
})

// 1st of month 10:00 UTC — medium job, fire and forget
router.post("/send-monthly-reports", cronAuth, (req, res) => {
  fireAndForget(res, "sendMonthlyReports", sendMonthlyReports)
})

export default router