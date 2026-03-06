// import express from "express";

// const router = express.Router();
// import { authMiddleware } from "../middlewares/auth.js";
// import { startAeoCrawl, getAeoCrawlStatus } from "../controllers/aeo/aeoCrawl.controller.js";

// import {
//   discoverPrompts,
//   getReviewPrompts,
//   approveSelectedPrompts,
//   addCustomPrompt,
//   deletePrompt,
//   getActive,
//   getSlotSummary,
//   getSuggestedPrompts,
//   approveSuggestion,
//   dismissSuggestion,
//   validatePrompt,
//   getAeoPrompts,
// } from "../controllers/aeo/aeoPrompt.controller.js";


// import { mapPromptsToPages } from "../controllers/aeo/aeoMapping.controller.js";
// import { generateAeoAnswers } from "../controllers/aeo/aeoAnswer.controller.js";
// import {  generateSchemas, getSchemas } from "../controllers/aeo/aeoSchema.controller.js";
// // import { detectAnswerGaps} from "../controllers/aeo/aeoGap.controller.js";
// import { startAeoMonitor } from "../controllers/aeo/aeoMonitor.controller.js";
// import { getAeoOverview } from "../controllers/aeo/aeoOverview.controller.js";

// // import { getAeoPrompts } from "../controllers/aeo/aeoPromptsRead.controller.js";
// import { getAnswerGaps } from "../controllers/aeo/aeoGapRead.controller.js";
// import { startAeoVisibility, getVisibilityData } from "../controllers/aeo/aeoVisibility.controller.js";

// import { startAeoOnboarding,  
//   updateOnboardingStep,
//   getOnboardingStatus, } from "../controllers/aeo/aeoOnboard.controller.js";


// import { saveAeoAlert, getAeoAlertEvents } from "../controllers/aeo/aeoAlerts.controller.js";
// import { calculateAeoScore, getScoreHistory, getAeoScore, getScoreExplanation } from "../controllers/aeo/aeoScore.controller.js";
// import {getCompetitorsSimple, startCompetitorDiscovery} from "../controllers/aeo/aeoCompetitorsSimple.controller.js"
// import {getAeoOverviewSimple} from "../controllers/aeo/aeoOverviewSimple.controller.js"
// import {
//   explainAeoScore,
//   getAeoScoreExplanation
// } from "../controllers/aeo/aeoScoreExplain.controller.js";
// import { upsertBrandProfile } from "../controllers/aeo/aeoBrandProfile.controller.js";
// import {
//   addSeedCompetitors,
//   getCompetitorsByPlan,
//   approveCompetitor,
//   removeCompetitor,
//   acceptSuggestedCompetitor,
//   ignoreSuggestedCompetitor,
//   addCompetitor,
//   confirmCompetitorReview
// } from "../controllers/aeo/aeoCompetitor.controller.js";
// import { runGapAnalysis } from "../controllers/aeo/aeoGap.controller.js";
// import { getAeoPresence } from "../controllers/aeo/aeoPresence.controller.js";
// import { getRecommendations } from "../controllers/aeo/aeoRecommendation.controller.js";


// router.post("/crawl/start", startAeoCrawl);
// router.get("/crawl/status/:planId",  getAeoCrawlStatus);
// // Returns all prompts with optional status filter + pagination.
// // Dashboard overview, prompt management pages.
// router.get("/", getAeoPrompts);

// // Returns only active + manually_added prompts.
// // Used by visibility tracking jobs and dashboard header counts.
// router.get("/active", getActive);

// // Returns slot usage: { tier, max, used, manual_used, ai_used, remaining, approved }
// // Used by dashboard prompt panel to render slot usage bar.
// router.get("/slots", getSlotSummary);

// // Body: { planId, selectedIds: string[] }
// // Selected → status: "active"
// // Rest pending_review → status: "dismissed"
// // plan.pipeline_status → "running"  (pipeline resumes)
// router.post("/approve", approveSelectedPrompts);
// // Returns pending_review prompts for the Step 4 selection UI.
// // Response: { prompts[], grouped{}, select_max, select_min, available_slots, manual_used, tier }
// router.get("/review", getReviewPrompts);



// // ─────────────────────────────────────────────────────────────────
// // MANUAL PROMPT MANAGEMENT
// // POST /api/aeo/prompts/manual
// // POST /api/aeo/prompts/validate
// // ─────────────────────────────────────────────────────────────────

// // Body: { planId, prompt, intent? }
// // User writes a custom prompt. Auto-activated, counts toward select_max cap.
// // Works during onboarding AND post-approval in dashboard.
// // Errors: 400 invalid | 400 duplicate | 403 limit reached
// router.post("/manual", addCustomPrompt);

// // Body: { planId?, prompt }
// // Real-time validation as user types a custom prompt.
// // Response: { valid: boolean, message: string }
// router.post("/validate", validatePrompt);
// // ─────────────────────────────────────────────────────────────────
// // ONBOARDING FLOW
// // POST /api/aeo/prompts/discover
// // GET  /api/aeo/prompts/review?planId=
// // POST /api/aeo/prompts/approve
// // ─────────────────────────────────────────────────────────────────

// // Body: { planId }
// // Fire-and-forget AI generation. Responds 200 immediately.
// // Generation runs async, pipeline_status → "awaiting_prompt_review" when done.
// router.post("/discover", discoverPrompts);
// // ─────────────────────────────────────────────────────────────────
// // GAP-SUGGESTED PROMPTS  (post-onboarding, dashboard only)
// // GET  /api/aeo/prompts/suggested?planId=
// // POST /api/aeo/prompts/suggested/:promptId/approve
// // POST /api/aeo/prompts/suggested/:promptId/dismiss
// // ─────────────────────────────────────────────────────────────────

// // Returns suggestions from weekly gap analysis waiting for user review.
// // Response: { suggestions[], total, slots: { max, used, remaining } }
// router.get("/suggested", getSuggestedPrompts);

// // Body: { planId }
// // Activates a gap-suggested prompt. Returns 403 if select_max cap is full.
// router.post("/suggested/:promptId/approve", approveSuggestion);

// // Body: { planId }
// // Dismisses a gap-suggested prompt without freeing a slot.
// router.post("/suggested/:promptId/dismiss", dismissSuggestion);

// // ─────────────────────────────────────────────────────────────────
// // DELETE
// // DELETE /api/aeo/prompts/:promptId?planId=
// //
// // ⚠️  MUST be registered last.
// //     If placed above the /suggested routes, Express will match
// //     "suggested" as the :promptId param and never reach those handlers.
// // ─────────────────────────────────────────────────────────────────

// // Sets status: "dismissed", frees one slot so user can add another prompt.
// router.delete("/:promptId", deletePrompt);
// router.post("/map/start", mapPromptsToPages);
// router.post("/answers/generate", generateAeoAnswers);

// // router.post("/gap", detectAnswerGaps);
// router.post("/monitor", startAeoMonitor);
// router.get("/overview", getAeoOverview);

// router.get("/gaps/:planId", getAnswerGaps);

// router.get("/visibility/track", startAeoVisibility);
// router.get("/schema/:planId",  getSchemas);  
// router.get("/visibility",  getVisibilityData);
// router.get("/schema/:planId", authMiddleware,  getSchemas);  

// router.post("/onboard/start", startAeoOnboarding);
// router.patch("/onboarding-step", updateOnboardingStep);
// router.get("/onboarding-status", getOnboardingStatus);
// router.post("/schema", generateSchemas);
// router.get("/schema/:planId",  getSchemas);  
// // SCORE
// router.get("/score/:planId", getAeoScore);

// router.get("/score/:planId/explanation", getScoreExplanation);

// router.get("/score/:planId/history", getScoreHistory);

// router.post("/score", calculateAeoScore);

// // ALERTS
// router.post("/alerts", saveAeoAlert);
// router.get("/alerts/:planId",getAeoAlertEvents);
// router.post("/score/explain", explainAeoScore);
// router.get("/score/explain/:planId", getAeoScoreExplanation);

// router.get("/recommendations", getRecommendations);
// router.get("/overview/simple", getAeoOverviewSimple);

// router.post("/competitors/start", startCompetitorDiscovery);
// router.get("/competitors/simple", getCompetitorsSimple);
// // Accept AI suggestion
// router.put("/competitors/:id/accept", acceptSuggestedCompetitor);
// router.post("/competitors/confirm-review", confirmCompetitorReview)
// // Ignore AI suggestion (permanent)
// router.put("/competitors/:id/ignore", ignoreSuggestedCompetitor);

// // Add manually from dashboard
// router.post("/competitors/add", addCompetitor);
// router.post("/brand-profile", upsertBrandProfile);

// // 🚫 AUTH REMOVED (Public Access)
// router.post("/seed", addSeedCompetitors);
// router.get("/presence-metrics", getAeoPresence);
// router.get("/:planId", getCompetitorsByPlan);
// router.patch("/:id/approve", approveCompetitor);
// router.delete("/:id", removeCompetitor);
// router.post("/gap/run", runGapAnalysis);

// export default router;




import express from "express";

const router = express.Router();
import { authMiddleware } from "../middlewares/auth.js";
import { startAeoCrawl, getAeoCrawlStatus } from "../controllers/aeo/aeoCrawl.controller.js";

import {
  discoverPrompts,
  getReviewPrompts,
  approveSelectedPrompts,
  addCustomPrompt,
  deletePrompt,
  getActive,
  getSlotSummary,
  getSuggestedPrompts,
  approveSuggestion,
  dismissSuggestion,
  validatePrompt,
  getAeoPrompts,
} from "../controllers/aeo/aeoPrompt.controller.js";

import { mapPromptsToPages }    from "../controllers/aeo/aeoMapping.controller.js";
import { generateAeoAnswers }   from "../controllers/aeo/aeoAnswer.controller.js";
import { generateSchemas, getSchemas } from "../controllers/aeo/aeoSchema.controller.js";
import { startAeoMonitor }      from "../controllers/aeo/aeoMonitor.controller.js";
import { getAeoOverview }       from "../controllers/aeo/aeoOverview.controller.js";
import { getAnswerGaps }        from "../controllers/aeo/aeoGapRead.controller.js";
import { startAeoVisibility, getVisibilityData } from "../controllers/aeo/aeoVisibility.controller.js";
import { startAeoOnboarding, updateOnboardingStep, getOnboardingStatus } from "../controllers/aeo/aeoOnboard.controller.js";
import { saveAeoAlert, getAeoAlertEvents } from "../controllers/aeo/aeoAlerts.controller.js";
import { calculateAeoScore, getScoreHistory, getAeoScore, getScoreExplanation } from "../controllers/aeo/aeoScore.controller.js";
import { getCompetitorsSimple, startCompetitorDiscovery } from "../controllers/aeo/aeoCompetitorsSimple.controller.js";
import { getAeoOverviewSimple } from "../controllers/aeo/aeoOverviewSimple.controller.js";
import { explainAeoScore, getAeoScoreExplanation } from "../controllers/aeo/aeoScoreExplain.controller.js";
import { upsertBrandProfile }   from "../controllers/aeo/aeoBrandProfile.controller.js";
import {
  addSeedCompetitors,
  getCompetitorsByPlan,
  approveCompetitor,
  removeCompetitor,
  acceptSuggestedCompetitor,
  ignoreSuggestedCompetitor,
  addCompetitor,
  confirmCompetitorReview,
} from "../controllers/aeo/aeoCompetitor.controller.js";
import {getCompetitorPrompts} from "../controllers/aeo/competitorPrompts.controller.js"
import { runGapAnalysis }       from "../controllers/aeo/aeoGap.controller.js";
import { getAeoPresence }       from "../controllers/aeo/aeoPresence.controller.js";
import { getRecommendations }   from "../controllers/aeo/aeoRecommendation.controller.js";

// ─────────────────────────────────────────────────────────────────
// CRAWL
// ─────────────────────────────────────────────────────────────────
router.post("/crawl/start",          startAeoCrawl);
router.get( "/crawl/status/:planId", getAeoCrawlStatus);

// ─────────────────────────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────────────────────────
router.get("/overview",        getAeoOverview);
router.get("/overview/simple", getAeoOverviewSimple);

// ─────────────────────────────────────────────────────────────────
// PROMPTS — static routes MUST come before /:promptId wildcard
// ─────────────────────────────────────────────────────────────────
router.get( "/",          getAeoPrompts);
router.get( "/active",    getActive);
router.get( "/slots",     getSlotSummary);
router.get( "/review",    getReviewPrompts);
router.post("/approve",   approveSelectedPrompts);
router.post("/discover",  discoverPrompts);
router.post("/manual",    addCustomPrompt);
router.post("/validate",  validatePrompt);

router.get( "/suggested",                    getSuggestedPrompts);
router.post("/suggested/:promptId/approve",  approveSuggestion);
router.post("/suggested/:promptId/dismiss",  dismissSuggestion);

// ⚠️ wildcard — must be LAST among prompt routes
router.delete("/:promptId", deletePrompt);

// ─────────────────────────────────────────────────────────────────
// COMPETITORS — all static routes before /:planId and /:id wildcards
// ─────────────────────────────────────────────────────────────────
router.post("/competitors/start",           startCompetitorDiscovery);
router.post("/competitors/confirm-review",  confirmCompetitorReview);
router.post("/competitors/add",             addCompetitor);
router.post("/seed",                        addSeedCompetitors);

// GET list — uses /competitors/:planId (NOT /:planId to avoid conflicts)
router.get( "/competitors/simple",          getCompetitorsSimple);
router.get( "/competitors/:planId",         getCompetitorsByPlan);   // ✅ correct endpoint
router.get("/competitors/:competitorName/prompts", getCompetitorPrompts)

router.put(   "/competitors/:id/accept",    acceptSuggestedCompetitor);
router.put(   "/competitors/:id/ignore",    ignoreSuggestedCompetitor);
router.patch( "/competitors/:id/approve",  approveCompetitor);
router.delete("/competitors/:id",          removeCompetitor);

// ─────────────────────────────────────────────────────────────────
// BRAND PROFILE
// ─────────────────────────────────────────────────────────────────
router.post("/brand-profile", upsertBrandProfile);

// ─────────────────────────────────────────────────────────────────
// VISIBILITY
// ─────────────────────────────────────────────────────────────────
router.get("/visibility/track", startAeoVisibility);
router.get("/visibility",       getVisibilityData);

// ─────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────
router.post("/schema",          generateSchemas);
router.get( "/schema/:planId",  authMiddleware, getSchemas);

// ─────────────────────────────────────────────────────────────────
// SCORE
// ─────────────────────────────────────────────────────────────────
router.post("/score",                       calculateAeoScore);
router.post("/score/explain",               explainAeoScore);
router.get( "/score/:planId",               getAeoScore);
router.get( "/score/:planId/explanation",   getScoreExplanation);
router.get( "/score/:planId/history",       getScoreHistory);
router.get( "/score/explain/:planId",       getAeoScoreExplanation);

// ─────────────────────────────────────────────────────────────────
// GAPS & RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────
router.post("/gap/run",        runGapAnalysis);
router.get( "/gaps/:planId",   getAnswerGaps);
router.get( "/recommendations", getRecommendations);

// ─────────────────────────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────────────────────────
router.post("/alerts",         saveAeoAlert);
router.get( "/alerts/:planId", getAeoAlertEvents);

// ─────────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────────
router.post( "/onboard/start",      startAeoOnboarding);
router.patch("/onboarding-step",    updateOnboardingStep);
router.get(  "/onboarding-status",  getOnboardingStatus);

// ─────────────────────────────────────────────────────────────────
// MISC
// ─────────────────────────────────────────────────────────────────
router.post("/map/start",         mapPromptsToPages);
router.post("/answers/generate",  generateAeoAnswers);
router.post("/monitor",           startAeoMonitor);
router.get( "/presence-metrics",  getAeoPresence);

export default router;