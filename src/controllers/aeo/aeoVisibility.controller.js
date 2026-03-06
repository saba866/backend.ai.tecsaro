

//for stater plan its working
import { supabase }       from "../../config/supabase.js";
import { runVisibilityJob } from "../../jobs/aeoVisibility.job.js";
import apiResponse          from "../../utils/apiResponse.js";

export const startAeoVisibility = async (req, res) => {
  try {
    const planId = req.query.planId || req.body.planId;
    if (!planId) return apiResponse(res, 400, "planId required");
    await runVisibilityJob(planId);
    return apiResponse(res, 200, "Visibility tracking completed");
  } catch (err) {
    console.error("❌ Visibility error:", err.message);
    return apiResponse(res, 500, "Visibility tracking failed");
  }
};

export const getVisibilityData = async (req, res) => {
  try {
    const planId = req.query.planId;
    if (!planId) return apiResponse(res, 400, "planId required");

    // ── 1. Load plan ───────────────────────────────────────────────────────
    const { data: plan } = await supabase
      .from("plans")
      .select("name, website_url")
      .eq("id", planId)
      .single();

    // ── 2. Fetch AI answers ────────────────────────────────────────────────
    // aeoVisibility.job.js inserts: { plan_id, prompt_id, engine, answer_text }
    // "engine" column = "chatgpt" | "gemini" | "perplexity"
    // "ai_engine" column is NEVER written by the job — always NULL, do not use it
    const { data: rawAnswers, error: answerErr } = await supabase
      .from("aeo_ai_answers")
      .select("id, engine, prompt_id, created_at")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false });

    if (answerErr) {
      console.error("❌ aeo_ai_answers:", answerErr.message);
      return res.status(500).json({ success: false, message: answerErr.message, data: null });
    }

    if (!rawAnswers?.length) {
      return res.json({
        success: true,
        data: {
          plan:        { name: plan?.name ?? "", domain: (plan?.website_url ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "") },
          prompts:     [],
          engineStats: {},
          totals:      { win: 0, shared: 0, missed: 0 },
        },
      });
    }

    console.log("[Visibility] answers:", rawAnswers.length, "| engines:", [...new Set(rawAnswers.map(a => a.engine))]);

    // ── 3. Fetch prompt texts ──────────────────────────────────────────────
    const promptIds = [...new Set(rawAnswers.map(a => a.prompt_id).filter(Boolean))];
    const { data: promptRows } = await supabase
      .from("aeo_prompts")
      .select("id, prompt, intent")
      .in("id", promptIds);

    const promptLookup = {};
    for (const p of promptRows ?? []) promptLookup[p.id] = p;

    // ── 4. Fetch brand mention results ─────────────────────────────────────
    // aeoVisibility.job.js inserts: { plan_id, answer_id, entity_name, entity_type, mentioned }
    // entity_type = "brand" for the target brand row
    // entity_type = "competitor" for competitor rows
    const answerIds = rawAnswers.map(a => a.id);

    const { data: brandMentions, error: mentionErr } = await supabase
      .from("aeo_mention_results")
      .select("answer_id, mentioned")
      .in("answer_id", answerIds)
      .eq("entity_type", "brand");

    if (mentionErr) console.error("❌ aeo_mention_results:", mentionErr.message);

    console.log("[Visibility] brand mention rows:", brandMentions?.length ?? 0);

    // answer_id → true/false
    const brandByAnswer = {};
    for (const m of brandMentions ?? []) {
      brandByAnswer[m.answer_id] = Boolean(m.mentioned);
    }

    // ── 5. De-duplicate: keep latest answer per (prompt_id, engine) ────────
    const seen = {};
    for (const row of rawAnswers) {
      if (!row.engine) continue;
      const key = `${row.prompt_id}:${row.engine}`;
      if (!seen[key]) seen[key] = row; // already DESC → first = latest
    }

    // ── 6. Build prompt rows ───────────────────────────────────────────────
    const promptMap = {};
    for (const row of Object.values(seen)) {
      const pid = row.prompt_id;
      if (!promptMap[pid]) {
        promptMap[pid] = {
          id:       pid,
          question: promptLookup[pid]?.prompt ?? "Unknown",
          intent:   promptLookup[pid]?.intent ?? "informational",
          engines:  {},
        };
      }
      promptMap[pid].engines[row.engine] = {
        mentioned: brandByAnswer[row.id] ?? false,
        position:  null,
      };
    }

    // ── 7. Win / shared / missed ───────────────────────────────────────────
    const prompts = Object.values(promptMap).map((p) => {
      const vals      = Object.values(p.engines);
      const mentioned = vals.filter(e => e.mentioned).length;
      const total     = vals.length;
      const status    = mentioned === total && total > 0 ? "win"
                      : mentioned > 0                   ? "shared"
                      : "missed";
      return { ...p, status };
    });

    // ── 8. Engine stats ────────────────────────────────────────────────────
    const engineStats = {};
    for (const row of Object.values(seen)) {
      if (!row.engine) continue;
      if (!engineStats[row.engine]) engineStats[row.engine] = { total: 0, mentioned: 0 };
      engineStats[row.engine].total++;
      if (brandByAnswer[row.id]) engineStats[row.engine].mentioned++;
    }

    const totals = {
      win:    prompts.filter(p => p.status === "win").length,
      shared: prompts.filter(p => p.status === "shared").length,
      missed: prompts.filter(p => p.status === "missed").length,
    };

    return res.json({
      success: true,
      data: {
        plan:        { name: plan?.name ?? "", domain: (plan?.website_url ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "") },
        prompts,
        engineStats,
        totals,
      },
    });

  } catch (err) {
    console.error("❌ getVisibilityData:", err.message);
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};