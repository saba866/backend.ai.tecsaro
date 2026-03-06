import { supabase } from "../config/supabase.js";
import { checkVisibility } from "../services/aeo/aeoMonitor.service.js";

export async function runAeoMonitorJob(planId) {
  console.log("📡 Running AEO monitor job");

  const { data: prompts } = await supabase
    .from("aeo_prompts")
    .select("id, prompt")
    .eq("plan_id", planId);

  if (!prompts?.length) {
    console.log("ℹ️ No prompts to monitor");
    return;
  }

  for (const p of prompts) {
    await checkVisibility(planId, p.id, p.prompt);
  }

  console.log("✅ AEO monitoring completed");
}
