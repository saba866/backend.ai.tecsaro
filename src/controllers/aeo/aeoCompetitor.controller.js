





import { supabase }      from "../../config/supabase.js";
import { domainToBrandName, generateAliases } from "../../utils/domainToName.js";
import { runCompetitorDiscovery } from "../../jobs/aeoCompetitorDiscovery.job.js";
import { buildCompetitorSummary } from "../../jobs/aeoCompetitorSummary.job.js";
import { runPipelinePhase3 }      from "../../jobs/aeoPipeline.job.js";
import apiResponse                from "../../utils/apiResponse.js";

// ─────────────────────────────────────────
// TIER LIMITS
// ─────────────────────────────────────────
const COMPETITOR_LIMITS = { starter: 10, pro: 20, default: 10 };

async function getPlanTier(planId) {
  const { data: plan } = await supabase
    .from("plans")
    .select("tier, user_id")
    .eq("id", planId)
    .single();
  return {
    tier:    plan?.tier || "starter",
    userId:  plan?.user_id,
    maxComp: COMPETITOR_LIMITS[plan?.tier] || COMPETITOR_LIMITS.default,
  };
}

// ─────────────────────────────────────────
// START COMPETITOR DISCOVERY  (Phase 2)
// POST /aeo/competitors/start
// ─────────────────────────────────────────
export const startCompetitorDiscovery = async (req, res) => {
  const { planId } = req.body;
  if (!planId) return apiResponse(res, 400, "planId required");

  // fire & forget — job sets pipeline_status = "awaiting_competitor_review" when done
  setTimeout(() => {
    runCompetitorDiscovery(planId)
      .then(() => buildCompetitorSummary(planId))
      .catch(err => console.error("❌ Competitor discovery failed:", err));
  }, 0);

  return apiResponse(res, 200, "Competitor discovery started");
};

// ─────────────────────────────────────────
// GET COMPETITORS FOR PLAN
// GET /aeo/competitors/:planId
//
// Returns both approved competitors (for dashboard)
// and unapproved suggestions (for Step5 onboarding review).
//
// Suggestions query: approved=false AND status != "ignored"
// Discovery job sets: approved=false, status="active"   ← fixed (was pending_approval)
// ─────────────────────────────────────────
export const getCompetitorsByPlan = async (req, res) => {
  try {
    const planId = req.params.planId ?? req.query.planId;
    if (!planId) return res.status(400).json({ error: "planId required" });

    const { tier, maxComp } = await getPlanTier(planId);

    const [
      { data: active,      error: activeErr  },
      { data: suggestions, error: suggestErr },
      { data: mentions                       },
      { data: rawAnswers                     },
    ] = await Promise.all([
      // Tracked = approved by user
      supabase
        .from("aeo_competitors")
        .select("id, name, domain, confidence_score, approved, status, detected_reason, times_seen, source, classification")
        .eq("plan_id", planId)
        .eq("approved", true)
        .neq("status", "ignored")
        .order("confidence_score", { ascending: false }),

      // Suggestions = detected by AI, not yet approved, not ignored
      // FIX: removed .eq("status","pending_approval") — discovery job sets status="active"
      supabase
        .from("aeo_competitors")
        .select("id, name, domain, confidence_score, detected_reason, times_seen, source")
        .eq("plan_id", planId)
        .eq("approved", false)
        .neq("status", "ignored")
        .order("times_seen", { ascending: false }),

      supabase
        .from("aeo_mention_results")
        .select("answer_id, entity_name, entity_type, mentioned")
        .eq("plan_id", planId),

      // DESC so dedup keeps the latest answer per (prompt_id, engine)
      supabase
        .from("aeo_ai_answers")
        .select("id, engine, prompt_id, created_at")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false }),
    ]);

    if (activeErr)  throw activeErr;
    if (suggestErr) throw suggestErr;

    // ── Deduplicate: keep latest answer per (prompt_id, engine) ──────────
    const seenKeys = {};
    const answers  = [];
    for (const a of rawAnswers ?? []) {
      if (!a.prompt_id || !a.engine) continue;
      const key = `${a.prompt_id}:${a.engine}`;
      if (!seenKeys[key]) { seenKeys[key] = true; answers.push(a); }
    }

    const engineByAnswer  = {};
    const validAnswerIds  = new Set();
    for (const a of answers) {
      engineByAnswer[a.id] = a.engine;
      validAnswerIds.add(a.id);
    }

    const totalAnswersRun = answers.length;

    // ── Filter mentions to deduped answer IDs only ────────────────────────
    const byAnswer = {};
    for (const m of mentions ?? []) {
      if (!validAnswerIds.has(m.answer_id)) continue;
      if (!byAnswer[m.answer_id]) byAnswer[m.answer_id] = [];
      byAnswer[m.answer_id].push(m);
    }

    // ── Per-competitor stats ──────────────────────────────────────────────
    const trackedCompNames = new Set((active ?? []).map(c => c.name || c.domain));
    const initSlot = () => ({ wins: 0, losses: 0, shared: 0, neither: 0, total: 0 });
    const compStats = {};
    for (const name of trackedCompNames) compStats[name] = { ...initSlot(), engines: {} };

    for (const [answerId, answerMentions] of Object.entries(byAnswer)) {
      const engine         = engineByAnswer[answerId] ?? "unknown";
      const brandMentioned = answerMentions.some(m => m.entity_type === "brand"      && m.mentioned === true);
      const mentionedComps = new Set(
        answerMentions.filter(m => m.entity_type === "competitor" && m.mentioned === true).map(m => m.entity_name)
      );
      for (const name of trackedCompNames) {
        if (!compStats[name].engines[engine]) compStats[name].engines[engine] = initSlot();
        compStats[name].total++;
        compStats[name].engines[engine].total++;
        const compMentioned = mentionedComps.has(name);
        if      ( brandMentioned && !compMentioned) { compStats[name].wins++;    compStats[name].engines[engine].wins++;    }
        else if (!brandMentioned &&  compMentioned) { compStats[name].losses++;  compStats[name].engines[engine].losses++;  }
        else if ( brandMentioned &&  compMentioned) { compStats[name].shared++;  compStats[name].engines[engine].shared++;  }
        else                                        { compStats[name].neither++; compStats[name].engines[engine].neither++; }
      }
    }

    const shapeSlot = (s) => {
      const t = s.total || 1;
      return {
        wins: s.wins, losses: s.losses, shared: s.shared, neither: s.neither, total: s.total,
        win_rate:     Math.round((s.wins    / t) * 100),
        loss_rate:    Math.round((s.losses  / t) * 100),
        shared_rate:  Math.round((s.shared  / t) * 100),
        neither_rate: Math.round((s.neither / t) * 100),
      };
    };

    const ENGINE_ORDER = ["chatgpt", "gemini", "perplexity"];
    const enrich = (c) => {
      const name  = c.name || c.domain;
      const stats = compStats[name] ?? { ...initSlot(), engines: {} };
      const sortedEngines = [
        ...ENGINE_ORDER.filter(e => e in stats.engines),
        ...Object.keys(stats.engines).filter(e => !ENGINE_ORDER.includes(e)),
      ];
      return {
        ...c,
        name,
        ...shapeSlot(stats),
        total_answers:        stats.total,
        actual_mention_count: stats.wins + stats.losses + stats.shared,
        engine_breakdown:     sortedEngines.map(engine => ({ engine, ...shapeSlot(stats.engines[engine]) })),
      };
    };

    // ── Brand-level summary ───────────────────────────────────────────────
    let totalWins = 0, totalLosses = 0, totalShared = 0, totalNeither = 0;
    const engineSummary = {};
    for (const [answerId, answerMentions] of Object.entries(byAnswer)) {
      const engine           = engineByAnswer[answerId] ?? "unknown";
      const brandMentioned   = answerMentions.some(m => m.entity_type === "brand"      && m.mentioned);
      const anyCompMentioned = answerMentions.some(m => m.entity_type === "competitor" && m.mentioned);
      if (!engineSummary[engine]) engineSummary[engine] = initSlot();
      engineSummary[engine].total++;
      if      ( brandMentioned && !anyCompMentioned) { totalWins++;    engineSummary[engine].wins++;    }
      else if (!brandMentioned &&  anyCompMentioned) { totalLosses++;  engineSummary[engine].losses++;  }
      else if ( brandMentioned &&  anyCompMentioned) { totalShared++;  engineSummary[engine].shared++;  }
      else                                           { totalNeither++; engineSummary[engine].neither++; }
    }

    res.json({
      competitors:      (active      ?? []).map(enrich),
      suggestions:      (suggestions ?? []).map(enrich),
      competitors_used: active?.length  || 0,
      competitors_max:  maxComp,
      remaining:        maxComp - (active?.length || 0),
      tier,
      summary: {
        wins: totalWins, losses: totalLosses, shared: totalShared, neither: totalNeither,
        total:             Object.keys(byAnswer).length,
        total_answers_run: totalAnswersRun,
        by_engine:         engineSummary,
      },
    });
  } catch (err) {
    console.error("Get competitors error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// APPROVE  (PUT /aeo/competitors/:id/approve)
// Used by: Step5 onboarding + dashboard "Add" button
// ─────────────────────────────────────────
export const approveCompetitor = async (req, res) => {
  try {
    const { id }     = req.params;
    const { planId } = req.body;
    if (!id || !planId) return res.status(400).json({ error: "id and planId required" });

    const { error } = await supabase
      .from("aeo_competitors")
      .update({ approved: true, status: "active" })
      .eq("id", id)
      .eq("plan_id", planId);

    if (error) return res.status(500).json({ error: "Failed to approve competitor" });

    res.json({ success: true, message: "Competitor approved" });
  } catch (err) {
    console.error("Approve competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Alias — keeps old code that calls acceptSuggestedCompetitor working
export const acceptSuggestedCompetitor = approveCompetitor;

// ─────────────────────────────────────────
// IGNORE  (PUT /aeo/competitors/:id/ignore)
// Used by: Step5 onboarding + dashboard "Skip" button
// ─────────────────────────────────────────
export const ignoreSuggestedCompetitor = async (req, res) => {
  try {
    const { id }     = req.params;
    const { planId } = req.body;
    if (!id || !planId) return res.status(400).json({ error: "id and planId required" });

    const { error } = await supabase
      .from("aeo_competitors")
      .update({ approved: false, status: "ignored", ignored_at: new Date().toISOString() })
      .eq("id", id)
      .eq("plan_id", planId);

    if (error) return res.status(500).json({ error: "Failed to ignore competitor" });

    res.json({ success: true, message: "Competitor ignored" });
  } catch (err) {
    console.error("Ignore competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// CONFIRM REVIEW  (POST /aeo/competitors/confirm-review)
// Step5 calls this after approving/ignoring all suggestions.
// FIX: was reading from aeo_pipeline_status (table doesn't exist).
//      Now updates plans.pipeline_status directly.
// ─────────────────────────────────────────
export const confirmCompetitorReview = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: "planId required" });

    // Check current status so we don't accidentally reset a further-along pipeline
    const { data: plan } = await supabase
      .from("plans")
      .select("pipeline_status")
      .eq("id", planId)
      .single();

    const currentStatus = plan?.pipeline_status ?? "";

    // Only advance if we're actually waiting for review (or idle/unknown)
    const canAdvance = [
      "awaiting_competitor_review",
      "idle",
      "",
    ].includes(currentStatus);

    if (!canAdvance) {
      console.log(`[confirm-review] skipped — pipeline already at: ${currentStatus}`);
      return res.json({ success: true, message: "Pipeline already progressed", status: currentStatus });
    }

    // Set pipeline_status = "phase3_pending" so Phase 3 runner picks it up
    const { error: updateErr } = await supabase
      .from("plans")
      .update({ pipeline_status: "phase3_pending" })
      .eq("id", planId);

    if (updateErr) {
      console.error("❌ confirm-review update failed:", updateErr.message);
      return res.status(500).json({ error: "Failed to advance pipeline" });
    }

    console.log(`✅ [confirm-review] planId=${planId} → phase3_pending`);

    // Kick off Phase 3 asynchronously
    setImmediate(() => runPipelinePhase3(planId).catch(err =>
      console.error("❌ Phase 3 failed:", err.message)
    ));

    res.json({ success: true, message: "Phase 3 started" });
  } catch (err) {
    console.error("confirmCompetitorReview error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// ADD COMPETITOR MANUALLY
// POST /aeo/competitors/add
// ─────────────────────────────────────────
export const addCompetitor = async (req, res) => {
  try {
    const { planId, domain } = req.body;
    if (!planId || !domain) return res.status(400).json({ error: "planId and domain required" });

    const { tier, maxComp } = await getPlanTier(planId);
    const { count: existing } = await supabase
      .from("aeo_competitors")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", planId)
      .eq("approved", true)
      .neq("status", "ignored");

    if ((existing || 0) >= maxComp) {
      return res.status(403).json({
        error:           `You've reached your limit of ${maxComp} competitors on the ${tier} plan.`,
        limit_reached:   true,
        current_count:   existing,
        max_competitors: maxComp,
        upgrade_message: tier === "starter" ? "Upgrade to Pro to track up to 20 competitors." : "Contact us for enterprise plans.",
      });
    }

    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const name        = domainToBrandName(cleanDomain);
    const aliases     = generateAliases(name, cleanDomain);

    const { data: dup } = await supabase
      .from("aeo_competitors").select("id, status")
      .eq("plan_id", planId).eq("domain", cleanDomain).maybeSingle();

    if (dup) {
      if (dup.status === "ignored") {
        await supabase.from("aeo_competitors").update({ approved: true, status: "active" }).eq("id", dup.id);
        return res.json({ success: true, reactivated: true });
      }
      return res.status(400).json({ error: "Competitor already exists" });
    }

    const { data, error } = await supabase
      .from("aeo_competitors")
      .insert({ plan_id: planId, domain: cleanDomain, name, aliases, source: "user", classification: "direct", confidence_score: 1, approved: true, status: "active", detected_reason: "Manually added by user" })
      .select().single();

    if (error) throw error;

    res.json({ success: true, competitor: data, competitors_used: (existing || 0) + 1, competitors_max: maxComp, remaining: maxComp - (existing || 0) - 1 });
  } catch (err) {
    console.error("Add competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// ADD SEED COMPETITORS (onboarding Step 4)
// POST /aeo/seed
// ─────────────────────────────────────────
export const addSeedCompetitors = async (req, res) => {
  try {
    const { planId, domains } = req.body;
    if (!planId || !Array.isArray(domains) || domains.length < 1)
      return res.status(400).json({ error: "At least 1 competitor required" });

    const { tier, maxComp } = await getPlanTier(planId);
    const { count: existing } = await supabase
      .from("aeo_competitors").select("*", { count: "exact", head: true })
      .eq("plan_id", planId).eq("approved", true);

    const available = maxComp - (existing || 0);
    if (available <= 0)
      return res.status(403).json({ error: `You've reached your limit of ${maxComp} competitors.`, limit_reached: true });

    const toAdd   = domains.slice(0, available);
    const inserts = toAdd.map((domain) => {
      const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      const name        = domainToBrandName(cleanDomain);
      const aliases     = generateAliases(name, cleanDomain);
      return { plan_id: planId, domain: cleanDomain, name, aliases, source: "user", classification: "direct", confidence_score: 1, approved: true, status: "active", detected_reason: "User-provided seed competitor" };
    });

    const { error } = await supabase.from("aeo_competitors").upsert(inserts, { onConflict: "plan_id,domain" });
    if (error) throw error;

    res.json({ success: true, added: inserts.length, competitors_used: (existing || 0) + inserts.length, competitors_max: maxComp, remaining: maxComp - (existing || 0) - inserts.length });
  } catch (err) {
    console.error("Seed competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// REMOVE COMPETITOR
// DELETE /aeo/competitors/:id
// ─────────────────────────────────────────
export const removeCompetitor = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: comp, error: fetchErr } = await supabase
      .from("aeo_competitors").select("id, domain, plan_id").eq("id", id).single();

    if (fetchErr || !comp) return res.status(404).json({ error: "Competitor not found" });

    const { error } = await supabase.from("aeo_competitors").delete().eq("id", id);
    if (error) throw error;

    const { maxComp }    = await getPlanTier(comp.plan_id);
    const { count: rem } = await supabase
      .from("aeo_competitors").select("*", { count: "exact", head: true })
      .eq("plan_id", comp.plan_id).eq("approved", true).neq("status", "ignored");

    res.json({ success: true, removed: comp.domain, competitors_used: rem || 0, competitors_max: maxComp, slots_freed: 1 });
  } catch (err) {
    console.error("Remove competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// SAVE AI-DISCOVERED COMPETITOR (internal, called from visibility job)
// ─────────────────────────────────────────
export async function saveDiscoveredCompetitor(planId, domain, reason) {
  try {
    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const { data: existing } = await supabase
      .from("aeo_competitors").select("id, status, times_seen")
      .eq("plan_id", planId).eq("domain", cleanDomain).maybeSingle();

    if (existing?.status === "ignored" || existing?.status === "active") return;

    const name    = domainToBrandName(cleanDomain);
    const aliases = generateAliases(name, cleanDomain);

    if (existing) {
      await supabase.from("aeo_competitors").update({ times_seen: (existing.times_seen || 0) + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("aeo_competitors").insert({
        plan_id: planId, domain: cleanDomain, name, aliases,
        source: "ai_discovered", classification: "direct",
        confidence_score: 0.5, approved: false, status: "active",
        times_seen: 1, detected_reason: reason || "Found in AI answers",
      });
    }
  } catch (err) {
    console.error("Save discovered competitor error:", err);
  }
}