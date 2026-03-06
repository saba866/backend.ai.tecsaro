import { supabase } from "../config/supabase.js";
import OpenAI        from "openai";
import { safeJsonParse } from "../utils/aiJson.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────
// COMPETITOR DISCOVERY JOB
//
// 1. Load brand + crawled page summaries
// 2. Ask GPT to identify top competitors
// 3. Upsert with status = "active" (auto-approved)
//    so visibility job can immediately detect them
// ─────────────────────────────────────────
export async function runCompetitorJob(planId) {
  console.log("🔍 [CompetitorJob] Starting for plan:", planId);

  // ── LOAD PLAN + PAGES ──
  const [{ data: plan }, { data: pages }] = await Promise.all([
    supabase.from("plans").select("name, website_url").eq("id", planId).single(),
    supabase.from("aeo_pages").select("ai_summary, url").eq("plan_id", planId).not("ai_summary", "is", null).limit(5),
  ]);

  if (!plan) { console.warn("⚠️  Plan not found"); return; }

  const brandName  = plan.name        || "Unknown";
  const domain     = plan.website_url || "";
  const summaries  = (pages || []).map((p) => p.ai_summary).filter(Boolean).join("\n\n").slice(0, 2000);

  console.log(`📋 Discovering competitors for: "${brandName}"`);

  // ── ASK GPT FOR COMPETITORS ──
  let competitors = [];
  try {
    const response = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      max_tokens:      400,
      temperature:     0,
      response_format: { type: "json_object" },
      messages: [
        {
          role:    "system",
          content: "You are a market research expert. Identify direct competitors for the given brand. Return JSON only.",
        },
        {
          role:    "user",
          content: `
Brand: "${brandName}"
Domain: ${domain}
What they do: ${summaries || "Software product"}

List the 8 most direct competitors — tools users compare when evaluating "${brandName}".
Only include real, well-known products. Do NOT include "${brandName}" itself.

Return ONLY:
{
  "competitors": [
    { "name": "Competitor Name", "domain": "competitor.com", "reason": "one sentence why they compete" }
  ]
}`,
        },
      ],
    });

    const parsed = safeJsonParse(response.choices[0]?.message?.content || "{}");
    competitors  = parsed?.competitors || [];
  } catch (err) {
    console.error("❌ GPT competitor discovery failed:", err.message);
    return;
  }

  if (!competitors.length) {
    console.warn("⚠️  No competitors returned from GPT");
    return;
  }

  console.log(`💡 Found ${competitors.length} competitors: ${competitors.map((c) => c.name).join(", ")}`);

  // ── LOAD EXISTING COMPETITORS ──
  const { data: existing } = await supabase
    .from("aeo_competitors")
    .select("name, status")
    .eq("plan_id", planId);

  const existingNames = new Set((existing || []).map((c) => c.name.toLowerCase()));

  // ── UPSERT ALL AS "active" ──
  // Auto-approve so visibility job detects them immediately.
  // User can ignore/remove from dashboard if needed.
  let upserted = 0;
  for (const c of competitors) {
    if (!c.name || c.name.toLowerCase() === brandName.toLowerCase()) continue;

    // Don't downgrade manually approved/ignored competitors
    const alreadyExists = existingNames.has(c.name.toLowerCase());
    const existingStatus = existing?.find((e) => e.name.toLowerCase() === c.name.toLowerCase())?.status;
    if (existingStatus === "ignored") continue;

    const { error } = await supabase
      .from("aeo_competitors")
      .upsert(
        {
          plan_id:    planId,
          name:       c.name,
          domain:     c.domain     || null,
          source:     "ai_discovery",
          status:     "active",      // ✅ auto-approve for immediate detection
          approved:   true,
          times_seen: 1,
        },
        { onConflict: "plan_id,name" }
      );

    if (error) {
      console.error(`   ❌ Failed to upsert ${c.name}:`, error.message);
    } else {
      upserted++;
      console.log(`   ✅ ${alreadyExists ? "Updated" : "Added"}: ${c.name} (${c.domain || "no domain"})`);
    }
  }

  console.log(`✅ [CompetitorJob] ${upserted} competitors active for visibility detection`);
}