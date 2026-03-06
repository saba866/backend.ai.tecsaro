// import { startGapJob } from "../../services/aeo/aeoGap.service.js";
// import apiResponse from "../../utils/apiResponse.js";

// export const detectAnswerGaps = async (req, res) => {
//   try {
//     const { planId } = req.body;
//     if (!planId) {
//       return apiResponse(res, 400, "planId required");
//     }

//     await startGapJob(planId);
//     return apiResponse(res, 200, "Answer gap analysis started");
//   } catch (err) {
//     console.error(err);
//     return apiResponse(res, 500, "Answer gap analysis failed");
//   }
// };


// import { runAeoGapJob } from "../../jobs/aeoGap.job.js";

// export const runGapAnalysis = async (req, res) => {
//   const { planId } = req.body;

//   runAeoGapJob(planId);

//   res.json({ success: true, message: "Gap analysis started" });
// };






// ─────────────────────────────────────────
// aeoGap.controller.js
// POST endpoint to trigger gap analysis job
// ─────────────────────────────────────────
import { runAeoGapJob } from "../../jobs/aeoGap.job.js";
import { runRecommendationJob } from "../../jobs/aeoRecommendation.job.js";

// ─────────────────────────────────────────
// POST /api/aeo/gaps/analyze
// Triggers gap analysis for a plan.
// Optionally chains into recommendation job.
// Body: { planId, generateRecommendations? }
// ─────────────────────────────────────────
export const runGapAnalysis = async (req, res) => {
  const { planId, generateRecommendations = true } = req.body;

  if (!planId) {
    return apiResponse(res, 400, "planId required");
  }

  // Fire and forget — gaps can take time
  (async () => {
    try {
      const gaps = await runAeoGapJob(planId);

      // Automatically chain into recommendation job if gaps found
      if (generateRecommendations && gaps?.length > 0) {
        console.log(`🔗 Chaining recommendation job for ${gaps.length} gaps...`);
        await runRecommendationJob(planId);
      }
    } catch (err) {
      console.error(`❌ Gap/Recommendation pipeline failed for plan ${planId}:`, err.message);
    }
  })();

  return res.json({
    success: true,
    message: "Gap analysis started — recommendations will be generated automatically",
  });
};