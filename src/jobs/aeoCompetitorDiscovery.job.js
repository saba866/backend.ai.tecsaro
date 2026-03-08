


// import { supabase } from "../config/supabase.js";
// import { askAI } from "../services/aeo/index.js";

// /**
//  * AI-native Competitor Discovery (NO SERP API)
//  * - Zero external API cost
//  * - Uses AI citation knowledge
//  * - AEO-correct (Answer Engine focused)
//  */
// export async function runCompetitorDiscovery(planId) {
//   console.log("⚔️ Running AI-based competitor discovery:", planId);

//   const { data: prompts, error } = await supabase
//     .from("aeo_prompts")
//     .select("id, prompt")
//     .eq("plan_id", planId)
//     .limit(10);

//   if (error || !prompts?.length) {
//     console.warn("⚠️ No prompts found for competitor discovery");
//     return;
//   }

//   const domainCounts = {};

//   for (const p of prompts) {
//     console.log("🔍 Discovering competitors for prompt:", p.prompt);

//     const aiPrompt = `
// You are an AI search engine.

// For the following question, list up to 5 websites
// that are commonly referenced or cited when answering it.

// Question:
// "${p.prompt}"

// Rules:
// - Return ONLY a JSON array
// - Each item must be a clean domain name (no https, no paths)
// - Do NOT include social media sites
// - Do NOT include forums
// - Do NOT include the user's own domain

// Example output:
// ["example.com", "competitor.io"]
// `;

//     let domains = [];

//     try {
//       const raw = await askAI(aiPrompt);
//       const parsed = JSON.parse(
//         raw.match(/\[[\s\S]*\]/)?.[0] || "[]"
//       );

//       if (Array.isArray(parsed)) {
//         domains = parsed;
//       }
//     } catch {
//       console.warn("⚠️ Failed to parse competitor domains for:", p.prompt);
//       continue;
//     }

//     for (const domain of domains) {
//       // 🧹 Final noise filter
//       if (
//         !domain ||
//         domain.includes("google.") ||
//         domain.includes("youtube.") ||
//         domain.includes("reddit.") ||
//         domain.includes("quora.") ||
//         domain.includes("facebook.") ||
//         domain.includes("linkedin.")
//       ) {
//         continue;
//       }

//       domainCounts[domain] = (domainCounts[domain] || 0) + 1;
//     }
//   }

//   const values = Object.values(domainCounts);
//   if (!values.length) {
//     console.warn("⚠️ No competitor domains detected");
//     return;
//   }

//   const max = Math.max(...values);

//   for (const domain of Object.keys(domainCounts)) {
//     const visibility = Math.round((domainCounts[domain] / max) * 100);

//     await supabase
//       .from("aeo_competitor_domains")
//       .upsert({
//         plan_id: planId,
//         domain,
//         visibility,
//       });

//     console.log("✅ Competitor saved:", domain, "visibility:", visibility);
//   }

//   console.log("✅ AI competitor discovery completed");
// }





import { supabase } from "../config/supabase.js";
import { askAI } from "../services/aeo/index.js";

/**
 * AI-native Competitor Discovery
 * Writes to: aeo_competitors (NOT the old aeo_competitor_domains)
 * Sets pipeline_status = "awaiting_competitor_review" when done
 * so Step5 polling resolves and shows suggestions to the user.
 */
export async function runCompetitorDiscovery(planId) {
  console.log("⚔️ Running AI-based competitor discovery:", planId);

  // ── 1. Get brand domain for noise filtering ──────────────────────────────
  const { data: plan } = await supabase
    .from("plans")
    .select("website_url")
    .eq("id", planId)
    .single();

  const brandDomain = (plan?.website_url ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .toLowerCase();

  // ── 2. Fetch up to 10 approved prompts ───────────────────────────────────
  const { data: prompts, error } = await supabase
    .from("aeo_prompts")
    .select("id, prompt")
    .eq("plan_id", planId)
    .limit(10);

  if (error || !prompts?.length) {
    console.warn("⚠️ No prompts found for competitor discovery — skipping");
    await setStatus(planId, "awaiting_competitor_review");
    return;
  }

  // ── 3. Ask AI for competitor domains per prompt ──────────────────────────
  const domainCounts = {};

  for (const p of prompts) {
    console.log("🔍 Discovering competitors for:", p.prompt);

    const aiPrompt = `
You are an AI search engine.

For the following question, list up to 5 websites that are commonly
referenced or cited when answering it.

Question:
"${p.prompt}"

Rules:
- Return ONLY a JSON array of clean domain names (no https, no paths, no www)
- Exclude social media: google, youtube, reddit, quora, facebook, linkedin, twitter, instagram, tiktok, pinterest
- Exclude generic info sites: wikipedia, wikihow, britannica
- Exclude the brand's own domain: ${brandDomain}
- If no good competitors exist, return []

Example output:
["example.com", "competitor.io"]
`;

    try {
      const raw    = await askAI(aiPrompt);
      const match  = raw.match(/\[[\s\S]*?\]/);
      const parsed = match ? JSON.parse(match[0]) : [];

      if (!Array.isArray(parsed)) continue;

      for (const domain of parsed) {
        if (typeof domain !== "string" || !domain.includes(".")) continue;

        const clean = domain.toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0]
          .trim();

        if (!clean) continue;

        // Noise filter
        const blocked = [
          "google.", "youtube.", "reddit.", "quora.", "facebook.",
          "linkedin.", "twitter.", "instagram.", "tiktok.", "pinterest.",
          "wikipedia.", "wikihow.", "britannica.",
          brandDomain,
        ];
        if (blocked.some(b => clean.includes(b))) continue;

        domainCounts[clean] = (domainCounts[clean] || 0) + 1;
      }
    } catch (err) {
      console.warn("⚠️ Failed to parse competitor domains for:", p.prompt, err?.message);
    }
  }

  // ── 4. Upsert into aeo_competitors ───────────────────────────────────────
  const domains = Object.keys(domainCounts);

  if (!domains.length) {
    console.warn("⚠️ No competitor domains detected — marking for review anyway");
    await setStatus(planId, "awaiting_competitor_review");
    return;
  }

  const maxCount = Math.max(...Object.values(domainCounts));

  for (const domain of domains) {
    const count           = domainCounts[domain];
    const confidence      = parseFloat((count / maxCount).toFixed(2)); // 0.0–1.0
    const classification  = "direct";
    const name            = domainToName(domain);

    const { error: upsertErr } = await supabase
      .from("aeo_competitors")
      .upsert({
        plan_id:          planId,
        domain,
        name,
        source:           "ai",
        classification,
        confidence_score: confidence,
        times_seen:       count,
        approved:         false,          // requires user approval
        status:           "active",
        last_seen_at:     new Date().toISOString(),
        detected_reason:  `Appeared in ${count} of ${prompts.length} prompt${prompts.length !== 1 ? "s" : ""} AI answers`,
      }, {
        onConflict: "plan_id,domain",     // unique constraint
        // On duplicate: bump times_seen and confidence, keep approved state
        ignoreDuplicates: false,
      });

    if (upsertErr) {
      console.error("❌ Failed to upsert competitor:", domain, upsertErr.message);
    } else {
      console.log("✅ Competitor saved:", domain, "confidence:", confidence);
    }
  }

  // ── 5. Set pipeline_status → "awaiting_competitor_review" ────────────────
  // This is what Step5 polls for — MUST be set or UI polls forever
  await setStatus(planId, "awaiting_competitor_review");
  console.log("✅ AI competitor discovery completed —", domains.length, "competitors found");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setStatus(planId, status) {
  const { error } = await supabase
    .from("plans")
    .update({ pipeline_status: status })
    .eq("id", planId);

  if (error) {
    console.error(`❌ Failed to set pipeline_status=${status}:`, error.message);
  } else {
    console.log(`📌 pipeline_status → ${status} (planId=${planId})`);
  }
}

function domainToName(domain = "") {
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase()) || domain;
}