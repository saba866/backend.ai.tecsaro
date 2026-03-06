import { supabase } from "../../config/supabase.js";

export async function checkAeoScoreAlert(planId, newScore) {
  // get enabled alert
  const { data: alert } = await supabase
    .from("aeo_alerts")
    .select("*")
    .eq("plan_id", planId)
    .eq("enabled", true)
    .maybeSingle();

  if (!alert || !alert.threshold) return;

  // get previous score
  const { data: prev } = await supabase
    .from("aeo_scores")
    .select("score")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .range(1, 1)
    .maybeSingle();

  if (!prev) return;

  const drop = prev.score - newScore;

  if (drop >= alert.threshold) {
    await supabase.from("aeo_alert_events").insert({
      plan_id: planId,
      old_score: prev.score,
      new_score: newScore,
      message: `AEO score dropped by ${drop} points`
    });

    console.log("🚨 AEO SCORE ALERT TRIGGERED");
  }
}
