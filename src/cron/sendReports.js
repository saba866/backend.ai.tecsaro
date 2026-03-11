// import cron from "node-cron";
// import sgMail from "@sendgrid/mail";
// import { supabase } from "../config/supabase.js";

// // ─────────────────────────────────────────
// // SENDGRID SETUP
// // ─────────────────────────────────────────
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "reports@tecsaro.com";
// const FROM_NAME  = "TecSaro AEO Reports";

// // ─────────────────────────────────────────
// // BUILD REPORT EMAIL HTML
// // ─────────────────────────────────────────
// function buildReportEmail(plan, score, breakdown) {
//   const wins   = breakdown?.wins   || 0;
//   const losses = breakdown?.losses || 0;
//   const shared = breakdown?.shared || 0;
//   const missed = breakdown?.missed || 0;
//   const presence = ((breakdown?.brandPresenceRate || 0) * 100).toFixed(1);

//   const scoreColor = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

//   const gapCount  = breakdown?.gapCount            || 0;
//   const recCount  = breakdown?.recommendationCount  || 0;

//   return `
// <!DOCTYPE html>
// <html>
// <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
// <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px;">
//   <div style="max-width: 600px; margin: 0 auto;">

//     <!-- Header -->
//     <div style="text-align: center; margin-bottom: 32px;">
//       <h1 style="color: #10b981; font-size: 24px; margin: 0;">TecSaro AEO</h1>
//       <p style="color: #64748b; margin: 8px 0 0;">Daily Visibility Report</p>
//     </div>

//     <!-- Score Card -->
//     <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
//       <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">AEO Score</p>
//       <div style="font-size: 64px; font-weight: 700; color: ${scoreColor}; line-height: 1;">${score}</div>
//       <div style="color: #475569; font-size: 16px;">/100</div>
//       <p style="margin: 16px 0 0; color: #94a3b8; font-size: 14px;">Brand visibility: <strong style="color: #e2e8f0;">${presence}%</strong> of AI answers</p>
//     </div>

//     <!-- Win/Loss Grid -->
//     <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
//       ${[
//         { label: "Wins",   value: wins,   color: "#10b981" },
//         { label: "Shared", value: shared, color: "#f59e0b" },
//         { label: "Losses", value: losses, color: "#ef4444" },
//         { label: "Missed", value: missed, color: "#64748b" },
//       ].map(item => `
//       <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; text-align: center;">
//         <div style="font-size: 28px; font-weight: 700; color: ${item.color};">${item.value}</div>
//         <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${item.label}</div>
//       </div>`).join("")}
//     </div>

//     <!-- Gaps & Actions -->
//     ${gapCount > 0 ? `
//     <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
//       <h3 style="margin: 0 0 12px; color: #f59e0b; font-size: 16px;">⚠️ ${gapCount} Gap${gapCount !== 1 ? "s" : ""} Found</h3>
//       <p style="margin: 0; color: #94a3b8; font-size: 14px;">
//         AI is not mentioning your brand for ${gapCount} tracked quer${gapCount !== 1 ? "ies" : "y"}.
//         ${recCount > 0 ? `${recCount} action${recCount !== 1 ? "s" : ""} available in your dashboard.` : ""}
//       </p>
//     </div>` : `
//     <div style="background: #1e293b; border: 1px solid #10b981; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
//       <h3 style="margin: 0 0 4px; color: #10b981; font-size: 16px;">✅ No Gaps Found</h3>
//       <p style="margin: 0; color: #94a3b8; font-size: 14px;">Your brand is appearing in all tracked AI queries.</p>
//     </div>`}

//     <!-- CTA -->
//     <div style="text-align: center; margin-bottom: 32px;">
//       <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://app.tecsaro.com"}/dashboard"
//          style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
//         View Full Dashboard →
//       </a>
//     </div>

//     <!-- Footer -->
//     <div style="text-align: center; color: #475569; font-size: 12px; border-top: 1px solid #1e293b; padding-top: 20px;">
//       <p style="margin: 0;">TecSaro · <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications" style="color: #64748b;">Unsubscribe from reports</a></p>
//     </div>

//   </div>
// </body>
// </html>
//   `.trim();
// }

// // ─────────────────────────────────────────
// // SEND REPORT FOR A SINGLE PLAN
// // ─────────────────────────────────────────
// async function sendPlanReport(plan, userEmail, userName) {
//   try {
//     // Load latest score for this plan
//     const { data: latestScore } = await supabase
//       .from("aeo_scores")
//       .select("score, breakdown, created_at")
//       .eq("plan_id", plan.id)
//       .order("created_at", { ascending: false })
//       .limit(1)
//       .maybeSingle();

//     if (!latestScore) {
//       console.log(`   ⏭️  No score found for plan "${plan.name}" — skipping`);
//       return false;
//     }

//     const score     = latestScore.score || 0;
//     const breakdown = latestScore.breakdown || {};

//     const html = buildReportEmail(plan, score, breakdown);

//     await sgMail.send({
//       to:      { email: userEmail, name: userName || userEmail },
//       from:    { email: FROM_EMAIL, name: FROM_NAME },
//       subject: `Your AEO Score: ${score}/100 — ${plan.name} Daily Report`,
//       html,
//       text: `Your AEO score for ${plan.name} is ${score}/100. Brand presence: ${((breakdown.brandPresenceRate || 0) * 100).toFixed(1)}%. Wins: ${breakdown.wins || 0}, Losses: ${breakdown.losses || 0}. View dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
//     });

//     console.log(`   ✅ Report sent: ${userEmail} | Score: ${score}/100`);
//     return true;

//   } catch (err) {
//     console.error(`   ❌ Failed to send report to ${userEmail}:`, err.message);
//     return false;
//   }
// }

// // ─────────────────────────────────────────
// // SEND ALL DAILY REPORTS
// // ─────────────────────────────────────────
// async function sendDailyReports() {
//   console.log("\n📧 [sendReports] Starting daily report send...");

//   try {
//     // Load all plans with report notifications enabled
//     // Join with user profiles to get email + name
//     const { data: plans, error: plansErr } = await supabase
//       .from("plans")
//       .select(`
//         id,
//         name,
//         user_id,
//         tier,
//         send_daily_report,
//         profiles!plans_user_id_fkey (
//           email,
//           full_name
//         )
//       `)
//       .eq("send_daily_report", true)
//       .in("tier", ["starter", "pro"]);

//     if (plansErr) {
//       console.error("❌ [sendReports] Failed to fetch plans:", plansErr.message);
//       return;
//     }

//     if (!plans?.length) {
//       console.log("ℹ️  [sendReports] No plans with reports enabled");
//       return;
//     }

//     console.log(`📋 [sendReports] Sending reports for ${plans.length} plan(s)`);

//     let sentCount   = 0;
//     let failedCount = 0;

//     // Process in batches of 10 to avoid SendGrid rate limits
//     const BATCH_SIZE = 10;

//     for (let i = 0; i < plans.length; i += BATCH_SIZE) {
//       const batch = plans.slice(i, i + BATCH_SIZE);

//       await Promise.all(
//         batch.map(async (plan) => {
//           const email = plan.profiles?.email;
//           const name  = plan.profiles?.full_name;

//           if (!email) {
//             console.log(`   ⏭️  No email for plan "${plan.name}" — skipping`);
//             failedCount++;
//             return;
//           }

//           const sent = await sendPlanReport(plan, email, name);
//           if (sent) sentCount++;
//           else failedCount++;
//         })
//       );

//       // Pause between batches
//       if (i + BATCH_SIZE < plans.length) {
//         await new Promise((r) => setTimeout(r, 1000));
//       }
//     }

//     console.log(`\n✅ [sendReports] Reports complete`);
//     console.log(`   Sent:   ${sentCount}`);
//     console.log(`   Failed: ${failedCount}`);

//   } catch (err) {
//     console.error("❌ [sendReports] Unexpected error:", err.message);
//   }
// }

// // ─────────────────────────────────────────
// // REGISTER CRON
// // Daily at 09:00 UTC: "0 9 * * *"
// // ─────────────────────────────────────────
// export function startSendReportsCron() {
//   console.log("📅 [sendReports] Cron registered — daily at 09:00 UTC");

//   cron.schedule("0 9 * * *", async () => {
//     console.log(`\n🕘 [sendReports] Triggered at ${new Date().toISOString()}`);
//     await sendDailyReports();
//   }, { timezone: "UTC" });
// }

// export { sendDailyReports };



import sgMail     from "@sendgrid/mail"
import { supabase } from "../config/supabase.js"

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "reports@tecsaro.com"
const FROM_NAME  = "TecSaro AEO Reports"
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL || "https://app.tecsaro.com"

// ─────────────────────────────────────────
// DAILY SMALL REPORT EMAIL
// Just score + wins/losses + gap count
// ─────────────────────────────────────────
function buildDailyReportEmail(plan, score, breakdown) {
  const wins     = breakdown?.wins   || 0
  const losses   = breakdown?.losses || 0
  const shared   = breakdown?.shared || 0
  const missed   = breakdown?.missed || 0
  const presence = ((breakdown?.brandPresenceRate || 0) * 100).toFixed(1)
  const gapCount = breakdown?.gapCount || 0
  const recCount = breakdown?.recommendationCount || 0
  const scoreColor = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444"

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #10b981; font-size: 24px; margin: 0;">TecSaro AEO</h1>
      <p style="color: #64748b; margin: 8px 0 0;">Daily Visibility Report · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
    </div>
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">AEO Score</p>
      <div style="font-size: 64px; font-weight: 700; color: ${scoreColor}; line-height: 1;">${score}</div>
      <div style="color: #475569; font-size: 16px;">/100</div>
      <p style="margin: 16px 0 0; color: #94a3b8; font-size: 14px;">Brand visibility: <strong style="color: #e2e8f0;">${presence}%</strong></p>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
      ${[
        { label: "Wins",   value: wins,   color: "#10b981" },
        { label: "Shared", value: shared, color: "#f59e0b" },
        { label: "Losses", value: losses, color: "#ef4444" },
        { label: "Missed", value: missed, color: "#64748b" },
      ].map(item => `
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="font-size: 28px; font-weight: 700; color: ${item.color};">${item.value}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${item.label}</div>
      </div>`).join("")}
    </div>
    ${gapCount > 0 ? `
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; color: #f59e0b; font-size: 16px;">⚠️ ${gapCount} Gap${gapCount !== 1 ? "s" : ""} Found</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">
        AI is not mentioning your brand for ${gapCount} tracked quer${gapCount !== 1 ? "ies" : "y"}.
        ${recCount > 0 ? `${recCount} action${recCount !== 1 ? "s" : ""} available in your dashboard.` : ""}
      </p>
    </div>` : `
    <div style="background: #1e293b; border: 1px solid #10b981; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 4px; color: #10b981; font-size: 16px;">✅ No Gaps Found</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">Your brand is appearing in all tracked AI queries.</p>
    </div>`}
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${APP_URL}/dashboard" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">View Dashboard →</a>
    </div>
    <div style="text-align: center; color: #475569; font-size: 12px; border-top: 1px solid #1e293b; padding-top: 20px;">
      <p style="margin: 0;">TecSaro · <a href="${APP_URL}/settings/notifications" style="color: #64748b;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`.trim()
}

// ─────────────────────────────────────────
// MONTHLY FULL REPORT EMAIL
// Score trend + full breakdown + recommendations
// ─────────────────────────────────────────
function buildMonthlyReportEmail(plan, score, breakdown, prevScore) {
  const scoreColor  = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444"
  const scoreDiff   = prevScore !== null ? score - prevScore : null
  const diffLabel   = scoreDiff !== null
    ? scoreDiff > 0 ? `▲ +${scoreDiff} from last month`
    : scoreDiff < 0 ? `▼ ${scoreDiff} from last month`
    : "No change from last month"
    : ""
  const diffColor   = scoreDiff > 0 ? "#10b981" : scoreDiff < 0 ? "#ef4444" : "#64748b"
  const wins        = breakdown?.wins   || 0
  const losses      = breakdown?.losses || 0
  const shared      = breakdown?.shared || 0
  const missed      = breakdown?.missed || 0
  const presence    = ((breakdown?.brandPresenceRate || 0) * 100).toFixed(1)
  const gapCount    = breakdown?.gapCount           || 0
  const recCount    = breakdown?.recommendationCount || 0
  const month       = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #10b981; font-size: 24px; margin: 0;">TecSaro AEO</h1>
      <p style="color: #64748b; margin: 8px 0 0;">Monthly Report · ${month}</p>
    </div>
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Monthly AEO Score</p>
      <div style="font-size: 64px; font-weight: 700; color: ${scoreColor}; line-height: 1;">${score}</div>
      <div style="color: #475569; font-size: 16px;">/100</div>
      ${scoreDiff !== null ? `<p style="margin: 12px 0 0; color: ${diffColor}; font-size: 14px; font-weight: 600;">${diffLabel}</p>` : ""}
      <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">Brand visibility: <strong style="color: #e2e8f0;">${presence}%</strong> of AI answers</p>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
      ${[
        { label: "Wins",   value: wins,   color: "#10b981" },
        { label: "Shared", value: shared, color: "#f59e0b" },
        { label: "Losses", value: losses, color: "#ef4444" },
        { label: "Missed", value: missed, color: "#64748b" },
      ].map(item => `
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="font-size: 28px; font-weight: 700; color: ${item.color};">${item.value}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${item.label}</div>
      </div>`).join("")}
    </div>
    ${gapCount > 0 ? `
    <div style="background: #1e293b; border: 1px solid #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 8px; color: #f59e0b; font-size: 16px;">⚠️ ${gapCount} Gap${gapCount !== 1 ? "s" : ""} This Month</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">
        Your brand was missing from ${gapCount} AI quer${gapCount !== 1 ? "ies" : "y"} this month.
        ${recCount > 0 ? `We've generated ${recCount} recommendation${recCount !== 1 ? "s" : ""} to fix this.` : ""}
      </p>
    </div>` : `
    <div style="background: #1e293b; border: 1px solid #10b981; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 4px; color: #10b981; font-size: 16px;">✅ Zero Gaps This Month</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">Your brand appeared in all tracked AI queries this month.</p>
    </div>`}
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${APP_URL}/dashboard" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">View Full Monthly Report →</a>
    </div>
    <div style="text-align: center; color: #475569; font-size: 12px; border-top: 1px solid #1e293b; padding-top: 20px;">
      <p style="margin: 0;">TecSaro · <a href="${APP_URL}/settings/notifications" style="color: #64748b;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`.trim()
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
async function getPlansWithReports(reportField) {
  const { data: plans, error } = await supabase
    .from("plans")
    .select(`id, name, user_id, tier, ${reportField}, profiles!plans_user_id_fkey (email, full_name)`)
    .eq(reportField, true)
    .in("tier", ["starter", "pro"])

  if (error) {
    console.error(`❌ [sendReports] Failed to fetch plans:`, error.message)
    return []
  }
  return plans || []
}

async function getLatestScore(planId) {
  const { data } = await supabase
    .from("aeo_scores")
    .select("score, breakdown, created_at")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function getPrevMonthScore(planId) {
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

  const { data } = await supabase
    .from("aeo_scores")
    .select("score")
    .eq("plan_id", planId)
    .lt("created_at", oneMonthAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.score ?? null
}

// ─────────────────────────────────────────
// SEND DAILY SMALL REPORTS
// Schedule: daily 09:00 UTC
// ─────────────────────────────────────────
export async function sendDailyReports() {
  console.log("\n📧 [sendDailyReports] Starting...")

  try {
    const plans = await getPlansWithReports("send_daily_report")
    if (!plans.length) {
      console.log("ℹ️  [sendDailyReports] No plans with daily reports enabled")
      return { sent: 0, failed: 0 }
    }

    console.log(`📋 [sendDailyReports] Sending to ${plans.length} plan(s)`)

    let sent = 0, failed = 0
    const BATCH_SIZE = 10

    for (let i = 0; i < plans.length; i += BATCH_SIZE) {
      const batch = plans.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (plan) => {
        const email = plan.profiles?.email
        const name  = plan.profiles?.full_name
        if (!email) { failed++; return }

        try {
          const latestScore = await getLatestScore(plan.id)
          if (!latestScore) {
            console.log(`   ⏭️  No score for "${plan.name}" — skipping`)
            failed++
            return
          }

          const html = buildDailyReportEmail(plan, latestScore.score || 0, latestScore.breakdown || {})

          await sgMail.send({
            to:      { email, name: name || email },
            from:    { email: FROM_EMAIL, name: FROM_NAME },
            subject: `Your AEO Score: ${latestScore.score}/100 — ${plan.name}`,
            html,
            text: `Your AEO score for ${plan.name} is ${latestScore.score}/100. View dashboard: ${APP_URL}/dashboard`,
          })

          console.log(`   ✅ Daily report sent: ${email} | Score: ${latestScore.score}/100`)
          sent++
        } catch (err) {
          console.error(`   ❌ Failed: ${email}:`, err.message)
          failed++
        }
      }))

      if (i + BATCH_SIZE < plans.length) await new Promise((r) => setTimeout(r, 1000))
    }

    console.log(`\n✅ [sendDailyReports] Sent: ${sent} | Failed: ${failed}`)
    return { sent, failed }

  } catch (err) {
    console.error("❌ [sendDailyReports] Crashed:", err.message)
    throw err
  }
}

// ─────────────────────────────────────────
// SEND MONTHLY FULL REPORTS
// Schedule: 1st of month 10:00 UTC
// ─────────────────────────────────────────
export async function sendMonthlyReports() {
  console.log("\n📧 [sendMonthlyReports] Starting...")

  try {
    const plans = await getPlansWithReports("send_daily_report")
    if (!plans.length) {
      console.log("ℹ️  [sendMonthlyReports] No plans to report")
      return { sent: 0, failed: 0 }
    }

    console.log(`📋 [sendMonthlyReports] Sending to ${plans.length} plan(s)`)

    let sent = 0, failed = 0

    for (const plan of plans) {
      const email = plan.profiles?.email
      const name  = plan.profiles?.full_name
      if (!email) { failed++; continue }

      try {
        const latestScore = await getLatestScore(plan.id)
        if (!latestScore) { failed++; continue }

        const prevScore = await getPrevMonthScore(plan.id)
        const html      = buildMonthlyReportEmail(plan, latestScore.score || 0, latestScore.breakdown || {}, prevScore)

        await sgMail.send({
          to:      { email, name: name || email },
          from:    { email: FROM_EMAIL, name: FROM_NAME },
          subject: `${plan.name} Monthly AEO Report — ${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`,
          html,
          text: `Your monthly AEO report for ${plan.name}. Score: ${latestScore.score}/100. View dashboard: ${APP_URL}/dashboard`,
        })

        console.log(`   ✅ Monthly report sent: ${email}`)
        sent++
      } catch (err) {
        console.error(`   ❌ Failed: ${email}:`, err.message)
        failed++
      }

      await new Promise((r) => setTimeout(r, 500))
    }

    console.log(`\n✅ [sendMonthlyReports] Sent: ${sent} | Failed: ${failed}`)
    return { sent, failed }

  } catch (err) {
    console.error("❌ [sendMonthlyReports] Crashed:", err.message)
    throw err
  }
}