// import { supabase } from "../config/supabase.js";
// import { fetchCompetitorAnswers } from "../services/aeo/serpCompetitor.service.js";
// import { isRealCompetitor } from "../services/aeo/aiCompetitorJudge.service.js";

// export async function runCompetitorDiscovery(planId) {
//   console.log("⚔️ Running competitor discovery:", planId);

//   const { data: prompts } = await supabase
//     .from("aeo_prompts")
//     .select("id, prompt")
//     .eq("plan_id", planId)
//     .limit(10);

//   if (!prompts?.length) return;

//   const domainCounts = {};

//   for (const p of prompts) {
//     const domains = await fetchCompetitorAnswers(
//       planId,
//       p.id,
//       p.prompt,
//       { collectOnly: true }
//     );

//     for (const domain of domains) {
//       const isCompetitor = await isRealCompetitor(domain, planId);
      
//       if (!isCompetitor) continue;

//       domainCounts[domain] = (domainCounts[domain] || 0) + 1;
//     }
//   }

//   const max = Math.max(...Object.values(domainCounts), 1);

//   for (const domain in domainCounts) {
//     const visibility = Math.round((domainCounts[domain] / max) * 100);

//     await supabase.from("aeo_competitor_domains").upsert({
//       plan_id: planId,
//       domain,
//       visibility,
//     });

//     console.log("✅ Competitor:", domain, "visibility:", visibility);
//   }

//   console.log("✅ Competitor discovery completed");
// }




import { supabase } from "../config/supabase.js";
import { askAI } from "../services/aeo/index.js";

/**
 * AI-native Competitor Discovery (NO SERP API)
 * - Zero external API cost
 * - Uses AI citation knowledge
 * - AEO-correct (Answer Engine focused)
 */
export async function runCompetitorDiscovery(planId) {
  console.log("⚔️ Running AI-based competitor discovery:", planId);

  const { data: prompts, error } = await supabase
    .from("aeo_prompts")
    .select("id, prompt")
    .eq("plan_id", planId)
    .limit(10);

  if (error || !prompts?.length) {
    console.warn("⚠️ No prompts found for competitor discovery");
    return;
  }

  const domainCounts = {};

  for (const p of prompts) {
    console.log("🔍 Discovering competitors for prompt:", p.prompt);

    const aiPrompt = `
You are an AI search engine.

For the following question, list up to 5 websites
that are commonly referenced or cited when answering it.

Question:
"${p.prompt}"

Rules:
- Return ONLY a JSON array
- Each item must be a clean domain name (no https, no paths)
- Do NOT include social media sites
- Do NOT include forums
- Do NOT include the user's own domain

Example output:
["example.com", "competitor.io"]
`;

    let domains = [];

    try {
      const raw = await askAI(aiPrompt);
      const parsed = JSON.parse(
        raw.match(/\[[\s\S]*\]/)?.[0] || "[]"
      );

      if (Array.isArray(parsed)) {
        domains = parsed;
      }
    } catch {
      console.warn("⚠️ Failed to parse competitor domains for:", p.prompt);
      continue;
    }

    for (const domain of domains) {
      // 🧹 Final noise filter
      if (
        !domain ||
        domain.includes("google.") ||
        domain.includes("youtube.") ||
        domain.includes("reddit.") ||
        domain.includes("quora.") ||
        domain.includes("facebook.") ||
        domain.includes("linkedin.")
      ) {
        continue;
      }

      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  }

  const values = Object.values(domainCounts);
  if (!values.length) {
    console.warn("⚠️ No competitor domains detected");
    return;
  }

  const max = Math.max(...values);

  for (const domain of Object.keys(domainCounts)) {
    const visibility = Math.round((domainCounts[domain] / max) * 100);

    await supabase
      .from("aeo_competitor_domains")
      .upsert({
        plan_id: planId,
        domain,
        visibility,
      });

    console.log("✅ Competitor saved:", domain, "visibility:", visibility);
  }

  console.log("✅ AI competitor discovery completed");
}
