import axios from "axios";
import { supabase } from "../../config/supabase.js";

export async function fetchCompetitorAnswers(
  planId,
  promptId,
  query,
  options = {}
) {
  const serpUrl = "https://serpapi.com/search.json";

  const { data } = await axios.get(serpUrl, {
    params: {
      q: query,
      engine: "google",
      api_key: process.env.SERP_API_KEY,
      num: 10,
    },
    timeout: 15000,
  });

  const results = data?.organic_results ?? [];
  const domains = [];

  for (const r of results) {
    if (!r.link) continue;

    const domain = new URL(r.link).hostname.replace("www.", "");

    // skip own brand
    if (domain.includes("tecsaro")) continue;

    domains.push(domain);

    // keep old behavior unless explicitly disabled
    if (!options.collectOnly) {
      await supabase.from("aeo_competitor_answers").upsert({
        plan_id: planId,
        prompt_id: promptId,
        domain,
        score: Math.max(0, 100 - r.position * 10),
      });
    }
  }

  // 🔥 THIS IS THE IMPORTANT PART
  return domains;
}
