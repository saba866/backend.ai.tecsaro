


import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";



export const getAeoOverviewSimple = async (req, res) => {
  try {
    const { planId } = req.query;
    if (!planId) return apiResponse(res, 400, "planId required");

    // ── 1. Page count ──────────────────────────────────────────────────────
    const { count: pages } = await supabase
      .from("aeo_pages")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", planId);

    // ── 2. All AI answers — fetch prompt_id + created_at for dedup ─────────
    const { data: rawAnswers, error: answerErr } = await supabase
      .from("aeo_ai_answers")
      .select("id, engine, prompt_id, created_at")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false }); // DESC → first seen = latest

    if (answerErr) {
      console.error("❌ aeo_ai_answers:", answerErr.message);
      return apiResponse(res, 500, "Failed to load answers");
    }

    if (!rawAnswers?.length) {
      return apiResponse(res, 200, "AI Presence overview loaded", emptyStats(pages));
    }

    // ── 3. Deduplicate: latest answer per (prompt_id, engine) ──────────────
    const seenKeys = {};
    const answers  = [];
    for (const a of rawAnswers) {
      if (!a.prompt_id || !a.engine) continue;
      const key = `${a.prompt_id}:${a.engine}`;
      if (!seenKeys[key]) {
        seenKeys[key] = true;
        answers.push(a);
      }
    }

    // ── 4. Fetch brand mention results for deduped answers only ────────────
    const answerIds = answers.map(a => a.id);

    const { data: mentionRows, error: mentionErr } = await supabase
      .from("aeo_mention_results")
      .select("answer_id, mentioned, position")
      .in("answer_id", answerIds)
      .eq("entity_type", "brand");

    if (mentionErr) console.error("❌ aeo_mention_results:", mentionErr.message);

    // answer_id → { mentioned, position }
    const mentionByAnswer = {};
    for (const m of mentionRows ?? []) {
      mentionByAnswer[m.answer_id] = {
        mentioned: Boolean(m.mentioned),
        position:  m.position ?? null,
      };
    }

    // ── 5. Group deduped answers by prompt_id ──────────────────────────────
    const promptMap = {};
    for (const a of answers) {
      if (!promptMap[a.prompt_id]) promptMap[a.prompt_id] = [];
      const m = mentionByAnswer[a.id];
      promptMap[a.prompt_id].push({
        engine:    a.engine,
        mentioned: m?.mentioned ?? false,
        position:  m?.position  ?? null,
      });
    }

    // ── 6. Decide outcome per prompt ───────────────────────────────────────
    //
    // MISSED  = not mentioned in ANY engine
    // PRESENT = mentioned in at least one engine
    //
    // WIN (two-tier, handles null positions gracefully):
    //   If position data exists → WIN = position 1 in ALL engines that have position data
    //   If no position data     → WIN = mentioned in ALL engines that ran for this prompt
    //
    const promptList   = Object.values(promptMap);
    const totalPrompts = promptList.length;

    let brandMentioned = 0;
    let brandWins      = 0;
    let brandLosses    = 0;
    let noVisibility   = 0;

    for (const engines of promptList) {
      const mentionedEngines = engines.filter(e => e.mentioned);

      if (mentionedEngines.length === 0) {
        noVisibility++;
        continue;
      }

      brandMentioned++;

      const enginesWithPosition = mentionedEngines.filter(e => e.position !== null);
      const hasPositionData     = enginesWithPosition.length > 0;

      let isWin = false;
      if (hasPositionData) {
        // Win = first in every engine that has position data
        isWin = enginesWithPosition.every(e => e.position === 1);
      } else {
        // No position data — win if brand mentioned in ALL engines that ran
        isWin = mentionedEngines.length === engines.length;
      }

      if (isWin) brandWins++;
      else       brandLosses++;
    }

    // ── 7. Percentages ─────────────────────────────────────────────────────
    const pct = (n) => totalPrompts > 0 ? Math.round((n / totalPrompts) * 100) : 0;

    const visibilityRate      = pct(brandMentioned);
    const winRate             = pct(brandWins);
    const competitorDominance = pct(brandLosses);
    const noVisibilityRate    = pct(noVisibility);
    const trustScore          = Math.round(
      (visibilityRate * 0.4) + (winRate * 0.4) + ((100 - competitorDominance) * 0.2)
    );

    return apiResponse(res, 200, "AI Presence overview loaded", {
      pages:         pages ?? 0,
      totalPrompts,
      brandMentioned,
      brandWins,
      brandLosses,
      noVisibility,
      visibilityRate,
      winRate,
      competitorDominance,
      noVisibilityRate,
      trustScore,
    });

  } catch (err) {
    console.error("❌ AEO overview simple failed:", err);
    return apiResponse(res, 500, "Failed to load overview");
  }
};

function emptyStats(pages) {
  return {
    pages: pages ?? 0,
    totalPrompts: 0,
    brandMentioned: 0, brandWins: 0, brandLosses: 0, noVisibility: 0,
    visibilityRate: 0, winRate: 0, competitorDominance: 0,
    noVisibilityRate: 0, trustScore: 0,
  };
}