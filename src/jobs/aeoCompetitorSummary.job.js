// import { supabase } from "../config/supabase.js";

// export async function buildCompetitorSummary(planId) {
//   const { data } = await supabase
//     .from("aeo_competitor_answers")
//     .select("domain")
//     .eq("plan_id", planId);

//   if (!data?.length) return;

//   const counts = {};

//   for (const row of data) {
//     counts[row.domain] = (counts[row.domain] || 0) + 1;
//   }

//   const max = Math.max(...Object.values(counts));

//   for (const domain in counts) {
//     const visibility = Math.round((counts[domain] / max) * 100);

//     await supabase.from("aeo_competitor_domains").upsert({
//       plan_id: planId,
//       domain,
//       visibility,
//     });
//   }

//   console.log("📊 Competitor visibility updated");
// }




import { supabase } from "../config/supabase.js";

/**
 * Build Competitor Summary
 * Updates times_seen and confidence_score for approved AI competitors.
 * Uses aeo_competitors table (NOT the old aeo_competitor_domains or aeo_competitor_answers).
 */
export async function buildCompetitorSummary(planId) {
  console.log("📊 Building competitor summary for planId:", planId);

  // Get all AI-discovered competitors for this plan (approved or not)
  const { data: competitors, error } = await supabase
    .from("aeo_competitors")
    .select("id, domain, times_seen, confidence_score")
    .eq("plan_id", planId)
    .eq("source", "ai");

  if (error) {
    console.error("❌ buildCompetitorSummary fetch error:", error.message);
    return;
  }

  if (!competitors?.length) {
    console.warn("⚠️ No AI competitors found to summarize");
    return;
  }

  // Find the max times_seen to normalize confidence scores
  const maxSeen = Math.max(...competitors.map(c => c.times_seen ?? 1), 1);

  for (const comp of competitors) {
    const times_seen        = comp.times_seen ?? 1;
    const confidence_score  = parseFloat((times_seen / maxSeen).toFixed(2));

    const { error: updateErr } = await supabase
      .from("aeo_competitors")
      .update({
        confidence_score,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", comp.id);

    if (updateErr) {
      console.error(`❌ Failed to update summary for ${comp.domain}:`, updateErr.message);
    }
  }

  console.log(`✅ Competitor summary updated — ${competitors.length} AI competitors`);
}