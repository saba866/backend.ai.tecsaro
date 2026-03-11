// import { startExpireTrialCron }      from "./expireTrial.js";
// import { startResetUsageCron }        from "./resetUsage.js";
// import { startSubscriptionCheckCron } from "./subscription.js";
// import { startSendReportsCron }       from "./sendReports.js";
// import { startDailyVisibilityCron } from "./runDailyVisibility.js";

// // ─────────────────────────────────────────
// // CRON SCHEDULE OVERVIEW
// // ─────────────────────────────────────────
// // 00:00 UTC — expireTrial          (daily)
// // 00:05 UTC — resetUsage           (1st of month)
// // 01:00 UTC — subscriptionCheck    (daily)
// // 02:00 UTC — dailyVisibility      (daily)
// //               → answers, visibility, gaps,
// //                 recommendations, score, explain
// // 03:00 UTC — weeklySchema         (every Sunday)
// // 04:00 UTC — weeklyPromptSuggestions (every Monday)
// // 09:00 UTC — sendReports          (daily)
// // ─────────────────────────────────────────

// export function startAllCrons() {
//   console.log("\n⏰ ─────────────────────────────────────");
//   console.log("⏰  Starting cron job system...");
//   console.log("⏰ ─────────────────────────────────────");

//   try {
//     startExpireTrialCron();
//   } catch (err) {
//     console.error("❌ Failed to start expireTrial cron:", err.message);
//   }

//   try {
//     startResetUsageCron();
//   } catch (err) {
//     console.error("❌ Failed to start resetUsage cron:", err.message);
//   }

//   try {
//     startSubscriptionCheckCron();
//   } catch (err) {
//     console.error("❌ Failed to start subscriptionCheck cron:", err.message);
//   }

//   try {
//     // This registers dailyVisibility + weeklySchema + weeklyPrompts + health
//     startDailyVisibilityCron();
//   } catch (err) {
//     console.error("❌ Failed to start dailyVisibility cron:", err.message);
//   }

//   try {
//     startSendReportsCron();
//   } catch (err) {
//     console.error("❌ Failed to start sendReports cron:", err.message);
//   }

//   console.log("⏰ ─────────────────────────────────────");
//   console.log("⏰  All crons registered successfully");
//   console.log("⏰  Schedule (UTC):");
//   console.log("⏰    00:00 — Expire trials              (daily)");
//   console.log("⏰    00:05 — Reset usage                (1st of month)");
//   console.log("⏰    01:00 — Subscription check         (daily)");
//   console.log("⏰    02:00 — Daily visibility run        (daily)");
//   console.log("⏰    03:00 — Weekly schema generation   (every Sunday)");
//   console.log("⏰    04:00 — Weekly prompt suggestions  (every Monday)");
//   console.log("⏰    09:00 — Send reports               (daily)");
//   console.log("⏰    *:00  — Health check               (every hour)");
//   console.log("⏰ ─────────────────────────────────────\n");
// }



// ─────────────────────────────────────────
// CRON INDEX — Cloud Run version
// node-cron is REMOVED
// All jobs are triggered via HTTP endpoints
// by Google Cloud Scheduler
// ─────────────────────────────────────────

export { expireTrials }          from "./expireTrial.js"
export { resetMonthlyUsage }     from "./resetUsage.js"
export { checkSubscriptions }    from "./subscription.js"
export { sendDailyReports, sendMonthlyReports } from "./sendReports.js"
export {
  runDailyVisibility,
  runMonthlyFullPipeline,
} from "./runDailyVisibility.js"