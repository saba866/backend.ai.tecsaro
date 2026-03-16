



import { supabase } from "../config/supabase.js";
import { askAI }     from "../services/aeo/index.js";

/**
 * AI-native Competitor Discovery — Phase 2
 *
 * Writes to: aeo_competitors (source="ai", approved=false)
 * Skips domains the user already added (source="user", approved=true)
 * Sets pipeline_status = "awaiting_competitor_review" when done
 * so Step5 polling resolves and shows only NEW suggestions.
 */
export async function runCompetitorDiscovery(planId) {
  console.log("⚔️ Running AI-based competitor discovery:", planId);

  // ── 1. Get brand domain ──────────────────────────────────────────────────
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

  // ── 2. Get domains user already added in Step 2 ──────────────────────────
  // These are source="user", approved=true — skip them in AI suggestions
  const { data: userAdded } = await supabase
    .from("aeo_competitors")
    .select("domain")
    .eq("plan_id", planId)
    .eq("source", "user")
    .eq("approved", true);

  const userDomains = new Set(
    (userAdded ?? []).map(r =>
      r.domain.toLowerCase().replace(/^www\./, "")
    )
  );

  console.log(`📋 User already added ${userDomains.size} competitor(s):`, [...userDomains]);

  // ── 3. Fetch up to 10 prompts ────────────────────────────────────────────
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

  // ── 4. Ask AI for competitor domains per prompt ──────────────────────────
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

        // ── KEY FIX: skip domains user already added in Step 2 ──
        if (userDomains.has(clean)) {
          console.log(`⏭️  Skipping "${clean}" — already added by user`);
          continue;
        }

        domainCounts[clean] = (domainCounts[clean] || 0) + 1;
      }
    } catch (err) {
      console.warn("⚠️ Failed to parse competitor domains for:", p.prompt, err?.message);
    }
  }

  // ── 5. Upsert into aeo_competitors (source="ai", approved=false) ─────────
  const domains = Object.keys(domainCounts);

  if (!domains.length) {
    console.warn("⚠️ No new AI competitor domains detected — marking for review anyway");
    await setStatus(planId, "awaiting_competitor_review");
    return;
  }

  const maxCount = Math.max(...Object.values(domainCounts));

  for (const domain of domains) {
    const count          = domainCounts[domain];
    const confidence     = parseFloat((count / maxCount).toFixed(2));
    const name           = domainToName(domain);

    const { error: upsertErr } = await supabase
      .from("aeo_competitors")
      .upsert({
        plan_id:          planId,
        domain,
        name,
        source:           "ai",           // ← AI-discovered
        classification:   "direct",
        confidence_score: confidence,
        times_seen:       count,
        approved:         false,          // ← requires user approval in Step 5
        status:           "active",
        last_seen_at:     new Date().toISOString(),
        detected_reason:  `Appeared in ${count} of ${prompts.length} prompt${prompts.length !== 1 ? "s" : ""} AI answers`,
      }, {
        onConflict:       "plan_id,domain",
        ignoreDuplicates: false,
      });

    if (upsertErr) {
      console.error("❌ Failed to upsert competitor:", domain, upsertErr.message);
    } else {
      console.log("✅ AI competitor saved:", domain, "| confidence:", confidence, "| times_seen:", count);
    }
  }

  // ── 6. Set pipeline_status → "awaiting_competitor_review" ────────────────
  await setStatus(planId, "awaiting_competitor_review");
  console.log(`✅ Competitor discovery done — ${domains.length} new AI suggestions (${userDomains.size} user-added skipped)`);
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