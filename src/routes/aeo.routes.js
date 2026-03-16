






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
import { getCompetitorPrompts } from "../controllers/aeo/competitorPrompts.controller.js";
import { runGapAnalysis }       from "../controllers/aeo/aeoGap.controller.js";
import { getAeoPresence }       from "../controllers/aeo/aeoPresence.controller.js";
import { getRecommendations }   from "../controllers/aeo/aeoRecommendation.controller.js";
import { getCitations, getCitationSources } from "../controllers/aeo/aeoCitation.controller.js";
import {
  generateShareableReport,
  getShareStatus,
  revokeShareableReport,
  getPublicReport,
} from "../controllers/aeo/shareablereportcontroller.js"
import { getTechnicalAudit } from "../controllers/aeo/technicalAuditController.js"

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
// COMPETITORS
//
// Rule: most-specific static routes first, then :id/action
// sub-routes, then plain wildcards (:planId) absolutely last.
// ─────────────────────────────────────────────────────────────────

// ── Static POST ───────────────────────────────────────────────────
router.post("/competitors/start",          startCompetitorDiscovery);
router.post("/competitors/confirm-review", confirmCompetitorReview);
router.post("/competitors/add",            addCompetitor);
router.post("/seed",                       addSeedCompetitors);

// ── Static GET ────────────────────────────────────────────────────
router.get("/competitors/simple", getCompetitorsSimple);

// ── :id/action routes — BEFORE plain /:planId wildcard ───────────
//
// FIX 1: Step5 calls PUT /competitors/:id/approve  →  was PATCH, now both
// FIX 2: Step5 calls PUT /competitors/:id/ignore   →  was already correct
// FIX 3: keep old /accept alias for backward compat
router.put(   "/competitors/:id/approve", approveCompetitor);          // Step5 + dashboard
router.patch( "/competitors/:id/approve", approveCompetitor);          // backward compat alias
router.put(   "/competitors/:id/accept",  acceptSuggestedCompetitor);  // old alias
router.put(   "/competitors/:id/ignore",  ignoreSuggestedCompetitor);  // Step5
router.delete("/competitors/:id",         removeCompetitor);

// ── Parameterised GET — :competitorName/prompts BEFORE /:planId ──
//
// FIX: if /:planId came first, Express would match "prompts" as a planId
// and route /competitors/someUUID/prompts to getCompetitorsByPlan.
router.get("/competitors/:competitorName/prompts", getCompetitorPrompts);
router.get("/competitors/:planId",                 getCompetitorsByPlan);

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
router.post("/score",                     calculateAeoScore);
router.post("/score/explain",             explainAeoScore);
router.get( "/score/:planId",             getAeoScore);
router.get( "/score/:planId/explanation", getScoreExplanation);
router.get( "/score/:planId/history",     getScoreHistory);
router.get( "/score/explain/:planId",     getAeoScoreExplanation);

// ─────────────────────────────────────────────────────────────────
// GAPS & RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────
router.post("/gap/run",         runGapAnalysis);
router.get( "/gaps/:planId",    getAnswerGaps);
router.get( "/recommendations", getRecommendations);

// ─────────────────────────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────────────────────────
router.post("/alerts",          saveAeoAlert);
router.get( "/alerts/:planId",  getAeoAlertEvents);

// ─────────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────────
router.post( "/onboard/start",     startAeoOnboarding);
router.patch("/onboarding-step",   authMiddleware, updateOnboardingStep);
router.get(  "/onboarding-status", authMiddleware, getOnboardingStatus);

// ─────────────────────────────────────────────────────────────────
// MISC
// ─────────────────────────────────────────────────────────────────
router.post("/map/start",        mapPromptsToPages);
router.post("/answers/generate", generateAeoAnswers);
router.post("/monitor",          startAeoMonitor);
router.get( "/presence-metrics", getAeoPresence);
router.get("/citations/:planId",         authMiddleware, getCitations)
router.get("/citations/:planId/sources", authMiddleware, getCitationSources)
router.post(  "/reports/share",           authMiddleware, generateShareableReport)
router.get(   "/reports/share/:planId",   authMiddleware, getShareStatus)
router.delete("/reports/share/:planId",   authMiddleware, revokeShareableReport)
 
// ── Public route — NO auth (add to your main app router, not behind auth) ──
router.get("/report/public/:token", getPublicReport)

router.get("/technical-audit/:planId", authMiddleware, getTechnicalAudit)
export default router;