// import { supabase } from "../../config/supabase.js";
// import apiResponse from "../../utils/apiResponse.js";
// import { runAeoScoreExplainJob } from "../../jobs/aeoScoreExplain.job.js";

// // 1️⃣ Trigger explanation generation
// export const explainAeoScore = async (req, res) => {
//   const { planId } = req.body;

//   if (!planId) {
//     return apiResponse(res, 400, "planId required");
//   }

//   await runAeoScoreExplainJob(planId);

//   return apiResponse(res, 200, "AEO score explanation started");
// };

// // 2️⃣ Fetch latest explanation (THIS IS WHAT FRONTEND NEEDS)
// export const getAeoScoreExplanation = async (req, res) => {
//   const { planId } = req.params;

//   if (!planId) {
//     return apiResponse(res, 400, "planId required");
//   }

//   const { data, error } = await supabase
//     .from("aeo_score_explanations")
//     .select("explanation, recommendations, score, created_at")
//     .eq("plan_id", planId)
//     .order("created_at", { ascending: false })
//     .limit(1)
//     .maybeSingle();

//   if (error) {
//     return apiResponse(res, 500, "Failed to load explanation");
//   }

//   return apiResponse(res, 200, "Score explanation", data);
// };



// ─────────────────────────────────────────
// aeoScoreExplain.controller.js
// ─────────────────────────────────────────
import { runAeoScoreExplainJob as runExplainJob } from "../../jobs/aeoScoreExplain.job.js";
import { getLatestExplanation } from "../../services/aeo/aeoScore.service.js";
import apiResponse from "../../utils/apiResponse.js";

// ─────────────────────────────────────────
// POST /api/aeo/score/explain
// Triggers AI explanation generation.
// Fire and forget — client polls GET endpoint.
// Body: { planId }
// ─────────────────────────────────────────
export const explainAeoScore = async (req, res) => {
  const { planId } = req.body;

  if (!planId) {
    return apiResponse(res, 400, "planId required");
  }

  // Fire and forget — explanation can take 5-10s
  runExplainJob(planId).catch((err) => {
    console.error(`❌ Explain job failed for plan ${planId}:`, err.message);
  });

  return apiResponse(res, 200, "Score explanation generating — fetch result from GET endpoint");
};

// ─────────────────────────────────────────
// GET /api/aeo/score/:planId/explanation
// Returns latest explanation for dashboard.
// Returns null if not yet generated.
// ─────────────────────────────────────────
export const getAeoScoreExplanation = async (req, res) => {
  const { planId } = req.params;

  if (!planId) {
    return apiResponse(res, 400, "planId required");
  }

  try {
    const explanation = await getLatestExplanation(planId);

    if (!explanation) {
      return apiResponse(res, 404, "No explanation found — trigger POST /explain first");
    }

    return apiResponse(res, 200, "Score explanation", explanation);
  } catch (err) {
    console.error("❌ getAeoScoreExplanation error:", err.message);
    return apiResponse(res, 500, "Failed to load explanation");
  }
};
