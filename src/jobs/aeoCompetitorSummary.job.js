import { supabase } from "../config/supabase.js";

export async function buildCompetitorSummary(planId) {
  const { data } = await supabase
    .from("aeo_competitor_answers")
    .select("domain")
    .eq("plan_id", planId);

  if (!data?.length) return;

  const counts = {};

  for (const row of data) {
    counts[row.domain] = (counts[row.domain] || 0) + 1;
  }

  const max = Math.max(...Object.values(counts));

  for (const domain in counts) {
    const visibility = Math.round((counts[domain] / max) * 100);

    await supabase.from("aeo_competitor_domains").upsert({
      plan_id: planId,
      domain,
      visibility,
    });
  }

  console.log("📊 Competitor visibility updated");
}
