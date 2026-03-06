


// /**
//  * AEO Pipeline — 3 phases, 2 user pause points
//  *
//  * PHASE 1: Understand → Prompt Discovery
//  *          ⏸️  plan.pipeline_status = "awaiting_prompt_review"   ← Step3 polls this
//  *
//  * PHASE 2: Mapping → Brand Profile → Competitor Discovery
//  *          ⏸️  plan.pipeline_status = "awaiting_competitor_review" ← Step5 polls this
//  *
//  * PHASE 3: Answers → Visibility → Presence → Gaps → Recommendations → Schema → Score
//  *          ✅  plan.pipeline_status = "completed"
//  */

// import { supabase } from "../config/supabase.js";

// import { runUnderstandingJob }      from "./aeoUnderstand.job.js";
// import { runAnswerJob }             from "./aeoAnswer.job.js";
// import { runAeoGapJob }             from "./aeoGap.job.js";
// import { runAeoScoreJob }           from "./aeoScore.job.js";
// import { runAeoScoreExplainJob }    from "./aeoScoreExplain.job.js";
// import { ensureBrandProfile }       from "./aeoBrandProfile.job.js";
// import { startPromptDiscovery }     from "../services/aeo/aeoPrompt.service.js";
// import { startVisibilityJob }       from "../services/aeo/aeoVisibility.service.js";
// import { startSchemaJob }           from "../services/aeo/aeoSchema.service.js";
// import { runSimpleMappingJob }      from "./aeoMappingSimple.job.js";
// import { runRecommendationJob }     from "./aeoRecommendation.job.js";
// import { calculatePresenceMetrics } from "../services/aeo/aeoPresence.service.js";

// // ─────────────────────────────────────────────────────────────────
// // HELPER — update both aeo_pipeline_status AND plans.pipeline_status
// // Step3 frontend polls GET /plans/:planId → reads plan.pipeline_status
// // so both tables must stay in sync.
// // ─────────────────────────────────────────────────────────────────

// async function setStatus(planId, pipelineFields, planStatus = null) {
//   await supabase
//     .from("aeo_pipeline_status")
//     .update({ ...pipelineFields, updated_at: new Date().toISOString() })
//     .eq("plan_id", planId);

//   if (planStatus) {
//     await supabase
//       .from("plans")
//       .update({ pipeline_status: planStatus })
//       .eq("id", planId);
//   }
// }

// // ─────────────────────────────────────────────────────────────────
// // PHASE 1 — called by aeoCrawl.job.js right after crawl completes
// // Understand → Prompt Discovery → ⏸️
// // ─────────────────────────────────────────────────────────────────

// export async function runPipelinePhase1(planId) {
//   if (typeof planId !== "string") throw new Error("runPipelinePhase1: expected UUID string");
//   console.log("🔥 Pipeline Phase 1 started:", planId);

//   await setStatus(planId, { pipeline_phase: "phase1_running" }, "analyzing");

//   /* UNDERSTAND */
//   await setStatus(planId, { understand_status: "running" }, "analyzing");
//   await runUnderstandingJob(planId);
//   await setStatus(planId, { understand_status: "completed" });

//   /* PROMPT DISCOVERY */
//   await setStatus(planId, { prompt_status: "running" }, "generating_prompts");
//   await startPromptDiscovery(planId);
//   await setStatus(planId, { prompt_status: "completed" });

//   /* ⏸️ PAUSE — Step3 sees "awaiting_prompt_review" → shows "Review Generated Prompts →" CTA */
//   await setStatus(
//     planId,
//     { pipeline_phase: "awaiting_prompt_review" },
//     "awaiting_prompt_review"
//   );

//   console.log("⏸️  Phase 1 done. Waiting for prompt selection:", planId);
// }

// // ─────────────────────────────────────────────────────────────────
// // PHASE 2 — triggered from approveSelectedPrompts controller
// // after user confirms prompts in Step 4
// // Mapping → Brand Profile → Competitor Discovery → ⏸️
// // ─────────────────────────────────────────────────────────────────

// export async function runPipelinePhase2(planId) {
//   if (typeof planId !== "string") throw new Error("runPipelinePhase2: expected UUID string");
//   console.log("🔥 Pipeline Phase 2 started:", planId);

//   await setStatus(planId, { pipeline_phase: "phase2_running" }, "running");

//   /* MAPPING */
//   await setStatus(planId, { mapping_status: "running" });
//   await runSimpleMappingJob(planId);
//   await setStatus(planId, { mapping_status: "completed" });

//   /* BRAND PROFILE */
//   await ensureBrandProfile(planId);

//   /* COMPETITOR DISCOVERY — uses your existing service */
//   await setStatus(planId, { competitor_status: "running" });
//   await safeCompetitorDiscovery(planId);
//   await setStatus(planId, { competitor_status: "suggested" });

//   /* ⏸️ PAUSE — Step5 polls plan.pipeline_status = "awaiting_competitor_review" */
//   await setStatus(
//     planId,
//     { pipeline_phase: "awaiting_competitor_review" },
//     "awaiting_competitor_review"
//   );

//   console.log("⏸️  Phase 2 done. Waiting for competitor review:", planId);
// }

// // ─────────────────────────────────────────────────────────────────
// // PHASE 3 — triggered from acceptSuggestedCompetitor / ignoreSuggestedCompetitor
// // controller after all competitors are reviewed in Step 5
// // Answers → Visibility → Presence → Gaps → Recs → Schema → Score → ✅
// // ─────────────────────────────────────────────────────────────────

// export async function runPipelinePhase3(planId) {
//   if (typeof planId !== "string") throw new Error("runPipelinePhase3: expected UUID string");
//   console.log("🔥 Pipeline Phase 3 started:", planId);

//   await setStatus(planId, { pipeline_phase: "phase3_running" }, "running");

//   /* ANSWERS */
//   await setStatus(planId, { answer_status: "running" });
//   await runAnswerJob(planId);
//   await setStatus(planId, { answer_status: "completed" });

//   /* VISIBILITY */
//   await setStatus(planId, { visibility_status: "running" });
//   await startVisibilityJob(planId);
//   await setStatus(planId, { visibility_status: "completed" });

//   /* PRESENCE */
//   const { data: mentions } = await supabase
//     .from("aeo_mention_results")
//     .select("answer_id, entity_name, entity_type, mentioned")
//     .eq("plan_id", planId);

//   const presenceMetrics = calculatePresenceMetrics(mentions || []);
//   console.log("📊 Presence metrics:", presenceMetrics);
//   await setStatus(planId, { presence_status: "completed" });

//   /* GAPS */
//   await runAeoGapJob(planId);

//   /* RECOMMENDATIONS */
//   await runRecommendationJob(planId);

//   /* SCHEMA */
//   await startSchemaJob(planId);

//   /* AEO SCORE */
//   await runAeoScoreJob(planId);
//   await runAeoScoreExplainJob(planId);

//   /* ✅ DONE */
//   await setStatus(
//     planId,
//     { pipeline_phase: "completed", overall_status: "completed" },
//     "completed"
//   );

//   console.log("✅ Pipeline fully completed:", planId);
// }

// // ─────────────────────────────────────────────────────────────────
// // SAFE COMPETITOR DISCOVERY
// // Wraps your existing competitor discovery. Non-fatal if it fails.
// // Adjust the import path to match your actual service file.
// // ─────────────────────────────────────────────────────────────────

// async function safeCompetitorDiscovery(planId) {
//   try {
//     // Your existing startCompetitorDiscovery is a controller (needs req/res).
//     // Call the underlying service function directly instead.
//     // Common patterns — uncomment whichever matches your codebase:

//     // Option A — if you have a standalone service function:
//     // const { discoverCompetitors } = await import("../services/aeo/aeoCompetitor.service.js");
//     // await discoverCompetitors(planId);

//     // Option B — if the logic is inside the controller, extract it to a shared helper.
//     // For now we call the simple discovery job directly via Supabase trigger approach:
//     const { data: plan } = await supabase
//       .from("plans")
//       .select("website_url, name")
//       .eq("id", planId)
//       .maybeSingle();

//     if (!plan) return;

//     console.log("🔍 Running competitor discovery for:", plan.name);

//     // Trigger your existing competitor discovery by inserting a job record
//     // or calling the service. Replace this block with your actual call:
//     const { runCompetitorJob } = await import("../jobs/aeoCompetitorsSimple.job.js").catch(() => ({ runCompetitorJob: null }));
//     if (runCompetitorJob) {
//       await runCompetitorJob(planId);
//     } else {
//       console.warn("⚠️  No competitor job found — skipping. Add competitors manually from dashboard.");
//     }
//   } catch (err) {
//     // Non-fatal — user can add competitors manually from dashboard
//     console.error("⚠️  Competitor discovery failed (non-fatal):", err.message);
//   }
// }




/**
 * AEO Pipeline — 3 phases, 2 user pause points
 *
 * PHASE 1: Understand → Prompt Discovery → ⏸️
 * PHASE 2: Mapping → Brand Profile → Competitor Discovery → ⏸️
 * PHASE 3: Answers ║ Visibility → Presence → Gaps ║ Recs → Schema ║ Score → ✅
 *
 * Phase 3 optimized for speed:
 *   - Answer + Visibility run in PARALLEL
 *   - Gap job starts right after visibility
 *   - Recommendations + Schema run in PARALLEL
 *   - Score + ScoreExplain run sequentially (explain needs score)
 */

// import { supabase } from "../config/supabase.js";

// import { runUnderstandingJob }      from "./aeoUnderstand.job.js";
// import { runAnswerJob }             from "./aeoAnswer.job.js";
// import { runAeoGapJob }             from "./aeoGap.job.js";
// import { runAeoScoreJob }           from "./aeoScore.job.js";
// import { runAeoScoreExplainJob }    from "./aeoScoreExplain.job.js";
// import { ensureBrandProfile }       from "./aeoBrandProfile.job.js";
// import { startPromptDiscovery }     from "../services/aeo/aeoPrompt.service.js";
// import { startVisibilityJob }       from "../services/aeo/aeoVisibility.service.js";
// import { startSchemaJob }           from "../services/aeo/aeoSchema.service.js";
// import { runSimpleMappingJob }      from "./aeoMappingSimple.job.js";
// import { runRecommendationJob }     from "./aeoRecommendation.job.js";
// import { calculatePresenceMetrics } from "../services/aeo/aeoPresence.service.js";

// // ─────────────────────────────────────────
// // HELPER
// // ─────────────────────────────────────────
// async function setStatus(planId, pipelineFields, planStatus = null) {
//   await supabase
//     .from("aeo_pipeline_status")
//     .update({ ...pipelineFields, updated_at: new Date().toISOString() })
//     .eq("plan_id", planId);

//   if (planStatus) {
//     await supabase
//       .from("plans")
//       .update({ pipeline_status: planStatus })
//       .eq("id", planId);
//   }
// }

// // ─────────────────────────────────────────
// // PHASE 1
// // ─────────────────────────────────────────
// export async function runPipelinePhase1(planId) {
//   if (typeof planId !== "string") throw new Error("runPipelinePhase1: expected UUID string");
//   console.log("🔥 Pipeline Phase 1 started:", planId);

//   await setStatus(planId, { pipeline_phase: "phase1_running" }, "analyzing");

//   await setStatus(planId, { understand_status: "running" }, "analyzing");
//   await runUnderstandingJob(planId);
//   await setStatus(planId, { understand_status: "completed" });

//   await setStatus(planId, { prompt_status: "running" }, "generating_prompts");
//   await startPromptDiscovery(planId);
//   await setStatus(planId, { prompt_status: "completed" });

//   await setStatus(planId, { pipeline_phase: "awaiting_prompt_review" }, "awaiting_prompt_review");
//   console.log("⏸️  Phase 1 done. Waiting for prompt selection:", planId);
// }

// // ─────────────────────────────────────────
// // PHASE 2
// // ─────────────────────────────────────────
// export async function runPipelinePhase2(planId) {
//   if (typeof planId !== "string") throw new Error("runPipelinePhase2: expected UUID string");
//   console.log("🔥 Pipeline Phase 2 started:", planId);

//   await setStatus(planId, { pipeline_phase: "phase2_running" }, "running");

//   await setStatus(planId, { mapping_status: "running" });
//   await runSimpleMappingJob(planId);
//   await setStatus(planId, { mapping_status: "completed" });

//   await ensureBrandProfile(planId);

//   await setStatus(planId, { competitor_status: "running" });
//   await safeCompetitorDiscovery(planId);
//   await setStatus(planId, { competitor_status: "suggested" });

//   await setStatus(planId, { pipeline_phase: "awaiting_competitor_review" }, "awaiting_competitor_review");
//   console.log("⏸️  Phase 2 done. Waiting for competitor review:", planId);
// }

// // ─────────────────────────────────────────
// // PHASE 3 — OPTIMIZED
// //
// // Old order (sequential):
// //   Answers → Visibility → Gaps → Recs → Schema → Score  (~40 min)
// //
// // New order (parallel where possible):
// //   ┌─ Answers ──────────────────────┐
// //   │                                ├─ done → Presence → Gaps ─┐
// //   └─ Visibility ───────────────────┘                          ├─ ┌─ Recs   ─┐
// //                                                                │  └─ Schema ─┘ → Score → Explain
// // ─────────────────────────────────────────
// export async function runPipelinePhase3(planId) {
//   if (typeof planId !== "string") throw new Error("runPipelinePhase3: expected UUID string");
//   console.log("🔥 Pipeline Phase 3 started:", planId);

//   await setStatus(planId, { pipeline_phase: "phase3_running" }, "running");

//   // ── STAGE 1: Answers + Visibility in PARALLEL ──────────────────
//   // These are independent — answers build AEO content,
//   // visibility tracks brand presence in real AI responses.
//   console.log("\n⚡ Stage 1: Answers + Visibility running in parallel...");

//   await setStatus(planId, { answer_status: "running", visibility_status: "running" });

//   const [answerResult, visibilityResult] = await Promise.allSettled([
//     runAnswerJob(planId),
//     startVisibilityJob(planId),
//   ]);

//   if (answerResult.status     === "rejected") console.error("❌ Answer job failed:",     answerResult.reason?.message);
//   if (visibilityResult.status === "rejected") console.error("❌ Visibility job failed:", visibilityResult.reason?.message);

//   await setStatus(planId, { answer_status: "completed", visibility_status: "completed" });

//   // ── STAGE 2: Presence metrics (fast — just DB reads) ───────────
//   console.log("\n⚡ Stage 2: Calculating presence metrics...");

//   const { data: mentions } = await supabase
//     .from("aeo_mention_results")
//     .select("answer_id, entity_name, entity_type, mentioned")
//     .eq("plan_id", planId);

//   const presenceMetrics = calculatePresenceMetrics(mentions || []);
//   console.log("📊 Presence metrics:", presenceMetrics);
//   await setStatus(planId, { presence_status: "completed" });

//   // ── STAGE 3: Gap job (needs visibility data) ───────────────────
//   console.log("\n⚡ Stage 3: Running gap analysis...");
//   await runAeoGapJob(planId);

//   // ── STAGE 4: Recommendations + Schema in PARALLEL ──────────────
//   // Recs need gaps (done). Schema is independent of gaps.
//   // Running both together saves ~1-2 min.
//   console.log("\n⚡ Stage 4: Recommendations + Schema running in parallel...");

//   const [recResult, schemaResult] = await Promise.allSettled([
//     runRecommendationJob(planId),
//     startSchemaJob(planId),
//   ]);

//   if (recResult.status    === "rejected") console.error("❌ Recommendation job failed:", recResult.reason?.message);
//   if (schemaResult.status === "rejected") console.error("❌ Schema job failed:",         schemaResult.reason?.message);

//   // ── STAGE 5: Score → Explain (sequential — explain needs score) ─
//   console.log("\n⚡ Stage 5: Scoring + explanation...");
//   await runAeoScoreJob(planId);
//   await runAeoScoreExplainJob(planId);

//   // ── DONE ────────────────────────────────────────────────────────
//   await setStatus(
//     planId,
//     { pipeline_phase: "completed", overall_status: "completed" },
//     "completed"
//   );

//   console.log("✅ Pipeline fully completed:", planId);
// }

// // ─────────────────────────────────────────
// // SAFE COMPETITOR DISCOVERY
// // ─────────────────────────────────────────
// async function safeCompetitorDiscovery(planId) {
//   try {
//     const { data: plan } = await supabase
//       .from("plans")
//       .select("website_url, name")
//       .eq("id", planId)
//       .maybeSingle();

//     if (!plan) return;
//     console.log("🔍 Running competitor discovery for:", plan.name);

//     const { runCompetitorJob } = await import("../jobs/aeoCompetitorsSimple.job.js")
//       .catch(() => ({ runCompetitorJob: null }));

//     if (runCompetitorJob) await runCompetitorJob(planId);
//     else console.warn("⚠️  No competitor job found — skipping.");
//   } catch (err) {
//     console.error("⚠️  Competitor discovery failed (non-fatal):", err.message);
//   }
// }







/**
 * AEO Pipeline — 3 phases, 2 user pause points
 *
 * PHASE 1: Understand → Prompt Discovery → ⏸️
 * PHASE 2: Mapping → Brand Profile → Competitor Discovery → ⏸️
 * PHASE 3: Answers ║ Visibility → Presence → Gaps ║ Recs → Schema ║ Score → ✅
 *
 * Phase 3 optimized for speed:
 *   - Answer + Visibility run in PARALLEL
 *   - Gap job starts right after visibility
 *   - Recommendations + Schema run in PARALLEL
 *   - Score + ScoreExplain run sequentially (explain needs score)
 */

// import { supabase } from "../config/supabase.js";

// import { runUnderstandingJob }      from "./aeoUnderstand.job.js";
// import { runAnswerJob }             from "./aeoAnswer.job.js";
// import { runAeoGapJob }             from "./aeoGap.job.js";
// import { runAeoScoreJob }           from "./aeoScore.job.js";
// import { runAeoScoreExplainJob }    from "./aeoScoreExplain.job.js";
// import { ensureBrandProfile }       from "./aeoBrandProfile.job.js";
// import { startPromptDiscovery }     from "../services/aeo/aeoPrompt.service.js";
// import { startVisibilityJob }       from "../services/aeo/aeoVisibility.service.js";
// import { startSchemaJob }           from "../services/aeo/aeoSchema.service.js";
// import { runSimpleMappingJob }      from "./aeoMappingSimple.job.js";
// import { runRecommendationJob }     from "./aeoRecommendation.job.js";
// import { calculatePresenceMetrics } from "../services/aeo/aeoPresence.service.js";

// // ─────────────────────────────────────────
// // HELPER — update aeo_pipeline_status + optional plans.pipeline_status
// // ─────────────────────────────────────────
// async function setStatus(planId, pipelineFields, planStatus = null) {
//   await supabase
//     .from("aeo_pipeline_status")
//     .update({ ...pipelineFields, updated_at: new Date().toISOString() })
//     .eq("plan_id", planId);

//   if (planStatus) {
//     await supabase
//       .from("plans")
//       .update({ pipeline_status: planStatus })
//       .eq("id", planId);
//   }
// }

// // ─────────────────────────────────────────
// // HELPER — increment a numeric column safely
// // Fetches current value then updates to avoid race conditions
// // ─────────────────────────────────────────
// async function incrementPlanCounters(planId, fields) {
//   // fields = { visibility_runs_this_month: 1, prompts_used_this_month: 20 }
//   const columnNames = Object.keys(fields).join(", ");

//   const { data: plan, error } = await supabase
//     .from("plans")
//     .select(columnNames)
//     .eq("id", planId)
//     .single();

//   if (error || !plan) {
//     console.error("[incrementPlanCounters] Failed to fetch plan:", error?.message);
//     return;
//   }

//   const updates = {};
//   for (const [col, incrementBy] of Object.entries(fields)) {
//     updates[col] = (plan[col] ?? 0) + incrementBy;
//   }

//   const { error: updateErr } = await supabase
//     .from("plans")
//     .update(updates)
//     .eq("id", planId);

//   if (updateErr) {
//     console.error("[incrementPlanCounters] Failed to update:", updateErr.message);
//   }
// }

// // ─────────────────────────────────────────
// // PHASE 1
// // ─────────────────────────────────────────
// export async function runPipelinePhase1(planId) {
//   if (typeof planId !== "string") throw new Error("runPipelinePhase1: expected UUID string");
//   console.log("🔥 Pipeline Phase 1 started:", planId);

//   await setStatus(planId, { pipeline_phase: "phase1_running" }, "analyzing");

//   await setStatus(planId, { understand_status: "running" }, "analyzing");
//   await runUnderstandingJob(planId);
//   await setStatus(planId, { understand_status: "completed" });

//   await setStatus(planId, { prompt_status: "running" }, "generating_prompts");
//   await startPromptDiscovery(planId);
//   await setStatus(planId, { prompt_status: "completed" });

//   await setStatus(planId, { pipeline_phase: "awaiting_prompt_review" }, "awaiting_prompt_review");
//   console.log("⏸️  Phase 1 done. Waiting for prompt selection:", planId);
// }

// // ─────────────────────────────────────────
// // PHASE 2
// // ─────────────────────────────────────────
// export async function runPipelinePhase2(planId) {
//   if (typeof planId !== "string") throw new Error("runPipelinePhase2: expected UUID string");
//   console.log("🔥 Pipeline Phase 2 started:", planId);

//   await setStatus(planId, { pipeline_phase: "phase2_running" }, "running");

//   await setStatus(planId, { mapping_status: "running" });
//   await runSimpleMappingJob(planId);
//   await setStatus(planId, { mapping_status: "completed" });

//   await ensureBrandProfile(planId);

//   await setStatus(planId, { competitor_status: "running" });
//   await safeCompetitorDiscovery(planId);
//   await setStatus(planId, { competitor_status: "suggested" });

//   await setStatus(planId, { pipeline_phase: "awaiting_competitor_review" }, "awaiting_competitor_review");
//   console.log("⏸️  Phase 2 done. Waiting for competitor review:", planId);
// }

// // ─────────────────────────────────────────
// // PHASE 3 — OPTIMIZED
// //
// // Old order (sequential):
// //   Answers → Visibility → Gaps → Recs → Schema → Score  (~40 min)
// //
// // New order (parallel where possible):
// //   ┌─ Answers ──────────────────────┐
// //   │                                ├─ done → Presence → Gaps ─┐
// //   └─ Visibility ───────────────────┘                          ├─ ┌─ Recs   ─┐
// //                                                                │  └─ Schema ─┘ → Score → Explain
// // ─────────────────────────────────────────
// export async function runPipelinePhase3(planId) {
//   if (typeof planId !== "string") throw new Error("runPipelinePhase3: expected UUID string");
//   console.log("🔥 Pipeline Phase 3 started:", planId);

//   const phase3StartedAt = new Date().toISOString();

//   await setStatus(planId, { pipeline_phase: "phase3_running" }, "running");

//   // ── STAGE 1: Answers + Visibility in PARALLEL ──────────────────
//   console.log("\n⚡ Stage 1: Answers + Visibility running in parallel...");

//   await setStatus(planId, { answer_status: "running", visibility_status: "running" });

//   const [answerResult, visibilityResult] = await Promise.allSettled([
//     runAnswerJob(planId),
//     startVisibilityJob(planId),
//   ]);

//   if (answerResult.status     === "rejected") console.error("❌ Answer job failed:",     answerResult.reason?.message);
//   if (visibilityResult.status === "rejected") console.error("❌ Visibility job failed:", visibilityResult.reason?.message);

//   await setStatus(planId, { answer_status: "completed", visibility_status: "completed" });

//   // ── COUNT how many active prompts were run (for prompts_used_this_month) ──
//   const { count: activePromptCount } = await supabase
//     .from("aeo_prompts")
//     .select("*", { count: "exact", head: true })
//     .eq("plan_id", planId)
//     .in("status", ["active", "manually_added"]);

//   // ── STAGE 2: Presence metrics ──────────────────────────────────
//   console.log("\n⚡ Stage 2: Calculating presence metrics...");

//   const { data: mentions } = await supabase
//     .from("aeo_mention_results")
//     .select("answer_id, entity_name, entity_type, mentioned")
//     .eq("plan_id", planId);

//   const presenceMetrics = calculatePresenceMetrics(mentions || []);
//   console.log("📊 Presence metrics:", presenceMetrics);
//   await setStatus(planId, { presence_status: "completed" });

//   // ── STAGE 3: Gap job ───────────────────────────────────────────
//   console.log("\n⚡ Stage 3: Running gap analysis...");
//   await runAeoGapJob(planId);

//   // ── STAGE 4: Recommendations + Schema in PARALLEL ──────────────
//   console.log("\n⚡ Stage 4: Recommendations + Schema running in parallel...");

//   const [recResult, schemaResult] = await Promise.allSettled([
//     runRecommendationJob(planId),
//     startSchemaJob(planId),
//   ]);

//   if (recResult.status    === "rejected") console.error("❌ Recommendation job failed:", recResult.reason?.message);
//   if (schemaResult.status === "rejected") console.error("❌ Schema job failed:",         schemaResult.reason?.message);

//   // ── STAGE 5: Score → Explain ───────────────────────────────────
//   console.log("\n⚡ Stage 5: Scoring + explanation...");
//   await runAeoScoreJob(planId);
//   await runAeoScoreExplainJob(planId);

//   // ── DONE — write all counters + timestamps back to plans table ──
//   // This is what ProjectsPage reads to show real metrics in the cards.
//   console.log("\n💾 Writing completion data back to plans table...");

//   await supabase
//     .from("plans")
//     .update({
//       // Marks pipeline complete — ProjectsPage mapPlan() reads this for status dot
//       pipeline_status:    "completed",

//       // Timestamps — "last run" and "next run" labels on the card
//       last_full_pipeline: new Date().toISOString(),

//       // Onboarding complete — card shows "Setup 6/5" check instead of warning
//       onboarding_step:    6,
//     })
//     .eq("id", planId);

//   // Increment run counters separately so they accumulate across runs
//   await incrementPlanCounters(planId, {
//     // Increments by 1 each time the full pipeline runs
//     visibility_runs_this_month: 1,

//     // How many prompts were processed this run
//     prompts_used_this_month: activePromptCount ?? 0,
//   });

//   await setStatus(
//     planId,
//     { pipeline_phase: "completed", overall_status: "completed" },
//     // pipeline_status already set to "completed" above — pass null to avoid overwrite
//     null
//   );

//   console.log("✅ Pipeline fully completed:", planId);
//   console.log(`   Prompts run:   ${activePromptCount ?? 0}`);
//   console.log(`   Completed at:  ${new Date().toISOString()}`);
// }

// // ─────────────────────────────────────────
// // SAFE COMPETITOR DISCOVERY
// // ─────────────────────────────────────────
// async function safeCompetitorDiscovery(planId) {
//   try {
//     const { data: plan } = await supabase
//       .from("plans")
//       .select("website_url, name")
//       .eq("id", planId)
//       .maybeSingle();

//     if (!plan) return;
//     console.log("🔍 Running competitor discovery for:", plan.name);

//     const { runCompetitorJob } = await import("../jobs/aeoCompetitorsSimple.job.js")
//       .catch(() => ({ runCompetitorJob: null }));

//     if (runCompetitorJob) await runCompetitorJob(planId);
//     else console.warn("⚠️  No competitor job found — skipping.");
//   } catch (err) {
//     console.error("⚠️  Competitor discovery failed (non-fatal):", err.message);
//   }
// }






/**
 * AEO Pipeline — 3 phases, 2 user pause points
 *
 * PHASE 1: Understand → Prompt Discovery → ⏸️
 * PHASE 2: Mapping → Brand Profile → Competitor Discovery → ⏸️
 * PHASE 3: Answers ║ Visibility → Presence → Gaps ║ Recs → Schema ║ Score → ✅
 *
 * Phase 3 optimized for speed:
 *   - Answer + Visibility run in PARALLEL
 *   - Gap job starts right after visibility
 *   - Recommendations + Schema run in PARALLEL
 *   - Score + ScoreExplain run sequentially (explain needs score)
 */

import { supabase } from "../config/supabase.js";

import { runUnderstandingJob }      from "./aeoUnderstand.job.js";
import { runAnswerJob }             from "./aeoAnswer.job.js";
import { runAeoGapJob }             from "./aeoGap.job.js";
import { runAeoScoreJob }           from "./aeoScore.job.js";
import { runAeoScoreExplainJob }    from "./aeoScoreExplain.job.js";
import { ensureBrandProfile }       from "./aeoBrandProfile.job.js";
import { startPromptDiscovery }     from "../services/aeo/aeoPrompt.service.js";
import { startVisibilityJob }       from "../services/aeo/aeoVisibility.service.js";
import { startSchemaJob }           from "../services/aeo/aeoSchema.service.js";
import { runSimpleMappingJob }      from "./aeoMappingSimple.job.js";
import { runRecommendationJob }     from "./aeoRecommendation.job.js";
import { calculatePresenceMetrics } from "../services/aeo/aeoPresence.service.js";

// ─────────────────────────────────────────
// HELPER — update aeo_pipeline_status + optional plans.pipeline_status
// ─────────────────────────────────────────
async function setStatus(planId, pipelineFields, planStatus = null) {
  await supabase
    .from("aeo_pipeline_status")
    .update({ ...pipelineFields, updated_at: new Date().toISOString() })
    .eq("plan_id", planId);

  if (planStatus) {
    await supabase
      .from("plans")
      .update({ pipeline_status: planStatus })
      .eq("id", planId);
  }
}

// ─────────────────────────────────────────
// HELPER — increment a numeric column safely
// Fetches current value then updates to avoid race conditions
// ─────────────────────────────────────────
async function incrementPlanCounters(planId, fields) {
  // fields = { visibility_runs_this_month: 1, prompts_used_this_month: 20 }
  const columnNames = Object.keys(fields).join(", ");

  const { data: plan, error } = await supabase
    .from("plans")
    .select(columnNames)
    .eq("id", planId)
    .single();

  if (error || !plan) {
    console.error("[incrementPlanCounters] Failed to fetch plan:", error?.message);
    return;
  }

  const updates = {};
  for (const [col, incrementBy] of Object.entries(fields)) {
    updates[col] = (plan[col] ?? 0) + incrementBy;
  }

  const { error: updateErr } = await supabase
    .from("plans")
    .update(updates)
    .eq("id", planId);

  if (updateErr) {
    console.error("[incrementPlanCounters] Failed to update:", updateErr.message);
  }
}

// ─────────────────────────────────────────
// PHASE 1
// ─────────────────────────────────────────
export async function runPipelinePhase1(planId) {
  if (typeof planId !== "string") throw new Error("runPipelinePhase1: expected UUID string");
  console.log("🔥 Pipeline Phase 1 started:", planId);

  await setStatus(planId, { pipeline_phase: "phase1_running" }, "analyzing");

  await setStatus(planId, { understand_status: "running" }, "analyzing");
  await runUnderstandingJob(planId);
  await setStatus(planId, { understand_status: "completed" });

  await setStatus(planId, { prompt_status: "running" }, "generating_prompts");
  await startPromptDiscovery(planId);
  await setStatus(planId, { prompt_status: "completed" });

  await setStatus(planId, { pipeline_phase: "awaiting_prompt_review" }, "awaiting_prompt_review");
  console.log("⏸️  Phase 1 done. Waiting for prompt selection:", planId);
}

// ─────────────────────────────────────────
// PHASE 2
// ─────────────────────────────────────────
export async function runPipelinePhase2(planId) {
  if (typeof planId !== "string") throw new Error("runPipelinePhase2: expected UUID string");
  console.log("🔥 Pipeline Phase 2 started:", planId);

  await setStatus(planId, { pipeline_phase: "phase2_running" }, "running");

  await setStatus(planId, { mapping_status: "running" });
  await runSimpleMappingJob(planId);
  await setStatus(planId, { mapping_status: "completed" });

  await ensureBrandProfile(planId);

  await setStatus(planId, { competitor_status: "running" });
  await safeCompetitorDiscovery(planId);
  await setStatus(planId, { competitor_status: "suggested" });

  await setStatus(planId, { pipeline_phase: "awaiting_competitor_review" }, "awaiting_competitor_review");
  console.log("⏸️  Phase 2 done. Waiting for competitor review:", planId);
}

// ─────────────────────────────────────────
// PHASE 3 — OPTIMIZED
//
// Old order (sequential):
//   Answers → Visibility → Gaps → Recs → Schema → Score  (~40 min)
//
// New order (parallel where possible):
//   ┌─ Answers ──────────────────────┐
//   │                                ├─ done → Presence → Gaps ─┐
//   └─ Visibility ───────────────────┘                          ├─ ┌─ Recs   ─┐
//                                                                │  └─ Schema ─┘ → Score → Explain
// ─────────────────────────────────────────
export async function runPipelinePhase3(planId) {
  if (typeof planId !== "string") throw new Error("runPipelinePhase3: expected UUID string");
  console.log("🔥 Pipeline Phase 3 started:", planId);

  const phase3StartedAt = new Date().toISOString();

  await setStatus(planId, { pipeline_phase: "phase3_running" }, "running");

  // ── STAGE 1: Answers + Visibility in PARALLEL ──────────────────
  console.log("\n⚡ Stage 1: Answers + Visibility running in parallel...");

  await setStatus(planId, { answer_status: "running", visibility_status: "running" });

  const [answerResult, visibilityResult] = await Promise.allSettled([
    runAnswerJob(planId),
    startVisibilityJob(planId),
  ]);

  if (answerResult.status     === "rejected") console.error("❌ Answer job failed:",     answerResult.reason?.message);
  if (visibilityResult.status === "rejected") console.error("❌ Visibility job failed:", visibilityResult.reason?.message);

  await setStatus(planId, { answer_status: "completed", visibility_status: "completed" });

  // ── COUNT how many active prompts were run (for prompts_used_this_month) ──
  const { count: activePromptCount } = await supabase
    .from("aeo_prompts")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .in("status", ["active", "manually_added"]);

  // ── STAGE 2: Presence metrics ──────────────────────────────────
  console.log("\n⚡ Stage 2: Calculating presence metrics...");

  const { data: mentions } = await supabase
    .from("aeo_mention_results")
    .select("answer_id, entity_name, entity_type, mentioned")
    .eq("plan_id", planId);

  const presenceMetrics = calculatePresenceMetrics(mentions || []);
  console.log("📊 Presence metrics:", presenceMetrics);
  await setStatus(planId, { presence_status: "completed" });

  // ── STAGE 3: Gap job ───────────────────────────────────────────
  console.log("\n⚡ Stage 3: Running gap analysis...");
  await runAeoGapJob(planId);

  // ── STAGE 4: Recommendations + Schema in PARALLEL ──────────────
  console.log("\n⚡ Stage 4: Recommendations + Schema running in parallel...");

  const [recResult, schemaResult] = await Promise.allSettled([
    runRecommendationJob(planId),
    startSchemaJob(planId),
  ]);

  if (recResult.status    === "rejected") console.error("❌ Recommendation job failed:", recResult.reason?.message);
  if (schemaResult.status === "rejected") console.error("❌ Schema job failed:",         schemaResult.reason?.message);

  // ── STAGE 5: Score → Explain ───────────────────────────────────
  console.log("\n⚡ Stage 5: Scoring + explanation...");
  await runAeoScoreJob(planId);
  await runAeoScoreExplainJob(planId);

  // ── DONE — write all counters + timestamps back to plans table ──
  // This is what ProjectsPage reads to show real metrics in the cards.
  console.log("\n💾 Writing completion data back to plans table...");

  await supabase
    .from("plans")
    .update({
      // Marks pipeline complete — ProjectsPage mapPlan() reads this for status dot
      pipeline_status:    "completed",

      // Timestamps — "last run" and "next run" labels on the card
      last_full_pipeline: new Date().toISOString(),

      // Onboarding complete — card shows "Setup 6/5" check instead of warning
      onboarding_step:    6,
    })
    .eq("id", planId);

  // Increment run counters separately so they accumulate across runs
  await incrementPlanCounters(planId, {
    // Increments by 1 each time the full pipeline runs
    visibility_runs_this_month: 1,

    // How many prompts were processed this run
    prompts_used_this_month: activePromptCount ?? 0,
  });

  await setStatus(
    planId,
    { pipeline_phase: "completed", overall_status: "completed" },
    // pipeline_status already set to "completed" above — pass null to avoid overwrite
    null
  );

  console.log("✅ Pipeline fully completed:", planId);
  console.log(`   Prompts run:   ${activePromptCount ?? 0}`);
  console.log(`   Completed at:  ${new Date().toISOString()}`);
}

// ─────────────────────────────────────────
// SAFE COMPETITOR DISCOVERY
// ─────────────────────────────────────────
async function safeCompetitorDiscovery(planId) {
  try {
    const { data: plan } = await supabase
      .from("plans")
      .select("website_url, name")
      .eq("id", planId)
      .maybeSingle();

    if (!plan) return;
    console.log("🔍 Running competitor discovery for:", plan.name);

    const { runCompetitorJob } = await import("../jobs/aeoCompetitorsSimple.job.js")
      .catch(() => ({ runCompetitorJob: null }));

    if (runCompetitorJob) await runCompetitorJob(planId);
    else console.warn("⚠️  No competitor job found — skipping.");
  } catch (err) {
    console.error("⚠️  Competitor discovery failed (non-fatal):", err.message);
  }
}