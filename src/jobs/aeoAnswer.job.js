


import { supabase }      from "../config/supabase.js";
import { askAI }         from "../services/aeo/index.js";
import { safeJsonParse } from "../utils/safeJson.js";

const BATCH_SIZE  = 15; // process 15 mappings in parallel
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────
// Generate both prompts for one mapping in parallel
// ─────────────────────────────────────────
async function processMapping(mapping, planId) {
  const page   = mapping.aeo_pages;
  const prompt = mapping.aeo_prompts;

  if (!page?.content_text || page.content_text.length < 300) {
    return { skipped: true, reason: "too_short" };
  }

  // Check if answer already exists
  const { data: existing } = await supabase
    .from("aeo_answers")
    .select("id")
    .eq("page_id", page.id)
    .eq("prompt_id", prompt.id)
    .maybeSingle();

  if (existing) return { skipped: true, reason: "exists" };

  const aiPrompt = `
You are simulating how a real AI search engine answers users.
Answer about the MARKET, not one company. Mention multiple tools/platforms.

QUESTION: "${prompt.prompt}"

Return ONLY JSON:
{
  "summary": "4-6 sentence neutral market answer mentioning different solution types",
  "faq": [],
  "bullets": []
}`;

  const webPrompt = `
You are simulating how real AI assistants answer questions.
Answer like ChatGPT or Perplexity. Mention real known platforms. Include multiple brands.

QUESTION: "${prompt.prompt}"

Write one natural paragraph answer including known platforms.`;

  // ✅ Run both AI calls in PARALLEL for each mapping
  const [rawResult, webResult] = await Promise.allSettled([
    askAI(aiPrompt),
    askAI(webPrompt),
  ]);

  const raw          = rawResult.status === "fulfilled" ? rawResult.value : "";
  const webAnswerRaw = webResult.status === "fulfilled"  ? webResult.value  : "";

  let parsed = safeJsonParse(raw);
  if (!parsed?.summary) {
    parsed = { summary: raw?.slice(0, 500) || "", faq: [], bullets: [] };
  }

  const { error } = await supabase
    .from("aeo_answers")
    .upsert({
      plan_id:         planId,
      page_id:         page.id,
      prompt_id:       prompt.id,
      summary:         parsed.summary,
      faq:             parsed.faq     || [],
      bullets:         parsed.bullets || [],
      web_answer:      webAnswerRaw?.slice(0, 2000) || "",
      brand_mentioned: false,
      competitors:     [],
    }, { onConflict: "prompt_id,page_id" });

  if (error) throw new Error(`Save failed: ${error.message}`);

  return { skipped: false };
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────
export async function runAnswerJob(planId) {
  if (typeof planId !== "string") throw new Error(`runAnswerJob: expected UUID string`);
  console.log("🧠 Answer job started:", planId);

  const { data: mappings, error: mappingError } = await supabase
    .from("aeo_prompt_page_map")
    .select(`
      prompt_id, page_id,
      aeo_prompts!inner ( id, prompt, plan_id ),
      aeo_pages!inner   ( id, url, content_text, status )
    `)
    .eq("aeo_prompts.plan_id", planId)
    .eq("aeo_pages.status", "understood");

  if (mappingError) { console.error("❌ Failed to fetch mappings:", mappingError); throw mappingError; }
  if (!mappings?.length) { console.log("⚠️ No mappings found — run mapping step first."); return; }

  console.log(`📝 Generating answers for ${mappings.length} prompt-page pairs...`);
  console.log(`⚡ Parallel batch size: ${BATCH_SIZE}`);

  let generatedCount = 0;
  let skippedCount   = 0;

  // Process in parallel batches
  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const batch   = mappings.slice(i, i + BATCH_SIZE);
    const batchNo = Math.floor(i / BATCH_SIZE) + 1;
    const total   = Math.ceil(mappings.length / BATCH_SIZE);

    console.log(`\n📦 Batch [${batchNo}/${total}] — ${batch.length} mappings in parallel`);

    const results = await Promise.allSettled(
      batch.map((mapping) => processMapping(mapping, planId))
    );

    for (let j = 0; j < results.length; j++) {
      const r       = results[j];
      const mapping = batch[j];
      const label   = mapping.aeo_prompts?.prompt?.slice(0, 50) ?? "?"

      if (r.status === "rejected") {
        console.error(`   ❌ ${label}... — ${r.reason?.message}`);
        skippedCount++;
      } else if (r.value?.skipped) {
        skippedCount++;
      } else {
        generatedCount++;
        console.log(`   ✅ (${generatedCount}/${mappings.length - skippedCount}) ${label}...`);
      }
    }

    // Small pause between batches to avoid rate limits
    if (i + BATCH_SIZE < mappings.length) await sleep(200);
  }

  console.log(`\n🧠 Answer job completed: ${generatedCount} generated, ${skippedCount} skipped`);
}