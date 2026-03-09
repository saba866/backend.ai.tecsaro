







import { supabase }      from "../config/supabase.js";
import { safeJsonParse } from "../utils/aiJson.js";
import { runGemini }     from "../services/aeo/gemini.js";
import OpenAI            from "openai";

const openai     = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const sleep      = (ms) => new Promise((r) => setTimeout(r, ms));
const BATCH_SIZE = 10;

// ─────────────────────────────────────────
// ENGINE FUNCTIONS
// ─────────────────────────────────────────
async function askChatGPT(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", max_tokens: 400, temperature: 0.3,
      messages: [
        { role: "system", content: "You are a helpful AI assistant. Answer clearly, mentioning relevant tools, platforms, and brands by name." },
        { role: "user",   content: prompt },
      ],
    });
    return response.choices[0]?.message?.content || null;
  } catch (err) { console.error("❌ ChatGPT error:", err.message); return null; }
}

async function askGeminiVisibility(prompt) {
  try {
    const result = await runGemini(
      `Answer this question naturally, naming real tools, platforms, and brands:\n\n${prompt}`,
      { temperature: 0.3, maxOutputTokens: 400 }
    );
    if (!result) return null;
    try {
      const parsed = JSON.parse(result);
      return parsed?.answer || parsed?.summary || parsed?.text || result;
    } catch { return result; }
  } catch (err) { console.error("❌ Gemini error:", err.message); return null; }
}

async function askPerplexityVisibility(prompt) {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar", max_tokens: 400, temperature: 0.2,
        messages: [
          { role: "system", content: "Answer clearly, naming real tools, platforms, and brands." },
          { role: "user",   content: prompt },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) { console.error("❌ Perplexity error:", err.message); return null; }
}

// ─────────────────────────────────────────
// DETECTION
// ─────────────────────────────────────────
function normalize(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function firstIndex(normalizedText, aliases) {
  let earliest = Infinity;
  for (const alias of aliases) {
    if (alias.length < 3) continue;
    const idx = normalizedText.indexOf(alias);
    if (idx !== -1 && idx < earliest) earliest = idx;
  }
  return earliest;
}

function detectMentions(answerText, brandProfile, competitorProfiles) {
  const normalized = normalize(answerText);

  const brandAliases = [
    brandProfile.name,
    brandProfile.domain?.replace(/\.(com|ai|co|io|org|net)$/i, ""),
    ...(brandProfile.aliases || []),
  ].filter(Boolean).map(normalize);

  const competitorEntries = competitorProfiles.map((c) => ({
    entity_name: c.name || c.domain,
    entity_type: "competitor",
    aliases: [
      c.name,
      c.domain?.replace(/\.(com|ai|co|io|org|net)$/i, ""),
      ...(c.aliases || []),
    ].filter(Boolean).map(normalize),
  }));

  const allEntities = [
    { entity_name: brandProfile.name || "brand", entity_type: "brand", aliases: brandAliases },
    ...competitorEntries,
  ].map((e) => ({
    ...e,
    firstIdx:  firstIndex(normalized, e.aliases),
    mentioned: firstIndex(normalized, e.aliases) !== Infinity,
  }));

  const mentionedEntities = allEntities
    .filter((e) => e.mentioned)
    .sort((a, b) => a.firstIdx - b.firstIdx);

  const positionMap = {};
  mentionedEntities.forEach((e, idx) => { positionMap[e.entity_name] = idx + 1; });

  return allEntities.map((e) => ({
    entity_name: e.entity_name,
    entity_type: e.entity_type,
    mentioned:   e.mentioned,
    position:    e.mentioned ? (positionMap[e.entity_name] ?? null) : null,
  }));
}

// ─────────────────────────────────────────
// SAVE ONE ENGINE RESULT
// ─────────────────────────────────────────
async function saveEngineResult(planId, promptId, engine, answerText, brandProfile, competitorProfiles) {
  if (!answerText) return null;

  const { data: answerRow, error: insertErr } = await supabase
    .from("aeo_ai_answers")
    .insert({ plan_id: planId, prompt_id: promptId, engine, answer_text: answerText, created_at: new Date().toISOString() })
    .select("id")
    .single();

  if (insertErr || !answerRow) {
    console.error(`   ❌ [${engine}] Save failed:`, insertErr?.message);
    return null;
  }

  const mentions         = detectMentions(answerText, brandProfile, competitorProfiles);
  const brandResult      = mentions.find((m) => m.entity_type === "brand");
  const brandMentioned   = brandResult?.mentioned || false;
  const brandPosition    = brandResult?.position  ?? null;
  const competitorsFound = mentions.filter((m) => m.entity_type === "competitor" && m.mentioned).map((m) => m.entity_name);

  console.log(`   ✅ [${engine}] Brand: ${brandMentioned ? `✓ pos=${brandPosition}` : "✗"} | Competitors: ${competitorsFound.join(", ") || "none"}`);

  if (mentions.length > 0) {
    await supabase.from("aeo_mention_results").insert(
      mentions.map((m) => ({
        plan_id:     planId,
        answer_id:   answerRow.id,
        entity_name: m.entity_name,
        entity_type: m.entity_type,
        mentioned:   m.mentioned,
        position:    m.position,
      }))
    );
  }

  return { answerId: answerRow.id, brandMentioned, brandPosition, competitorsFound };
}

// ─────────────────────────────────────────
// PROCESS ONE PROMPT
// ─────────────────────────────────────────
async function processPrompt(p, engineNames, engineFns, planId, brandProfile, competitorProfiles) {
  const results = await Promise.allSettled(engineFns.map((fn) => fn(p.prompt)));
  const answers = [];
  let anySuccess = false;

  for (let e = 0; e < results.length; e++) {
    const answer     = results[e].status === "fulfilled" ? results[e].value : null;
    const engineName = engineNames[e];
    if (!answer) { console.log(`   ⚠️  [${engineName}] No answer`); continue; }
    await saveEngineResult(planId, p.id, engineName, answer, brandProfile, competitorProfiles);
    answers.push(answer);
    anySuccess = true;
  }

  return { anySuccess, answers };
}

// ─────────────────────────────────────────
// DISCOVER NEW COMPETITORS
//
// Fixes vs old version:
//  1. onConflict was "plan_id,name" → no such constraint → now "plan_id,domain"
//  2. AI returned string names → domain was never set → now asks for {name, domain} pairs
//  3. status was "pending_approval" → suggestions never showed → now "active"
// ─────────────────────────────────────────
async function discoverNewCompetitors(planId, allAnswers) {
  if (!allAnswers.length) return;

  try {
    const combinedText = allAnswers.join(" ").slice(0, 3000);

    const response = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      max_tokens:      400,
      temperature:     0,
      response_format: { type: "json_object" },
      messages: [
        {
          role:    "system",
          content: "Extract all software tools, platforms, SaaS products, or services mentioned. Return JSON only.",
        },
        {
          role:    "user",
          content: `Extract every tool/platform/service from this text.\n\n${combinedText}\n\nReturn ONLY this JSON shape — include the website domain for each:\n{ "tools": [{ "name": "Acuity Scheduling", "domain": "acuityscheduling.com" }, { "name": "Doodle", "domain": "doodle.com" }] }`,
        },
      ],
    });

    const parsed = safeJsonParse(response.choices[0]?.message?.content || "{}");
    const tools  = Array.isArray(parsed?.tools) ? parsed.tools : [];
    if (!tools.length) return;

    // Fetch known competitors + brand to avoid duplicates
    const [{ data: known }, { data: brand }] = await Promise.all([
      supabase.from("aeo_competitors").select("name, domain").eq("plan_id", planId),
      supabase.from("aeo_brand_profile").select("brand_name, domain").eq("plan_id", planId).maybeSingle(),
    ]);

    const knownValues = [
      brand?.brand_name, brand?.domain,
      ...(known || []).flatMap((c) => [c.name, c.domain]),
    ].filter(Boolean).map((n) => n.toLowerCase());

    const newTools = tools
      .filter((t) => t?.name && t.name.length > 2 && !knownValues.includes(t.name.toLowerCase()))
      .slice(0, 10);

    if (!newTools.length) return;

    await Promise.allSettled(newTools.map(async (tool) => {
      // Clean domain — fallback: slugify name + .com
      let domain = (tool.domain || "")
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .trim();

      if (!domain || !domain.includes(".")) {
        domain = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".com";
      }

      // Check if already exists by domain
      const { data: existing } = await supabase
        .from("aeo_competitors")
        .select("id, times_seen, status")
        .eq("plan_id", planId)
        .eq("domain", domain)
        .maybeSingle();

      if (existing?.status === "ignored") return;

      const { error } = await supabase
        .from("aeo_competitors")
        .upsert(
          {
            plan_id:          planId,
            domain,                         // ← required for unique constraint
            name:             tool.name,
            source:           "ai",
            classification:   "direct",
            confidence_score: 0.5,
            approved:         false,
            status:           "active",     // ← was "pending_approval" — suggestions were hidden
            times_seen:       (existing?.times_seen || 0) + 1,
            detected_reason:  "Found in AI visibility answers",
            last_seen_at:     new Date().toISOString(),
          },
          { onConflict: "plan_id,domain" }  // ← THE FIX: was "plan_id,name" (constraint doesn't exist)
        );

      if (error) {
        console.error(`   ❌ Failed to upsert ${tool.name}:`, error.message);
      } else {
        console.log(`   ✅ Competitor saved: ${tool.name} (${domain})`);
      }
    }));

    console.log(`💡 Discovered ${newTools.length} new competitors: ${newTools.map(t => t.name).join(", ")}`);
  } catch (err) {
    console.error("❌ Competitor discovery failed:", err.message);
  }
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────
export async function runVisibilityJob(planId) {
  console.log("\n🔭 [VisibilityJob] Starting for plan:", planId);

  const { data: plan } = await supabase.from("plans").select("tier, name").eq("id", planId).single();
  const tier  = plan?.tier || "starter";
  const isPro = tier === "pro";

  const engineNames = isPro ? ["chatgpt", "gemini", "perplexity"] : ["chatgpt", "gemini"];
  const engineFns   = isPro ? [askChatGPT, askGeminiVisibility, askPerplexityVisibility] : [askChatGPT, askGeminiVisibility];

  console.log(`📦 Tier: ${tier.toUpperCase()} | Engines: ${engineNames.join(", ")}`);

  const { data: prompts, error: promptErr } = await supabase
    .from("aeo_prompts")
    .select("id, prompt")
    .eq("plan_id", planId)
    .in("status", ["active", "manually_added"])
    .order("created_at", { ascending: true });

  if (promptErr || !prompts?.length) { console.log("ℹ️  No active prompts — skipping"); return; }

  console.log(`📊 ${prompts.length} prompts × ${engineNames.length} engines = ${prompts.length * engineNames.length} answers`);

  const [{ data: brand }, { data: competitors }] = await Promise.all([
    supabase.from("aeo_brand_profile").select("brand_name, domain, aliases").eq("plan_id", planId).maybeSingle(),
    supabase.from("aeo_competitors").select("name, domain, aliases").eq("plan_id", planId).eq("status", "active").eq("approved", true),
  ]);

  const brandProfile = {
    name:    brand?.brand_name || plan?.name || "",
    domain:  brand?.domain     || "",
    aliases: brand?.aliases    || [],
  };

  const competitorProfiles = (competitors || []).map((c) => ({
    name: c.name || c.domain, domain: c.domain || "", aliases: c.aliases || [],
  }));

  console.log(`🧠 Brand: "${brandProfile.name}" | Competitors: ${competitorProfiles.length}`);

  const allAnswers = [];
  let tracked = 0, failed = 0;

  for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
    const batch   = prompts.slice(i, i + BATCH_SIZE);
    const batchNo = Math.floor(i / BATCH_SIZE) + 1;
    const total   = Math.ceil(prompts.length / BATCH_SIZE);

    console.log(`\n📦 Batch [${batchNo}/${total}] — ${batch.length} prompts in parallel`);

    const results = await Promise.allSettled(
      batch.map((p) => {
        console.log(`   📍 "${p.prompt.slice(0, 55)}..."`);
        return processPrompt(p, engineNames, engineFns, planId, brandProfile, competitorProfiles);
      })
    );

    for (const result of results) {
      if (result.status === "rejected") { failed++; continue; }
      const { anySuccess, answers } = result.value;
      if (anySuccess) { tracked++; allAnswers.push(...answers); }
      else              failed++;
    }

    if (i + BATCH_SIZE < prompts.length) await sleep(200);
  }

  if (allAnswers.length > 0) {
    console.log("\n🔍 Scanning answers for new competitors...");
    await discoverNewCompetitors(planId, allAnswers);
  }

  console.log(`\n✅ [VisibilityJob] Complete`);
  console.log(`   Tier:    ${tier} (${engineNames.join(" + ")})`);
  console.log(`   Tracked: ${tracked}/${prompts.length} prompts`);
  console.log(`   Failed:  ${failed}`);
}

export { runVisibilityJob as startVisibilityJob };