



import { supabase } from "../../config/supabase.js";
import { runAeoScoreJob } from "../../jobs/aeoScore.job.js";
import { runAeoScoreExplainJob } from "../../jobs/aeoScoreExplain.job.js";
import { getLatestScore, getLatestExplanation } from "../../services/aeo/aeoScore.service.js";
import apiResponse from "../../utils/apiResponse.js";

// ─────────────────────────────────────────
// POST /api/aeo/score/calculate
// ─────────────────────────────────────────
export const calculateAeoScore = async (req, res) => {
  try {
    const { planId, explain = false } = req.body;

    if (!planId) return apiResponse(res, 400, "planId required");

    const result = await runAeoScoreJob(planId);

    if (!result) {
      return apiResponse(res, 500, "Score calculation failed");
    }

    if (explain) {
      runAeoScoreExplainJob(planId).catch((err) => {
        console.error("❌ Score explain job failed:", err.message);
      });
    }

    return apiResponse(res, 200, "AEO score calculated", result);
  } catch (err) {
    console.error("❌ calculateAeoScore error:", err.message);
    return apiResponse(res, 500, "Failed to calculate AEO score");
  }
};

// ─────────────────────────────────────────
// GET /api/aeo/score/:planId
// Returns latest score with breakdown + trend vs previous
// ─────────────────────────────────────────
export const getAeoScore = async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId) return apiResponse(res, 400, "planId required");

    const { data, error } = await supabase
      .from("aeo_scores")
      .select("score, breakdown, created_at")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (error) throw error;

    const latest   = data?.[0] || null;
    const previous = data?.[1] || null;

    if (!latest) {
      return apiResponse(res, 404, "No score found — run calculate first");
    }

    const change = previous ? latest.score - previous.score : 0;
    const trend  = change > 0 ? "up" : change < 0 ? "down" : "stable";

    return apiResponse(res, 200, "AEO score", {
      score:          latest.score,
      breakdown:      latest.breakdown,
      created_at:     latest.created_at,
      trend,
      change,
      previous_score: previous?.score     || null,
      previous_date:  previous?.created_at || null,
    });

  } catch (err) {
    console.error("❌ getAeoScore error:", err.message);
    return apiResponse(res, 500, "Failed to load score");
  }
};

// ─────────────────────────────────────────
// GET /api/aeo/score/:planId/history
// Returns score trend for chart
// Query: ?days=30
// ─────────────────────────────────────────
export const getScoreHistory = async (req, res) => {
  try {
    const { planId } = req.params;
    const { days = 30 } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const { data, error } = await supabase
      .from("aeo_scores")
      .select("score, breakdown, created_at")
      .eq("plan_id", planId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (error) throw error;

    const scores   = data || [];
    const latest   = scores[scores.length - 1]?.score || 0;
    const previous = scores[scores.length - 2]?.score || null;
    const first    = scores[0]?.score || 0;

    const trend     = previous !== null
      ? latest > previous ? "up" : latest < previous ? "down" : "stable"
      : "stable";
    const change    = previous !== null ? latest - previous : 0;
    const changeAll = latest - first;

    return res.json({
      history: scores.map((s) => ({
        score:       s.score,
        date:        s.created_at,
        presence:    s.breakdown?.scoreComponents?.find((c) => c.category === "Presence Rate")?.points      || 0,
        win_rate:    s.breakdown?.scoreComponents?.find((c) => c.category === "Win Rate")?.points           || 0,
        coverage:    s.breakdown?.scoreComponents?.find((c) => c.category === "Query Coverage")?.points     || 0,
        competitive: s.breakdown?.scoreComponents?.find((c) => c.category === "Competitive Position")?.points || 0,
        technical:   s.breakdown?.scoreComponents?.find((c) => c.category === "Technical Readiness")?.points  || 0,
      })),
      summary: {
        latest,
        previous,
        trend,
        change,
        change_all:      changeAll,
        total_snapshots: scores.length,
        period_days:     parseInt(days),
      },
    });

  } catch (err) {
    console.error("❌ getScoreHistory error:", err.message);
    return res.status(500).json({ error: "Failed to load score history" });
  }
};

// ─────────────────────────────────────────
// GET /api/aeo/score/:planId/explanation
// Returns latest AI-generated score explanation
// ─────────────────────────────────────────
export const getScoreExplanation = async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId) return apiResponse(res, 400, "planId required");

    const explanation = await getLatestExplanation(planId);

    if (!explanation) {
      return apiResponse(res, 404, "No explanation found");
    }

    return apiResponse(res, 200, "Score explanation", explanation);
  } catch (err) {
    console.error("❌ getScoreExplanation error:", err.message);
    return apiResponse(res, 500, "Failed to load explanation");
  }
};

