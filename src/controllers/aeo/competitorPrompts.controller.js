import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";

/**
 * GET /aeo/competitors/:competitorName/prompts?planId=xxx
 *
 * Returns every prompt where this competitor was mentioned.
 * For each prompt, shows the outcome per engine:
 *   win    = competitor ✓  brand ✗  (competitor wins this answer)
 *   shared = competitor ✓  brand ✓  (both mentioned)
 *   loss   = competitor ✗  brand ✓  (brand wins, competitor absent)
 */
export const getCompetitorPrompts = async (req, res) => {
  try {
    const { competitorName } = req.params;
    const { planId }         = req.query;

    if (!planId || !competitorName)
      return apiResponse(res, 400, "planId and competitorName required");

    // ── 1. All AI answers for this plan ─────────────────────────────────
    const { data: answers, error: answerErr } = await supabase
      .from("aeo_ai_answers")
      .select("id, engine, prompt_id, created_at")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false });

    if (answerErr) return apiResponse(res, 500, "Failed to load answers");
    if (!answers?.length) return apiResponse(res, 200, "No data", { prompts: [] });

    // ── 2. All mention results for this plan ─────────────────────────────
    const answerIds = answers.map(a => a.id);

    const { data: mentions, error: mentionErr } = await supabase
      .from("aeo_mention_results")
      .select("answer_id, entity_name, entity_type, mentioned")
      .in("answer_id", answerIds);

    if (mentionErr) return apiResponse(res, 500, "Failed to load mentions");

    // ── 3. Prompt texts ──────────────────────────────────────────────────
    const promptIds = [...new Set(answers.map(a => a.prompt_id).filter(Boolean))];
    const { data: promptRows } = await supabase
      .from("aeo_prompts")
      .select("id, prompt")
      .in("id", promptIds);

    const promptLookup = {};
    for (const p of promptRows ?? []) promptLookup[p.id] = p.prompt;

    // ── 4. Build answer → mentions map ───────────────────────────────────
    const mentionsByAnswer = {};
    for (const m of mentions ?? []) {
      if (!mentionsByAnswer[m.answer_id]) mentionsByAnswer[m.answer_id] = [];
      mentionsByAnswer[m.answer_id].push(m);
    }

    // ── 5. De-duplicate: latest answer per (prompt_id, engine) ──────────
    const seen = {};
    for (const row of answers) {
      if (!row.engine || !row.prompt_id) continue;
      const key = `${row.prompt_id}:${row.engine}`;
      if (!seen[key]) seen[key] = row;
    }

    // ── 6. Group by prompt → collect all engine outcomes ─────────────────
    const promptMap = {};
    for (const row of Object.values(seen)) {
      const pid = row.prompt_id;
      if (!promptMap[pid]) {
        promptMap[pid] = {
          prompt_id: pid,
          question:  promptLookup[pid] ?? "Unknown prompt",
          engines:   [],
        };
      }

      const rowMentions      = mentionsByAnswer[row.id] ?? [];
      const brandMentioned   = rowMentions.some(m => m.entity_type === "brand"       && m.mentioned);
      const compMentioned    = rowMentions.some(
        m => m.entity_type === "competitor" && m.mentioned &&
             m.entity_name.toLowerCase() === competitorName.toLowerCase()
      );

      // Only include engines where competitor was actually mentioned
      if (!compMentioned) continue;

      const outcome = brandMentioned ? "shared" : "win";

      promptMap[pid].engines.push({
        engine:  row.engine,
        outcome, // "win" = competitor beats brand | "shared" = both appear
        brand_mentioned: brandMentioned,
        comp_mentioned:  compMentioned,
      });
    }

    // ── 7. Filter to prompts where competitor appears at least once ──────
    const result = Object.values(promptMap)
      .filter(p => p.engines.length > 0)
      .map(p => {
        const wins   = p.engines.filter(e => e.outcome === "win").length;
        const shared = p.engines.filter(e => e.outcome === "shared").length;

        // Overall prompt outcome: "win" if competitor beats brand in all engines,
        // "shared" if mixed, "partial" if some engines only
        const overallOutcome =
          wins > 0 && shared === 0 ? "win" :
          shared > 0 && wins === 0 ? "shared" :
          "mixed";

        return {
          prompt_id:       p.prompt_id,
          question:        p.question,
          engines:         p.engines,
          wins,
          shared,
          overall_outcome: overallOutcome,
        };
      })
      // Sort: full competitor wins first, then shared
      .sort((a, b) => b.wins - a.wins || b.shared - a.shared);

    return apiResponse(res, 200, "Competitor prompts loaded", {
      competitor_name: competitorName,
      total_prompts:   result.length,
      prompts:         result,
    });

  } catch (err) {
    console.error("❌ getCompetitorPrompts:", err);
    return apiResponse(res, 500, "Failed to load competitor prompts");
  }
};