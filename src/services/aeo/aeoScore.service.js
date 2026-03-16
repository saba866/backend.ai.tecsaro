




// ─────────────────────────────────────────
// aeoScore.service.js
// Utility to read latest score from DB.
// Used by controllers and other jobs.
// ─────────────────────────────────────────
import { supabase } from "../../config/supabase.js";

export async function getLatestScore(planId) {
  const { data, error } = await supabase
    .from("aeo_scores")
    .select("score, breakdown, created_at")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ getLatestScore failed:", error.message);
    return null;
  }

  return data || null;
}

export async function getLatestExplanation(planId) {
  const { data, error } = await supabase
    .from("aeo_score_explanations")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ getLatestExplanation failed:", error.message);
    return null;
  }

  return data || null;
}

// Score history for trend charts (last 30 days)
export async function getScoreHistory(planId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("aeo_scores")
    .select("score, breakdown, created_at")
    .eq("plan_id", planId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ getScoreHistory failed:", error.message);
    return [];
  }

  return (data || []).map((row) => ({
    score:      row.score,
    created_at: row.created_at,
    wins:       row.breakdown?.wins        || 0,
    losses:     row.breakdown?.losses      || 0,
    shared:     row.breakdown?.shared      || 0,
    missed:     row.breakdown?.missed      || 0,
    presence:   row.breakdown?.brandPresenceRate || 0,
  }));
}
