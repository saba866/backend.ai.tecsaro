// import { supabase } from "../../config/supabase.js";

// export async function calculateAeoScore(planId) {
//   const [
//     prompts,
//     mappings,
//     answers,
//     visibility,
//     gaps,
//     pages
//   ] = await Promise.all([
//     supabase.from("aeo_prompts").select("id").eq("plan_id", planId),
//     supabase.from("aeo_prompt_page_map").select("id"),
//     supabase.from("aeo_answers").select("id"),
//     supabase.from("aeo_visibility").select("id, mentioned").eq("plan_id", planId),
//     supabase.from("aeo_answer_gaps").select("id").eq("plan_id", planId),
//     supabase.from("aeo_pages").select("id, status").eq("plan_id", planId)
//   ]);

//   const totalPrompts = prompts.data.length || 1;
//   const mapped = mappings.data.length;
//   const answered = answers.data.length;
//   const mentioned = visibility.data.filter(v => v.mentioned).length;
//   const gapCount = gaps.data.length;

//   const promptCoverage = Math.round((mapped / totalPrompts) * 25);
//   const answerCoverage = Math.round((answered / mapped || 0) * 25);
//   const visibilityScore = Math.round((mentioned / totalPrompts) * 25);
//   const competitorScore = Math.round((1 - gapCount / totalPrompts) * 15);

//   let technicalScore = 0;
//   if (pages.data.some(p => p.status === "crawled")) technicalScore += 2;
//   if (pages.data.some(p => p.status === "understood")) technicalScore += 2;
//   if (mapped > 0) technicalScore += 2;
//   if (answered > 0) technicalScore += 2;
//   if (visibility.data.length > 0) technicalScore += 2;

//   const score =
//     promptCoverage +
//     answerCoverage +
//     visibilityScore +
//     competitorScore +
//     technicalScore;

//   return {
//     score: Math.min(100, score),
//     breakdown: {
//       promptCoverage,
//       answerCoverage,
//       visibilityScore,
//       competitorScore,
//       technicalScore
//     }
//   };
// }





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
