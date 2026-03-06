


// // import { supabase } from "../../config/supabase.js";
// // import { domainToBrandName, generateAliases } from "../../utils/domainToName.js";
// // import { runPipelinePhase3 } from "../../jobs/aeoPipeline.job.js";
// // import apiResponse from "../../utils/apiResponse.js";


// // // ─────────────────────────────────────────
// // // TIER LIMITS
// // // ─────────────────────────────────────────
// // const COMPETITOR_LIMITS = {
// //   starter: 10,
// //   pro:     20,
// //   default: 10,
// // };

// // async function getPlanTier(planId) {
// //   const { data: plan } = await supabase
// //     .from("plans")
// //     .select("tier, user_id")
// //     .eq("id", planId)
// //     .single();

// //   return {
// //     tier:    plan?.tier || "starter",
// //     userId:  plan?.user_id,
// //     maxComp: COMPETITOR_LIMITS[plan?.tier] || COMPETITOR_LIMITS.default,
// //   };
// // }

// // // ─────────────────────────────────────────
// // // ADD SEED COMPETITORS
// // // ─────────────────────────────────────────
// // export const addSeedCompetitors = async (req, res) => {
// //   try {
// //     const { planId, domains } = req.body;

// //     if (!planId || !Array.isArray(domains) || domains.length < 1) {
// //       return res.status(400).json({ error: "At least 1 competitor required" });
// //     }

// //     const { tier, maxComp } = await getPlanTier(planId);

// //     if (domains.length > maxComp) {
// //       return res.status(403).json({
// //         error:    `Your ${tier} plan allows up to ${maxComp} competitors per project.`,
// //         limit:    maxComp,
// //         provided: domains.length,
// //       });
// //     }

// //     const { count: existing } = await supabase
// //       .from("aeo_competitors")
// //       .select("*", { count: "exact", head: true })
// //       .eq("plan_id", planId)
// //       .eq("approved", true);

// //     const available = maxComp - (existing || 0);

// //     if (available <= 0) {
// //       return res.status(403).json({
// //         error:           `You've reached your limit of ${maxComp} competitors.`,
// //         limit_reached:   true,
// //         current_count:   existing,
// //         max_competitors: maxComp,
// //       });
// //     }

// //     const toAdd = domains.slice(0, available);

// //     const inserts = toAdd.map((domain) => {
// //       const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
// //       const name        = domainToBrandName(cleanDomain);
// //       const aliases     = generateAliases(name, cleanDomain);

// //       return {
// //         plan_id:          planId,
// //         domain:           cleanDomain,
// //         name,
// //         aliases,
// //         source:           "user",
// //         classification:   "direct",
// //         confidence_score: 1,
// //         approved:         true,
// //         status:           "active",
// //         detected_reason:  "User-provided seed competitor",
// //       };
// //     });

// //     const { error } = await supabase
// //       .from("aeo_competitors")
// //       .upsert(inserts, { onConflict: "plan_id,domain" });

// //     if (error) throw error;

// //     res.json({
// //       success:          true,
// //       added:            inserts.length,
// //       competitors_used: (existing || 0) + inserts.length,
// //       competitors_max:  maxComp,
// //       remaining:        maxComp - (existing || 0) - inserts.length,
// //     });
// //   } catch (err) {
// //     console.error("Seed competitor error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ─────────────────────────────────────────
// // // GET ALL COMPETITORS FOR A PLAN
// // // ─────────────────────────────────────────
// // export const getCompetitorsByPlan = async (req, res) => {
// //   try {
// //     const { planId } = req.params;

// //     const { tier, maxComp } = await getPlanTier(planId);

// //     const { data: active, error: activeErr } = await supabase
// //       .from("aeo_competitors")
// //       .select("id, name, domain, aliases, source, classification, confidence_score, approved, status, detected_reason, created_at")
// //       .eq("plan_id", planId)
// //       .eq("approved", true)
// //       .neq("status", "ignored")
// //       .order("confidence_score", { ascending: false });

// //     if (activeErr) throw activeErr;

// //     const { data: suggestions, error: suggestErr } = await supabase
// //       .from("aeo_competitors")
// //       .select("id, name, domain, aliases, source, classification, confidence_score, detected_reason, times_seen, created_at")
// //       .eq("plan_id", planId)
// //       .eq("approved", false)
// //       .eq("status", "pending_approval")
// //       .order("times_seen", { ascending: false });

// //     if (suggestErr) throw suggestErr;

// //     res.json({
// //       competitors:      active       || [],
// //       suggestions:      suggestions  || [],
// //       competitors_used: active?.length || 0,
// //       competitors_max:  maxComp,
// //       remaining:        maxComp - (active?.length || 0),
// //       tier,
// //     });
// //   } catch (err) {
// //     console.error("Get competitors error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ─────────────────────────────────────────
// // // ADD COMPETITOR MANUALLY
// // // ─────────────────────────────────────────
// // export const addCompetitor = async (req, res) => {
// //   try {
// //     const { planId, domain } = req.body;

// //     if (!planId || !domain) {
// //       return res.status(400).json({ error: "planId and domain required" });
// //     }

// //     const { tier, maxComp } = await getPlanTier(planId);

// //     const { count: existing } = await supabase
// //       .from("aeo_competitors")
// //       .select("*", { count: "exact", head: true })
// //       .eq("plan_id", planId)
// //       .eq("approved", true)
// //       .neq("status", "ignored");

// //     if ((existing || 0) >= maxComp) {
// //       return res.status(403).json({
// //         error:           `You've reached your limit of ${maxComp} competitors on the ${tier} plan.`,
// //         limit_reached:   true,
// //         current_count:   existing,
// //         max_competitors: maxComp,
// //         upgrade_message: tier === "starter"
// //           ? "Upgrade to Pro to track up to 20 competitors."
// //           : "Contact us for enterprise plans.",
// //       });
// //     }

// //     const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
// //     const name        = domainToBrandName(cleanDomain);
// //     const aliases     = generateAliases(name, cleanDomain);

// //     const { data: dup } = await supabase
// //       .from("aeo_competitors")
// //       .select("id, status")
// //       .eq("plan_id", planId)
// //       .eq("domain", cleanDomain)
// //       .maybeSingle();

// //     if (dup) {
// //       if (dup.status === "ignored") {
// //         await supabase
// //           .from("aeo_competitors")
// //           .update({ approved: true, status: "active" })
// //           .eq("id", dup.id);
// //         return res.json({ success: true, reactivated: true });
// //       }
// //       return res.status(400).json({ error: "Competitor already exists" });
// //     }

// //     const { data, error } = await supabase
// //       .from("aeo_competitors")
// //       .insert({
// //         plan_id:          planId,
// //         domain:           cleanDomain,
// //         name,
// //         aliases,
// //         source:           "user",
// //         classification:   "direct",
// //         confidence_score: 1,
// //         approved:         true,
// //         status:           "active",
// //         detected_reason:  "Manually added by user",
// //       })
// //       .select()
// //       .single();

// //     if (error) throw error;

// //     res.json({
// //       success:          true,
// //       competitor:       data,
// //       competitors_used: (existing || 0) + 1,
// //       competitors_max:  maxComp,
// //       remaining:        maxComp - (existing || 0) - 1,
// //     });
// //   } catch (err) {
// //     console.error("Add competitor error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ─────────────────────────────────────────
// // // ACCEPT AI SUGGESTION
// // // ─────────────────────────────────────────
// // export const acceptSuggestedCompetitor = async (req, res) => {
// //   try {
// //     const { id }     = req.params;
// //     const { planId } = req.body;

// //     if (!planId) return res.status(400).json({ error: "planId required" });

// //     const { error } = await supabase
// //       .from("aeo_competitors")
// //       .update({ approved: true, status: "active" })
// //       .eq("id", id)
// //       .eq("plan_id", planId);

// //     if (error) return res.status(500).json({ error: "Failed to accept competitor" });

// //     res.json({ success: true, message: "Competitor accepted" });

// //     setImmediate(() => maybeTriggerPhase3(planId).catch(console.error));
// //   } catch (err) {
// //     console.error("Accept competitor error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ─────────────────────────────────────────
// // // IGNORE AI SUGGESTION
// // // ─────────────────────────────────────────
// // export const ignoreSuggestedCompetitor = async (req, res) => {
// //   try {
// //     const { id }     = req.params;
// //     const { planId } = req.body;

// //     if (!planId) return res.status(400).json({ error: "planId required" });

// //     const { error } = await supabase
// //       .from("aeo_competitors")
// //       .update({ approved: false, status: "ignored" })
// //       .eq("id", id)
// //       .eq("plan_id", planId);

// //     if (error) return res.status(500).json({ error: "Failed to ignore competitor" });

// //     res.json({ success: true, message: "Competitor ignored" });

// //     setImmediate(() => maybeTriggerPhase3(planId).catch(console.error));
// //   } catch (err) {
// //     console.error("Ignore competitor error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ─────────────────────────────────────────
// // // CONFIRM REVIEW — explicit Phase 3 trigger
// // // Called by Step5 frontend after all
// // // accept/ignore calls finish
// // // POST /aeo/competitors/confirm-review
// // // ─────────────────────────────────────────
// // export const confirmCompetitorReview = async (req, res) => {
// //   try {
// //     const { planId } = req.body;
// //     if (!planId) return res.status(400).json({ error: "planId required" });

// //     // Guard — only trigger if we're at the right phase
// //     const { data: status } = await supabase
// //       .from("aeo_pipeline_status")
// //       .select("pipeline_phase")
// //       .eq("plan_id", planId)
// //       .maybeSingle();

// //     if (status?.pipeline_phase !== "awaiting_competitor_review") {
// //       return res.json({ success: true, message: "Phase already progressed" });
// //     }

// //     res.json({ success: true, message: "Phase 3 starting" });

// //     setImmediate(() => runPipelinePhase3(planId).catch(console.error));
// //   } catch (err) {
// //     console.error("confirmCompetitorReview error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ─────────────────────────────────────────
// // // REMOVE COMPETITOR
// // // ─────────────────────────────────────────
// // export const removeCompetitor = async (req, res) => {
// //   try {
// //     const { id } = req.params;

// //     const { data: comp, error: fetchErr } = await supabase
// //       .from("aeo_competitors")
// //       .select("id, domain, plan_id, source")
// //       .eq("id", id)
// //       .single();

// //     if (fetchErr || !comp) {
// //       return res.status(404).json({ error: "Competitor not found" });
// //     }

// //     const { error } = await supabase
// //       .from("aeo_competitors")
// //       .delete()
// //       .eq("id", id);

// //     if (error) throw error;

// //     const { maxComp } = await getPlanTier(comp.plan_id);
// //     const { count: remaining } = await supabase
// //       .from("aeo_competitors")
// //       .select("*", { count: "exact", head: true })
// //       .eq("plan_id", comp.plan_id)
// //       .eq("approved", true)
// //       .neq("status", "ignored");

// //     res.json({
// //       success:          true,
// //       removed:          comp.domain,
// //       competitors_used: remaining || 0,
// //       competitors_max:  maxComp,
// //       slots_freed:      1,
// //     });
// //   } catch (err) {
// //     console.error("Remove competitor error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ─────────────────────────────────────────
// // // APPROVE COMPETITOR (legacy alias)
// // // ─────────────────────────────────────────
// // export const approveCompetitor = async (req, res) => {
// //   return acceptSuggestedCompetitor(req, res);
// // };

// // // ─────────────────────────────────────────
// // // SAVE AI-DISCOVERED COMPETITOR (internal)
// // // Called by visibility job
// // // ─────────────────────────────────────────
// // export async function saveDiscoveredCompetitor(planId, domain, reason) {
// //   try {
// //     const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

// //     const { data: existing } = await supabase
// //       .from("aeo_competitors")
// //       .select("id, status, times_seen")
// //       .eq("plan_id", planId)
// //       .eq("domain", cleanDomain)
// //       .maybeSingle();

// //     if (existing?.status === "ignored") return;
// //     if (existing?.status === "active")  return;

// //     const name      = domainToBrandName(cleanDomain);
// //     const aliases   = generateAliases(name, cleanDomain);
// //     const timesSeen = (existing?.times_seen || 0) + 1;

// //     if (existing) {
// //       await supabase
// //         .from("aeo_competitors")
// //         .update({ times_seen: timesSeen })
// //         .eq("id", existing.id);
// //     } else {
// //       await supabase
// //         .from("aeo_competitors")
// //         .insert({
// //           plan_id:          planId,
// //           domain:           cleanDomain,
// //           name,
// //           aliases,
// //           source:           "ai_discovered",
// //           classification:   "discovered",
// //           confidence_score: 0.5,
// //           approved:         false,
// //           status:           "pending_approval",
// //           times_seen:       1,
// //           detected_reason:  reason || "Found in AI answers",
// //         });
// //     }

// //     if (timesSeen >= 3) {
// //       console.log(`💡 Competitor ready to suggest: ${cleanDomain} (seen ${timesSeen}x)`);
// //     }
// //   } catch (err) {
// //     console.error("Save discovered competitor error:", err);
// //   }
// // }

// // // ─────────────────────────────────────────
// // // INTERNAL — trigger Phase 3 when all
// // // pending_approval competitors are reviewed
// // // ─────────────────────────────────────────
// // async function maybeTriggerPhase3(planId) {
// //   const { count } = await supabase
// //     .from("aeo_competitors")
// //     .select("id", { count: "exact", head: true })
// //     .eq("plan_id", planId)
// //     .eq("status", "pending_approval");

// //   if (count > 0) return; // still pending

// //   const { data: status } = await supabase
// //     .from("aeo_pipeline_status")
// //     .select("pipeline_phase")
// //     .eq("plan_id", planId)
// //     .maybeSingle();

// //   if (status?.pipeline_phase !== "awaiting_competitor_review") return;

// //   console.log("🚀 All competitors reviewed — starting Phase 3:", planId);
// //   await runPipelinePhase3(planId);
// // }



// import { supabase } from "../../config/supabase.js";
// import { domainToBrandName, generateAliases } from "../../utils/domainToName.js";
// import { runPipelinePhase3 } from "../../jobs/aeoPipeline.job.js";
// import apiResponse from "../../utils/apiResponse.js";

// // ─────────────────────────────────────────
// // TIER LIMITS
// // ─────────────────────────────────────────
// const COMPETITOR_LIMITS = {
//   starter: 10,
//   pro:     20,
//   default: 10,
// };

// async function getPlanTier(planId) {
//   const { data: plan } = await supabase
//     .from("plans")
//     .select("tier, user_id")
//     .eq("id", planId)
//     .single();

//   return {
//     tier:    plan?.tier || "starter",
//     userId:  plan?.user_id,
//     maxComp: COMPETITOR_LIMITS[plan?.tier] || COMPETITOR_LIMITS.default,
//   };
// }

// // ─────────────────────────────────────────
// // ADD SEED COMPETITORS
// // ─────────────────────────────────────────
// export const addSeedCompetitors = async (req, res) => {
//   try {
//     const { planId, domains } = req.body;

//     if (!planId || !Array.isArray(domains) || domains.length < 1) {
//       return res.status(400).json({ error: "At least 1 competitor required" });
//     }

//     const { tier, maxComp } = await getPlanTier(planId);

//     if (domains.length > maxComp) {
//       return res.status(403).json({
//         error:    `Your ${tier} plan allows up to ${maxComp} competitors per project.`,
//         limit:    maxComp,
//         provided: domains.length,
//       });
//     }

//     const { count: existing } = await supabase
//       .from("aeo_competitors")
//       .select("*", { count: "exact", head: true })
//       .eq("plan_id", planId)
//       .eq("approved", true);

//     const available = maxComp - (existing || 0);

//     if (available <= 0) {
//       return res.status(403).json({
//         error:           `You've reached your limit of ${maxComp} competitors.`,
//         limit_reached:   true,
//         current_count:   existing,
//         max_competitors: maxComp,
//       });
//     }

//     const toAdd = domains.slice(0, available);

//     const inserts = toAdd.map((domain) => {
//       const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
//       const name        = domainToBrandName(cleanDomain);
//       const aliases     = generateAliases(name, cleanDomain);

//       return {
//         plan_id:          planId,
//         domain:           cleanDomain,
//         name,
//         aliases,
//         source:           "user",
//         classification:   "direct",
//         confidence_score: 1,
//         approved:         true,
//         status:           "active",
//         detected_reason:  "User-provided seed competitor",
//       };
//     });

//     const { error } = await supabase
//       .from("aeo_competitors")
//       .upsert(inserts, { onConflict: "plan_id,domain" });

//     if (error) throw error;

//     res.json({
//       success:          true,
//       added:            inserts.length,
//       competitors_used: (existing || 0) + inserts.length,
//       competitors_max:  maxComp,
//       remaining:        maxComp - (existing || 0) - inserts.length,
//     });
//   } catch (err) {
//     console.error("Seed competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // GET ALL COMPETITORS FOR A PLAN
// // Includes win / loss / shared stats from aeo_mention_results
// // win    = brand mentioned, competitor NOT (brand wins)
// // loss   = competitor mentioned, brand NOT (brand loses)
// // shared = both mentioned in same answer
// // ─────────────────────────────────────────
// export const getCompetitorsByPlan = async (req, res) => {
//   try {
//     // Support both /competitors/:planId and /competitors?planId=...
//     const planId = req.params.planId ?? req.query.planId;
//     if (!planId) return res.status(400).json({ error: "planId required" });

//     const { tier, maxComp } = await getPlanTier(planId);

//     // Fetch competitors + mention results in parallel
//     const [
//       { data: active,      error: activeErr   },
//       { data: suggestions, error: suggestErr  },
//       { data: mentions                        },
//     ] = await Promise.all([
//       supabase
//         .from("aeo_competitors")
//         .select("id, name, domain, confidence_score, approved, status, detected_reason, times_seen, source, classification")
//         .eq("plan_id", planId)
//         .eq("approved", true)
//         .neq("status", "ignored")
//         .order("confidence_score", { ascending: false }),

//       supabase
//         .from("aeo_competitors")
//         .select("id, name, domain, confidence_score, detected_reason, times_seen, source")
//         .eq("plan_id", planId)
//         .eq("approved", false)
//         .eq("status", "pending_approval")
//         .order("times_seen", { ascending: false }),

//       supabase
//         .from("aeo_mention_results")
//         .select("answer_id, entity_name, entity_type, mentioned")
//         .eq("plan_id", planId),
//     ]);

//     if (activeErr)  throw activeErr;
//     if (suggestErr) throw suggestErr;

//     // ── Group mentions by answer_id ────────────────────────────────────────
//     const byAnswer = {};
//     for (const m of mentions ?? []) {
//       if (!byAnswer[m.answer_id]) byAnswer[m.answer_id] = [];
//       byAnswer[m.answer_id].push(m);
//     }

//     // ── Per-competitor tally ───────────────────────────────────────────────
//     const compStats = {};
//     for (const answerMentions of Object.values(byAnswer)) {
//       const brandMentioned = answerMentions.some(
//         m => m.entity_type === "brand" && m.mentioned === true
//       );
//       const mentionedComps = answerMentions
//         .filter(m => m.entity_type === "competitor" && m.mentioned === true)
//         .map(m => m.entity_name);
//       const allComps = answerMentions
//         .filter(m => m.entity_type === "competitor")
//         .map(m => m.entity_name);

//       for (const name of allComps) {
//         if (!compStats[name]) compStats[name] = { wins: 0, losses: 0, shared: 0, total: 0 };
//         compStats[name].total++;
//         const compMentioned = mentionedComps.includes(name);
//         if      (brandMentioned && !compMentioned)  compStats[name].wins++;
//         else if (!brandMentioned && compMentioned)   compStats[name].losses++;
//         else if  (brandMentioned && compMentioned)   compStats[name].shared++;
//       }
//     }

//     // ── Enrich each competitor row with stats ──────────────────────────────
//     const enrich = (c) => {
//       const name  = c.name || c.domain;
//       const stats = compStats[name] ?? { wins: 0, losses: 0, shared: 0, total: 0 };
//       const total = stats.total || 1;
//       return {
//         ...c,
//         name,
//         wins:          stats.wins,
//         losses:        stats.losses,
//         shared:        stats.shared,
//         total_answers: stats.total,
//         win_rate:      Math.round((stats.wins   / total) * 100),
//         loss_rate:     Math.round((stats.losses / total) * 100),
//         shared_rate:   Math.round((stats.shared / total) * 100),
//       };
//     };

//     // ── Overall brand summary across all answers ───────────────────────────
//     let totalWins = 0, totalLosses = 0, totalShared = 0, totalAnswers = 0;
//     for (const answerMentions of Object.values(byAnswer)) {
//       const brandMentioned   = answerMentions.some(m => m.entity_type === "brand"      && m.mentioned);
//       const anyCompMentioned = answerMentions.some(m => m.entity_type === "competitor" && m.mentioned);
//       totalAnswers++;
//       if      (brandMentioned && !anyCompMentioned)  totalWins++;
//       else if (!brandMentioned && anyCompMentioned)   totalLosses++;
//       else if  (brandMentioned && anyCompMentioned)   totalShared++;
//     }

//     res.json({
//       competitors:      (active      ?? []).map(enrich),
//       suggestions:      (suggestions ?? []).map(enrich),
//       competitors_used: active?.length || 0,
//       competitors_max:  maxComp,
//       remaining:        maxComp - (active?.length || 0),
//       tier,
//       summary: { wins: totalWins, losses: totalLosses, shared: totalShared, total: totalAnswers },
//     });
//   } catch (err) {
//     console.error("Get competitors error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // ADD COMPETITOR MANUALLY
// // ─────────────────────────────────────────
// export const addCompetitor = async (req, res) => {
//   try {
//     const { planId, domain } = req.body;

//     if (!planId || !domain) {
//       return res.status(400).json({ error: "planId and domain required" });
//     }

//     const { tier, maxComp } = await getPlanTier(planId);

//     const { count: existing } = await supabase
//       .from("aeo_competitors")
//       .select("*", { count: "exact", head: true })
//       .eq("plan_id", planId)
//       .eq("approved", true)
//       .neq("status", "ignored");

//     if ((existing || 0) >= maxComp) {
//       return res.status(403).json({
//         error:           `You've reached your limit of ${maxComp} competitors on the ${tier} plan.`,
//         limit_reached:   true,
//         current_count:   existing,
//         max_competitors: maxComp,
//         upgrade_message: tier === "starter"
//           ? "Upgrade to Pro to track up to 20 competitors."
//           : "Contact us for enterprise plans.",
//       });
//     }

//     const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
//     const name        = domainToBrandName(cleanDomain);
//     const aliases     = generateAliases(name, cleanDomain);

//     const { data: dup } = await supabase
//       .from("aeo_competitors")
//       .select("id, status")
//       .eq("plan_id", planId)
//       .eq("domain", cleanDomain)
//       .maybeSingle();

//     if (dup) {
//       if (dup.status === "ignored") {
//         await supabase
//           .from("aeo_competitors")
//           .update({ approved: true, status: "active" })
//           .eq("id", dup.id);
//         return res.json({ success: true, reactivated: true });
//       }
//       return res.status(400).json({ error: "Competitor already exists" });
//     }

//     const { data, error } = await supabase
//       .from("aeo_competitors")
//       .insert({
//         plan_id:          planId,
//         domain:           cleanDomain,
//         name,
//         aliases,
//         source:           "user",
//         classification:   "direct",
//         confidence_score: 1,
//         approved:         true,
//         status:           "active",
//         detected_reason:  "Manually added by user",
//       })
//       .select()
//       .single();

//     if (error) throw error;

//     res.json({
//       success:          true,
//       competitor:       data,
//       competitors_used: (existing || 0) + 1,
//       competitors_max:  maxComp,
//       remaining:        maxComp - (existing || 0) - 1,
//     });
//   } catch (err) {
//     console.error("Add competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // ACCEPT AI SUGGESTION
// // ─────────────────────────────────────────
// export const acceptSuggestedCompetitor = async (req, res) => {
//   try {
//     const { id }     = req.params;
//     const { planId } = req.body;

//     if (!planId) return res.status(400).json({ error: "planId required" });

//     const { error } = await supabase
//       .from("aeo_competitors")
//       .update({ approved: true, status: "active" })
//       .eq("id", id)
//       .eq("plan_id", planId);

//     if (error) return res.status(500).json({ error: "Failed to accept competitor" });

//     res.json({ success: true, message: "Competitor accepted" });

//     setImmediate(() => maybeTriggerPhase3(planId).catch(console.error));
//   } catch (err) {
//     console.error("Accept competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // IGNORE AI SUGGESTION
// // ─────────────────────────────────────────
// export const ignoreSuggestedCompetitor = async (req, res) => {
//   try {
//     const { id }     = req.params;
//     const { planId } = req.body;

//     if (!planId) return res.status(400).json({ error: "planId required" });

//     const { error } = await supabase
//       .from("aeo_competitors")
//       .update({ approved: false, status: "ignored" })
//       .eq("id", id)
//       .eq("plan_id", planId);

//     if (error) return res.status(500).json({ error: "Failed to ignore competitor" });

//     res.json({ success: true, message: "Competitor ignored" });

//     setImmediate(() => maybeTriggerPhase3(planId).catch(console.error));
//   } catch (err) {
//     console.error("Ignore competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // CONFIRM REVIEW — explicit Phase 3 trigger
// // POST /aeo/competitors/confirm-review
// // ─────────────────────────────────────────
// export const confirmCompetitorReview = async (req, res) => {
//   try {
//     const { planId } = req.body;
//     if (!planId) return res.status(400).json({ error: "planId required" });

//     const { data: status } = await supabase
//       .from("aeo_pipeline_status")
//       .select("pipeline_phase")
//       .eq("plan_id", planId)
//       .maybeSingle();

//     if (status?.pipeline_phase !== "awaiting_competitor_review") {
//       return res.json({ success: true, message: "Phase already progressed" });
//     }

//     res.json({ success: true, message: "Phase 3 starting" });

//     setImmediate(() => runPipelinePhase3(planId).catch(console.error));
//   } catch (err) {
//     console.error("confirmCompetitorReview error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // REMOVE COMPETITOR
// // ─────────────────────────────────────────
// export const removeCompetitor = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const { data: comp, error: fetchErr } = await supabase
//       .from("aeo_competitors")
//       .select("id, domain, plan_id, source")
//       .eq("id", id)
//       .single();

//     if (fetchErr || !comp) {
//       return res.status(404).json({ error: "Competitor not found" });
//     }

//     const { error } = await supabase
//       .from("aeo_competitors")
//       .delete()
//       .eq("id", id);

//     if (error) throw error;

//     const { maxComp } = await getPlanTier(comp.plan_id);
//     const { count: remaining } = await supabase
//       .from("aeo_competitors")
//       .select("*", { count: "exact", head: true })
//       .eq("plan_id", comp.plan_id)
//       .eq("approved", true)
//       .neq("status", "ignored");

//     res.json({
//       success:          true,
//       removed:          comp.domain,
//       competitors_used: remaining || 0,
//       competitors_max:  maxComp,
//       slots_freed:      1,
//     });
//   } catch (err) {
//     console.error("Remove competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // APPROVE COMPETITOR (legacy alias)
// // ─────────────────────────────────────────
// export const approveCompetitor = async (req, res) => {
//   return acceptSuggestedCompetitor(req, res);
// };

// // ─────────────────────────────────────────
// // SAVE AI-DISCOVERED COMPETITOR (internal)
// // ─────────────────────────────────────────
// export async function saveDiscoveredCompetitor(planId, domain, reason) {
//   try {
//     const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

//     const { data: existing } = await supabase
//       .from("aeo_competitors")
//       .select("id, status, times_seen")
//       .eq("plan_id", planId)
//       .eq("domain", cleanDomain)
//       .maybeSingle();

//     if (existing?.status === "ignored") return;
//     if (existing?.status === "active")  return;

//     const name      = domainToBrandName(cleanDomain);
//     const aliases   = generateAliases(name, cleanDomain);
//     const timesSeen = (existing?.times_seen || 0) + 1;

//     if (existing) {
//       await supabase
//         .from("aeo_competitors")
//         .update({ times_seen: timesSeen })
//         .eq("id", existing.id);
//     } else {
//       await supabase
//         .from("aeo_competitors")
//         .insert({
//           plan_id:          planId,
//           domain:           cleanDomain,
//           name,
//           aliases,
//           source:           "ai_discovered",
//           classification:   "discovered",
//           confidence_score: 0.5,
//           approved:         false,
//           status:           "pending_approval",
//           times_seen:       1,
//           detected_reason:  reason || "Found in AI answers",
//         });
//     }

//     if (timesSeen >= 3) {
//       console.log(`💡 Competitor ready to suggest: ${cleanDomain} (seen ${timesSeen}x)`);
//     }
//   } catch (err) {
//     console.error("Save discovered competitor error:", err);
//   }
// }

// // ─────────────────────────────────────────
// // INTERNAL — trigger Phase 3 when all
// // pending_approval competitors are reviewed
// // ─────────────────────────────────────────
// async function maybeTriggerPhase3(planId) {
//   const { count } = await supabase
//     .from("aeo_competitors")
//     .select("id", { count: "exact", head: true })
//     .eq("plan_id", planId)
//     .eq("status", "pending_approval");

//   if (count > 0) return;

//   const { data: status } = await supabase
//     .from("aeo_pipeline_status")
//     .select("pipeline_phase")
//     .eq("plan_id", planId)
//     .maybeSingle();

//   if (status?.pipeline_phase !== "awaiting_competitor_review") return;

//   console.log("🚀 All competitors reviewed — starting Phase 3:", planId);
//   await runPipelinePhase3(planId);
// }




// import { supabase } from "../../config/supabase.js";
// import { domainToBrandName, generateAliases } from "../../utils/domainToName.js";
// import { runPipelinePhase3 } from "../../jobs/aeoPipeline.job.js";
// import apiResponse from "../../utils/apiResponse.js";

// // ─────────────────────────────────────────
// // TIER LIMITS
// // ─────────────────────────────────────────
// const COMPETITOR_LIMITS = {
//   starter: 10,
//   pro:     20,
//   default: 10,
// };

// async function getPlanTier(planId) {
//   const { data: plan } = await supabase
//     .from("plans")
//     .select("tier, user_id")
//     .eq("id", planId)
//     .single();

//   return {
//     tier:    plan?.tier || "starter",
//     userId:  plan?.user_id,
//     maxComp: COMPETITOR_LIMITS[plan?.tier] || COMPETITOR_LIMITS.default,
//   };
// }

// // ─────────────────────────────────────────
// // ADD SEED COMPETITORS
// // ─────────────────────────────────────────
// export const addSeedCompetitors = async (req, res) => {
//   try {
//     const { planId, domains } = req.body;

//     if (!planId || !Array.isArray(domains) || domains.length < 1) {
//       return res.status(400).json({ error: "At least 1 competitor required" });
//     }

//     const { tier, maxComp } = await getPlanTier(planId);

//     if (domains.length > maxComp) {
//       return res.status(403).json({
//         error:    `Your ${tier} plan allows up to ${maxComp} competitors per project.`,
//         limit:    maxComp,
//         provided: domains.length,
//       });
//     }

//     const { count: existing } = await supabase
//       .from("aeo_competitors")
//       .select("*", { count: "exact", head: true })
//       .eq("plan_id", planId)
//       .eq("approved", true);

//     const available = maxComp - (existing || 0);

//     if (available <= 0) {
//       return res.status(403).json({
//         error:           `You've reached your limit of ${maxComp} competitors.`,
//         limit_reached:   true,
//         current_count:   existing,
//         max_competitors: maxComp,
//       });
//     }

//     const toAdd = domains.slice(0, available);

//     const inserts = toAdd.map((domain) => {
//       const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
//       const name        = domainToBrandName(cleanDomain);
//       const aliases     = generateAliases(name, cleanDomain);

//       return {
//         plan_id:          planId,
//         domain:           cleanDomain,
//         name,
//         aliases,
//         source:           "user",
//         classification:   "direct",
//         confidence_score: 1,
//         approved:         true,
//         status:           "active",
//         detected_reason:  "User-provided seed competitor",
//       };
//     });

//     const { error } = await supabase
//       .from("aeo_competitors")
//       .upsert(inserts, { onConflict: "plan_id,domain" });

//     if (error) throw error;

//     res.json({
//       success:          true,
//       added:            inserts.length,
//       competitors_used: (existing || 0) + inserts.length,
//       competitors_max:  maxComp,
//       remaining:        maxComp - (existing || 0) - inserts.length,
//     });
//   } catch (err) {
//     console.error("Seed competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // GET ALL COMPETITORS FOR A PLAN
// // Includes win / loss / shared stats from aeo_mention_results
// // win    = brand mentioned, competitor NOT (brand wins)
// // loss   = competitor mentioned, brand NOT (brand loses)
// // shared = both mentioned in same answer
// // ─────────────────────────────────────────
// export const getCompetitorsByPlan = async (req, res) => {
//   try {
//     // Support both /competitors/:planId and /competitors?planId=...
//     const planId = req.params.planId ?? req.query.planId;
//     if (!planId) return res.status(400).json({ error: "planId required" });

//     const { tier, maxComp } = await getPlanTier(planId);

//     // Fetch competitors + mention results + answers (for engine) in parallel
//     const [
//       { data: active,      error: activeErr   },
//       { data: suggestions, error: suggestErr  },
//       { data: mentions                        },
//       { data: answers                         },
//     ] = await Promise.all([
//       supabase
//         .from("aeo_competitors")
//         .select("id, name, domain, confidence_score, approved, status, detected_reason, times_seen, source, classification")
//         .eq("plan_id", planId)
//         .eq("approved", true)
//         .neq("status", "ignored")
//         .order("confidence_score", { ascending: false }),

//       supabase
//         .from("aeo_competitors")
//         .select("id, name, domain, confidence_score, detected_reason, times_seen, source")
//         .eq("plan_id", planId)
//         .eq("approved", false)
//         .eq("status", "pending_approval")
//         .order("times_seen", { ascending: false }),

//       supabase
//         .from("aeo_mention_results")
//         .select("answer_id, entity_name, entity_type, mentioned")
//         .eq("plan_id", planId),

//       // engine column tells us which AI gave each answer
//       supabase
//         .from("aeo_ai_answers")
//         .select("id, engine")
//         .eq("plan_id", planId),
//     ]);

//     if (activeErr)  throw activeErr;
//     if (suggestErr) throw suggestErr;

//     // ── answer_id → engine lookup ("chatgpt" | "gemini" | "perplexity") ───
//     const engineByAnswer = {};
//     for (const a of answers ?? []) {
//       if (a.engine) engineByAnswer[a.id] = a.engine;
//     }

//     // ── Group mentions by answer_id ────────────────────────────────────────
//     const byAnswer = {};
//     for (const m of mentions ?? []) {
//       if (!byAnswer[m.answer_id]) byAnswer[m.answer_id] = [];
//       byAnswer[m.answer_id].push(m);
//     }

//     // ── Per-competitor tally — overall AND per-engine ──────────────────────
//     const initSlot = () => ({ wins: 0, losses: 0, shared: 0, total: 0 });
//     const compStats = {};

//     for (const [answerId, answerMentions] of Object.entries(byAnswer)) {
//       const engine         = engineByAnswer[answerId] ?? "unknown";
//       const brandMentioned = answerMentions.some(m => m.entity_type === "brand"      && m.mentioned === true);
//       const mentionedComps = answerMentions.filter(m => m.entity_type === "competitor" && m.mentioned === true).map(m => m.entity_name);
//       const allComps       = answerMentions.filter(m => m.entity_type === "competitor").map(m => m.entity_name);

//       for (const name of allComps) {
//         if (!compStats[name])                compStats[name]                 = { ...initSlot(), engines: {} };
//         if (!compStats[name].engines[engine]) compStats[name].engines[engine] = initSlot();

//         compStats[name].total++;
//         compStats[name].engines[engine].total++;

//         const compMentioned = mentionedComps.includes(name);
//         if (brandMentioned && !compMentioned) {
//           compStats[name].wins++;                    compStats[name].engines[engine].wins++;
//         } else if (!brandMentioned && compMentioned) {
//           compStats[name].losses++;                  compStats[name].engines[engine].losses++;
//         } else if (brandMentioned && compMentioned) {
//           compStats[name].shared++;                  compStats[name].engines[engine].shared++;
//         }
//       }
//     }

//     // ── Shape one stat slot into display-ready object ──────────────────────
//     const shapeSlot = (s) => {
//       const t = s.total || 1;
//       return {
//         wins:        s.wins,
//         losses:      s.losses,
//         shared:      s.shared,
//         total:       s.total,
//         win_rate:    Math.round((s.wins   / t) * 100),
//         loss_rate:   Math.round((s.losses / t) * 100),
//         shared_rate: Math.round((s.shared / t) * 100),
//       };
//     };

//     // ── Enrich each competitor with overall + per-engine breakdown ─────────
//     const ENGINE_ORDER = ["chatgpt", "gemini", "perplexity"];
//     const enrich = (c) => {
//       const name  = c.name || c.domain;
//       const stats = compStats[name] ?? { ...initSlot(), engines: {} };

//       const sortedEngines = [
//         ...ENGINE_ORDER.filter(e => e in stats.engines),
//         ...Object.keys(stats.engines).filter(e => !ENGINE_ORDER.includes(e)),
//       ];

//       const engine_breakdown = sortedEngines.map(engine => ({
//         engine,
//         ...shapeSlot(stats.engines[engine]),
//       }));

//       return {
//         ...c,
//         name,
//         ...shapeSlot(stats),
//         total_answers:    stats.total,
//         engine_breakdown, // [{ engine:"chatgpt", wins:12, losses:0, shared:3, win_rate:80 }, ...]
//       };
//     };

//     // ── Overall brand summary across all answers (total + per engine) ───────
//     let totalWins = 0, totalLosses = 0, totalShared = 0, totalAnswers = 0;
//     const engineSummary = {}; // { chatgpt: { wins,losses,shared,total }, gemini: {...} }

//     for (const [answerId, answerMentions] of Object.entries(byAnswer)) {
//       const engine           = engineByAnswer[answerId] ?? "unknown";
//       const brandMentioned   = answerMentions.some(m => m.entity_type === "brand"      && m.mentioned);
//       const anyCompMentioned = answerMentions.some(m => m.entity_type === "competitor" && m.mentioned);

//       if (!engineSummary[engine]) engineSummary[engine] = initSlot();
//       totalAnswers++;
//       engineSummary[engine].total++;

//       if (brandMentioned && !anyCompMentioned) {
//         totalWins++;                  engineSummary[engine].wins++;
//       } else if (!brandMentioned && anyCompMentioned) {
//         totalLosses++;                engineSummary[engine].losses++;
//       } else if (brandMentioned && anyCompMentioned) {
//         totalShared++;                engineSummary[engine].shared++;
//       }
//     }

//     res.json({
//       competitors:      (active      ?? []).map(enrich),
//       suggestions:      (suggestions ?? []).map(enrich),
//       competitors_used: active?.length || 0,
//       competitors_max:  maxComp,
//       remaining:        maxComp - (active?.length || 0),
//       tier,
//       summary: {
//         wins:    totalWins,
//         losses:  totalLosses,
//         shared:  totalShared,
//         total:   totalAnswers,
//         by_engine: engineSummary,  // { chatgpt: { wins, losses, shared, total }, gemini: { ... } }
//       },
//     });
//   } catch (err) {
//     console.error("Get competitors error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // ADD COMPETITOR MANUALLY
// // ─────────────────────────────────────────
// export const addCompetitor = async (req, res) => {
//   try {
//     const { planId, domain } = req.body;

//     if (!planId || !domain) {
//       return res.status(400).json({ error: "planId and domain required" });
//     }

//     const { tier, maxComp } = await getPlanTier(planId);

//     const { count: existing } = await supabase
//       .from("aeo_competitors")
//       .select("*", { count: "exact", head: true })
//       .eq("plan_id", planId)
//       .eq("approved", true)
//       .neq("status", "ignored");

//     if ((existing || 0) >= maxComp) {
//       return res.status(403).json({
//         error:           `You've reached your limit of ${maxComp} competitors on the ${tier} plan.`,
//         limit_reached:   true,
//         current_count:   existing,
//         max_competitors: maxComp,
//         upgrade_message: tier === "starter"
//           ? "Upgrade to Pro to track up to 20 competitors."
//           : "Contact us for enterprise plans.",
//       });
//     }

//     const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
//     const name        = domainToBrandName(cleanDomain);
//     const aliases     = generateAliases(name, cleanDomain);

//     const { data: dup } = await supabase
//       .from("aeo_competitors")
//       .select("id, status")
//       .eq("plan_id", planId)
//       .eq("domain", cleanDomain)
//       .maybeSingle();

//     if (dup) {
//       if (dup.status === "ignored") {
//         await supabase
//           .from("aeo_competitors")
//           .update({ approved: true, status: "active" })
//           .eq("id", dup.id);
//         return res.json({ success: true, reactivated: true });
//       }
//       return res.status(400).json({ error: "Competitor already exists" });
//     }

//     const { data, error } = await supabase
//       .from("aeo_competitors")
//       .insert({
//         plan_id:          planId,
//         domain:           cleanDomain,
//         name,
//         aliases,
//         source:           "user",
//         classification:   "direct",
//         confidence_score: 1,
//         approved:         true,
//         status:           "active",
//         detected_reason:  "Manually added by user",
//       })
//       .select()
//       .single();

//     if (error) throw error;

//     res.json({
//       success:          true,
//       competitor:       data,
//       competitors_used: (existing || 0) + 1,
//       competitors_max:  maxComp,
//       remaining:        maxComp - (existing || 0) - 1,
//     });
//   } catch (err) {
//     console.error("Add competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // ACCEPT AI SUGGESTION
// // ─────────────────────────────────────────
// export const acceptSuggestedCompetitor = async (req, res) => {
//   try {
//     const { id }     = req.params;
//     const { planId } = req.body;

//     if (!planId) return res.status(400).json({ error: "planId required" });

//     const { error } = await supabase
//       .from("aeo_competitors")
//       .update({ approved: true, status: "active" })
//       .eq("id", id)
//       .eq("plan_id", planId);

//     if (error) return res.status(500).json({ error: "Failed to accept competitor" });

//     res.json({ success: true, message: "Competitor accepted" });

//     setImmediate(() => maybeTriggerPhase3(planId).catch(console.error));
//   } catch (err) {
//     console.error("Accept competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // IGNORE AI SUGGESTION
// // ─────────────────────────────────────────
// export const ignoreSuggestedCompetitor = async (req, res) => {
//   try {
//     const { id }     = req.params;
//     const { planId } = req.body;

//     if (!planId) return res.status(400).json({ error: "planId required" });

//     const { error } = await supabase
//       .from("aeo_competitors")
//       .update({ approved: false, status: "ignored" })
//       .eq("id", id)
//       .eq("plan_id", planId);

//     if (error) return res.status(500).json({ error: "Failed to ignore competitor" });

//     res.json({ success: true, message: "Competitor ignored" });

//     setImmediate(() => maybeTriggerPhase3(planId).catch(console.error));
//   } catch (err) {
//     console.error("Ignore competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // CONFIRM REVIEW — explicit Phase 3 trigger
// // POST /aeo/competitors/confirm-review
// // ─────────────────────────────────────────
// export const confirmCompetitorReview = async (req, res) => {
//   try {
//     const { planId } = req.body;
//     if (!planId) return res.status(400).json({ error: "planId required" });

//     const { data: status } = await supabase
//       .from("aeo_pipeline_status")
//       .select("pipeline_phase")
//       .eq("plan_id", planId)
//       .maybeSingle();

//     if (status?.pipeline_phase !== "awaiting_competitor_review") {
//       return res.json({ success: true, message: "Phase already progressed" });
//     }

//     res.json({ success: true, message: "Phase 3 starting" });

//     setImmediate(() => runPipelinePhase3(planId).catch(console.error));
//   } catch (err) {
//     console.error("confirmCompetitorReview error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // REMOVE COMPETITOR
// // ─────────────────────────────────────────
// export const removeCompetitor = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const { data: comp, error: fetchErr } = await supabase
//       .from("aeo_competitors")
//       .select("id, domain, plan_id, source")
//       .eq("id", id)
//       .single();

//     if (fetchErr || !comp) {
//       return res.status(404).json({ error: "Competitor not found" });
//     }

//     const { error } = await supabase
//       .from("aeo_competitors")
//       .delete()
//       .eq("id", id);

//     if (error) throw error;

//     const { maxComp } = await getPlanTier(comp.plan_id);
//     const { count: remaining } = await supabase
//       .from("aeo_competitors")
//       .select("*", { count: "exact", head: true })
//       .eq("plan_id", comp.plan_id)
//       .eq("approved", true)
//       .neq("status", "ignored");

//     res.json({
//       success:          true,
//       removed:          comp.domain,
//       competitors_used: remaining || 0,
//       competitors_max:  maxComp,
//       slots_freed:      1,
//     });
//   } catch (err) {
//     console.error("Remove competitor error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // ─────────────────────────────────────────
// // APPROVE COMPETITOR (legacy alias)
// // ─────────────────────────────────────────
// export const approveCompetitor = async (req, res) => {
//   return acceptSuggestedCompetitor(req, res);
// };

// // ─────────────────────────────────────────
// // SAVE AI-DISCOVERED COMPETITOR (internal)
// // ─────────────────────────────────────────
// export async function saveDiscoveredCompetitor(planId, domain, reason) {
//   try {
//     const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

//     const { data: existing } = await supabase
//       .from("aeo_competitors")
//       .select("id, status, times_seen")
//       .eq("plan_id", planId)
//       .eq("domain", cleanDomain)
//       .maybeSingle();

//     if (existing?.status === "ignored") return;
//     if (existing?.status === "active")  return;

//     const name      = domainToBrandName(cleanDomain);
//     const aliases   = generateAliases(name, cleanDomain);
//     const timesSeen = (existing?.times_seen || 0) + 1;

//     if (existing) {
//       await supabase
//         .from("aeo_competitors")
//         .update({ times_seen: timesSeen })
//         .eq("id", existing.id);
//     } else {
//       await supabase
//         .from("aeo_competitors")
//         .insert({
//           plan_id:          planId,
//           domain:           cleanDomain,
//           name,
//           aliases,
//           source:           "ai_discovered",
//           classification:   "discovered",
//           confidence_score: 0.5,
//           approved:         false,
//           status:           "pending_approval",
//           times_seen:       1,
//           detected_reason:  reason || "Found in AI answers",
//         });
//     }

//     if (timesSeen >= 3) {
//       console.log(`💡 Competitor ready to suggest: ${cleanDomain} (seen ${timesSeen}x)`);
//     }
//   } catch (err) {
//     console.error("Save discovered competitor error:", err);
//   }
// }

// // ─────────────────────────────────────────
// // INTERNAL — trigger Phase 3 when all
// // pending_approval competitors are reviewed
// // ─────────────────────────────────────────
// async function maybeTriggerPhase3(planId) {
//   const { count } = await supabase
//     .from("aeo_competitors")
//     .select("id", { count: "exact", head: true })
//     .eq("plan_id", planId)
//     .eq("status", "pending_approval");

//   if (count > 0) return;

//   const { data: status } = await supabase
//     .from("aeo_pipeline_status")
//     .select("pipeline_phase")
//     .eq("plan_id", planId)
//     .maybeSingle();

//   if (status?.pipeline_phase !== "awaiting_competitor_review") return;

//   console.log("🚀 All competitors reviewed — starting Phase 3:", planId);
//   await runPipelinePhase3(planId);
// }




import { supabase } from "../../config/supabase.js";
import { domainToBrandName, generateAliases } from "../../utils/domainToName.js";
import { runPipelinePhase3 } from "../../jobs/aeoPipeline.job.js";
import apiResponse from "../../utils/apiResponse.js";

// ─────────────────────────────────────────
// TIER LIMITS
// ─────────────────────────────────────────
const COMPETITOR_LIMITS = {
  starter: 10,
  pro:     20,
  default: 10,
};

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
// ADD SEED COMPETITORS
// ─────────────────────────────────────────
export const addSeedCompetitors = async (req, res) => {
  try {
    const { planId, domains } = req.body;

    if (!planId || !Array.isArray(domains) || domains.length < 1) {
      return res.status(400).json({ error: "At least 1 competitor required" });
    }

    const { tier, maxComp } = await getPlanTier(planId);

    if (domains.length > maxComp) {
      return res.status(403).json({
        error:    `Your ${tier} plan allows up to ${maxComp} competitors per project.`,
        limit:    maxComp,
        provided: domains.length,
      });
    }

    const { count: existing } = await supabase
      .from("aeo_competitors")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", planId)
      .eq("approved", true);

    const available = maxComp - (existing || 0);

    if (available <= 0) {
      return res.status(403).json({
        error:           `You've reached your limit of ${maxComp} competitors.`,
        limit_reached:   true,
        current_count:   existing,
        max_competitors: maxComp,
      });
    }

    const toAdd = domains.slice(0, available);

    const inserts = toAdd.map((domain) => {
      const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      const name        = domainToBrandName(cleanDomain);
      const aliases     = generateAliases(name, cleanDomain);

      return {
        plan_id:          planId,
        domain:           cleanDomain,
        name,
        aliases,
        source:           "user",
        classification:   "direct",
        confidence_score: 1,
        approved:         true,
        status:           "active",
        detected_reason:  "User-provided seed competitor",
      };
    });

    const { error } = await supabase
      .from("aeo_competitors")
      .upsert(inserts, { onConflict: "plan_id,domain" });

    if (error) throw error;

    res.json({
      success:          true,
      added:            inserts.length,
      competitors_used: (existing || 0) + inserts.length,
      competitors_max:  maxComp,
      remaining:        maxComp - (existing || 0) - inserts.length,
    });
  } catch (err) {
    console.error("Seed competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// GET ALL COMPETITORS FOR A PLAN
//
// W/L/S/N definitions (per answer, per competitor):
//   win     = brand ✓  competitor ✗  → brand wins this answer
//   loss    = brand ✗  competitor ✓  → competitor wins this answer
//   shared  = brand ✓  competitor ✓  → both mentioned
//   neither = brand ✗  competitor ✗  → neither mentioned
//
// total = W + L + S + N = total answers tracked
//
// win_rate denominator = total (not just W+L+S)
// so a 20-prompt × 2-engine run = 40 total per competitor
// ─────────────────────────────────────────
// export const getCompetitorsByPlan = async (req, res) => {
//   try {
//     const planId = req.params.planId ?? req.query.planId;
//     if (!planId) return res.status(400).json({ error: "planId required" });

//     const { tier, maxComp } = await getPlanTier(planId);

//     const [
//       { data: active,      error: activeErr   },
//       { data: suggestions, error: suggestErr  },
//       { data: mentions                        },
//       { data: answers                         },
//     ] = await Promise.all([
//       supabase
//         .from("aeo_competitors")
//         .select("id, name, domain, confidence_score, approved, status, detected_reason, times_seen, source, classification")
//         .eq("plan_id", planId)
//         .eq("approved", true)
//         .neq("status", "ignored")
//         .order("confidence_score", { ascending: false }),

//       supabase
//         .from("aeo_competitors")
//         .select("id, name, domain, confidence_score, detected_reason, times_seen, source")
//         .eq("plan_id", planId)
//         .eq("approved", false)
//         .eq("status", "pending_approval")
//         .order("times_seen", { ascending: false }),

//       supabase
//         .from("aeo_mention_results")
//         .select("answer_id, entity_name, entity_type, mentioned")
//         .eq("plan_id", planId),

//       supabase
//         .from("aeo_ai_answers")
//         .select("id, engine")
//         .eq("plan_id", planId),
//     ]);

//     if (activeErr)  throw activeErr;
//     if (suggestErr) throw suggestErr;

//     // ── answer_id → engine lookup ──────────────────────────────────────────
//     const engineByAnswer = {};
//     for (const a of answers ?? []) {
//       if (a.engine) engineByAnswer[a.id] = a.engine;
//     }

//     // Total answers run — the TRUE denominator for all percentages
//     const totalAnswersRun = Object.keys(engineByAnswer).length;

//     // ── Group mentions by answer_id ────────────────────────────────────────
//     const byAnswer = {};
//     for (const m of mentions ?? []) {
//       if (!byAnswer[m.answer_id]) byAnswer[m.answer_id] = [];
//       byAnswer[m.answer_id].push(m);
//     }

//     // ── Build the set of ALL competitor names being tracked ────────────────
//     // We need this so we can count "neither" for answers where a competitor
//     // simply isn't mentioned at all (no row in aeo_mention_results for them)
//     const trackedCompNames = new Set(
//       (active ?? []).map(c => c.name || c.domain)
//     );

//     // ── Per-competitor tally — overall AND per-engine ──────────────────────
//     // wins    = brand ✓  comp ✗
//     // losses  = brand ✗  comp ✓
//     // shared  = brand ✓  comp ✓
//     // neither = brand ✗  comp ✗  ← was silently dropped before, now tracked
//     // total   = W + L + S + N   = totalAnswersRun per competitor
//     const initSlot = () => ({ wins: 0, losses: 0, shared: 0, neither: 0, total: 0 });
//     const compStats = {};

//     // Initialize all tracked competitors so even 0-mention ones appear
//     for (const name of trackedCompNames) {
//       compStats[name] = { ...initSlot(), engines: {} };
//     }

//     for (const [answerId, answerMentions] of Object.entries(byAnswer)) {
//       const engine         = engineByAnswer[answerId] ?? "unknown";
//       const brandMentioned = answerMentions.some(m => m.entity_type === "brand"       && m.mentioned === true);
//       const mentionedComps = new Set(
//         answerMentions
//           .filter(m => m.entity_type === "competitor" && m.mentioned === true)
//           .map(m => m.entity_name)
//       );
//       // All comp names that have a mention row for this answer
//       const seenComps = new Set(
//         answerMentions
//           .filter(m => m.entity_type === "competitor")
//           .map(m => m.entity_name)
//       );

//       // Process every tracked competitor for this answer
//       for (const name of trackedCompNames) {
//         if (!compStats[name])                  compStats[name]                  = { ...initSlot(), engines: {} };
//         if (!compStats[name].engines[engine])  compStats[name].engines[engine]  = initSlot();

//         compStats[name].total++;
//         compStats[name].engines[engine].total++;

//         const compMentioned = mentionedComps.has(name);

//         if      ( brandMentioned && !compMentioned) { compStats[name].wins++;    compStats[name].engines[engine].wins++;    }
//         else if (!brandMentioned &&  compMentioned) { compStats[name].losses++;  compStats[name].engines[engine].losses++;  }
//         else if ( brandMentioned &&  compMentioned) { compStats[name].shared++;  compStats[name].engines[engine].shared++;  }
//         else                                        { compStats[name].neither++; compStats[name].engines[engine].neither++; }
//       }
//     }

//     // ── Shape one stat slot ────────────────────────────────────────────────
//     // Denominator = total (W+L+S+N) so rates always sum correctly
//     const shapeSlot = (s) => {
//       const t = s.total || 1;
//       return {
//         wins:          s.wins,
//         losses:        s.losses,
//         shared:        s.shared,
//         neither:       s.neither,
//         total:         s.total,
//         // win_rate = wins / total (not wins / (wins+losses))
//         win_rate:      Math.round((s.wins    / t) * 100),
//         loss_rate:     Math.round((s.losses  / t) * 100),
//         shared_rate:   Math.round((s.shared  / t) * 100),
//         neither_rate:  Math.round((s.neither / t) * 100),
//       };
//     };

//     // ── Enrich each competitor ─────────────────────────────────────────────
//     const ENGINE_ORDER = ["chatgpt", "gemini", "perplexity"];
//     const enrich = (c) => {
//       const name   = c.name || c.domain;
//       const stats  = compStats[name] ?? { ...initSlot(), engines: {} };

//       const sortedEngines = [
//         ...ENGINE_ORDER.filter(e => e in stats.engines),
//         ...Object.keys(stats.engines).filter(e => !ENGINE_ORDER.includes(e)),
//       ];

//       const engine_breakdown = sortedEngines.map(engine => ({
//         engine,
//         ...shapeSlot(stats.engines[engine]),
//       }));

//       // FIX: "Seen X× in AI answers" should reflect actual mention count
//       // not times_seen (which only counts discovery events for new competitors)
//       const actualMentionCount = stats.wins + stats.losses + stats.shared;

//       return {
//         ...c,
//         name,
//         ...shapeSlot(stats),
//         total_answers:        stats.total,
//         actual_mention_count: actualMentionCount,  // ← use this for "Seen X× in AI answers"
//         engine_breakdown,
//       };
//     };

//     // ── Overall brand summary ──────────────────────────────────────────────
//     // Wins/losses/shared at the BRAND level (not per competitor)
//     // An answer is a win if brand mentioned and NO competitor mentioned
//     let totalWins = 0, totalLosses = 0, totalShared = 0, totalNeither = 0;
//     const engineSummary = {};

//     for (const [answerId, answerMentions] of Object.entries(byAnswer)) {
//       const engine           = engineByAnswer[answerId] ?? "unknown";
//       const brandMentioned   = answerMentions.some(m => m.entity_type === "brand"       && m.mentioned);
//       const anyCompMentioned = answerMentions.some(m => m.entity_type === "competitor"  && m.mentioned);

//       if (!engineSummary[engine]) engineSummary[engine] = initSlot();
//       engineSummary[engine].total++;

//       if      ( brandMentioned && !anyCompMentioned) { totalWins++;    engineSummary[engine].wins++;    }
//       else if (!brandMentioned &&  anyCompMentioned) { totalLosses++;  engineSummary[engine].losses++;  }
//       else if ( brandMentioned &&  anyCompMentioned) { totalShared++;  engineSummary[engine].shared++;  }
//       else                                           { totalNeither++; engineSummary[engine].neither++; }
//     }

//     const answersWithData = Object.keys(byAnswer).length;

//     res.json({
//       competitors:      (active      ?? []).map(enrich),
//       suggestions:      (suggestions ?? []).map(enrich),
//       competitors_used: active?.length || 0,
//       competitors_max:  maxComp,
//       remaining:        maxComp - (active?.length || 0),
//       tier,
//       summary: {
//         wins:             totalWins,
//         losses:           totalLosses,
//         shared:           totalShared,
//         neither:          totalNeither,
//         total:            answersWithData,      // answers that have mention data
//         total_answers_run: totalAnswersRun,     // total AI answers ever run
//         by_engine:        engineSummary,
//       },
//     });
//   } catch (err) {
//     console.error("Get competitors error:", err);
//     res.status(500).json({ error: err.message });
//   }
// };



export const getCompetitorsByPlan = async (req, res) => {
  try {
    const planId = req.params.planId ?? req.query.planId;
    if (!planId) return res.status(400).json({ error: "planId required" });

    const { tier, maxComp } = await getPlanTier(planId);

    const [
      { data: active,      error: activeErr   },
      { data: suggestions, error: suggestErr  },
      { data: mentions                        },
      { data: rawAnswers                      },
    ] = await Promise.all([
      supabase
        .from("aeo_competitors")
        .select("id, name, domain, confidence_score, approved, status, detected_reason, times_seen, source, classification")
        .eq("plan_id", planId)
        .eq("approved", true)
        .neq("status", "ignored")
        .order("confidence_score", { ascending: false }),

      supabase
        .from("aeo_competitors")
        .select("id, name, domain, confidence_score, detected_reason, times_seen, source")
        .eq("plan_id", planId)
        .eq("approved", false)
        .eq("status", "pending_approval")
        .order("times_seen", { ascending: false }),

      supabase
        .from("aeo_mention_results")
        .select("answer_id, entity_name, entity_type, mentioned")
        .eq("plan_id", planId),

      // ── Fetch with prompt_id + created_at so we can deduplicate ──────────
      supabase
        .from("aeo_ai_answers")
        .select("id, engine, prompt_id, created_at")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false }), // DESC → first seen = latest
    ]);

    if (activeErr)  throw activeErr;
    if (suggestErr) throw suggestErr;

    // ── Deduplicate: keep only the LATEST answer per (prompt_id, engine) ───
    // Without this, re-running the pipeline doubles (or triples) the counts.
    const seenKeys = {};
    const answers  = [];
    for (const a of rawAnswers ?? []) {
      if (!a.prompt_id || !a.engine) continue;
      const key = `${a.prompt_id}:${a.engine}`;
      if (!seenKeys[key]) {
        seenKeys[key] = true;
        answers.push(a);
      }
    }

    // ── answer_id → engine lookup (deduped only) ───────────────────────────
    const engineByAnswer = {};
    for (const a of answers) {
      engineByAnswer[a.id] = a.engine;
    }

    const totalAnswersRun = answers.length; // 20 prompts × 2 engines = 40

    // ── Filter mentions to deduped answer IDs only ─────────────────────────
    const validAnswerIds = new Set(answers.map(a => a.id));

    const byAnswer = {};
    for (const m of mentions ?? []) {
      if (!validAnswerIds.has(m.answer_id)) continue; // skip stale answers
      if (!byAnswer[m.answer_id]) byAnswer[m.answer_id] = [];
      byAnswer[m.answer_id].push(m);
    }

    // ── Build the set of ALL competitor names being tracked ────────────────
    const trackedCompNames = new Set(
      (active ?? []).map(c => c.name || c.domain)
    );

    const initSlot = () => ({ wins: 0, losses: 0, shared: 0, neither: 0, total: 0 });
    const compStats = {};

    for (const name of trackedCompNames) {
      compStats[name] = { ...initSlot(), engines: {} };
    }

    for (const [answerId, answerMentions] of Object.entries(byAnswer)) {
      const engine         = engineByAnswer[answerId] ?? "unknown";
      const brandMentioned = answerMentions.some(m => m.entity_type === "brand"      && m.mentioned === true);
      const mentionedComps = new Set(
        answerMentions
          .filter(m => m.entity_type === "competitor" && m.mentioned === true)
          .map(m => m.entity_name)
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
        wins:         s.wins,
        losses:       s.losses,
        shared:       s.shared,
        neither:      s.neither,
        total:        s.total,
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

      const engine_breakdown = sortedEngines.map(engine => ({
        engine,
        ...shapeSlot(stats.engines[engine]),
      }));

      const actualMentionCount = stats.wins + stats.losses + stats.shared;

      return {
        ...c,
        name,
        ...shapeSlot(stats),
        total_answers:        stats.total,
        actual_mention_count: actualMentionCount,
        engine_breakdown,
      };
    };

    // ── Overall brand summary ──────────────────────────────────────────────
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

    const answersWithData = Object.keys(byAnswer).length;

    res.json({
      competitors:      (active      ?? []).map(enrich),
      suggestions:      (suggestions ?? []).map(enrich),
      competitors_used: active?.length || 0,
      competitors_max:  maxComp,
      remaining:        maxComp - (active?.length || 0),
      tier,
      summary: {
        wins:              totalWins,
        losses:            totalLosses,
        shared:            totalShared,
        neither:           totalNeither,
        total:             answersWithData,
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
// ADD COMPETITOR MANUALLY
// ─────────────────────────────────────────
export const addCompetitor = async (req, res) => {
  try {
    const { planId, domain } = req.body;

    if (!planId || !domain) {
      return res.status(400).json({ error: "planId and domain required" });
    }

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
        upgrade_message: tier === "starter"
          ? "Upgrade to Pro to track up to 20 competitors."
          : "Contact us for enterprise plans.",
      });
    }

    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const name        = domainToBrandName(cleanDomain);
    const aliases     = generateAliases(name, cleanDomain);

    const { data: dup } = await supabase
      .from("aeo_competitors")
      .select("id, status")
      .eq("plan_id", planId)
      .eq("domain", cleanDomain)
      .maybeSingle();

    if (dup) {
      if (dup.status === "ignored") {
        await supabase
          .from("aeo_competitors")
          .update({ approved: true, status: "active" })
          .eq("id", dup.id);
        return res.json({ success: true, reactivated: true });
      }
      return res.status(400).json({ error: "Competitor already exists" });
    }

    const { data, error } = await supabase
      .from("aeo_competitors")
      .insert({
        plan_id:          planId,
        domain:           cleanDomain,
        name,
        aliases,
        source:           "user",
        classification:   "direct",
        confidence_score: 1,
        approved:         true,
        status:           "active",
        detected_reason:  "Manually added by user",
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success:          true,
      competitor:       data,
      competitors_used: (existing || 0) + 1,
      competitors_max:  maxComp,
      remaining:        maxComp - (existing || 0) - 1,
    });
  } catch (err) {
    console.error("Add competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// ACCEPT AI SUGGESTION
// ─────────────────────────────────────────
export const acceptSuggestedCompetitor = async (req, res) => {
  try {
    const { id }     = req.params;
    const { planId } = req.body;

    if (!planId) return res.status(400).json({ error: "planId required" });

    const { error } = await supabase
      .from("aeo_competitors")
      .update({ approved: true, status: "active" })
      .eq("id", id)
      .eq("plan_id", planId);

    if (error) return res.status(500).json({ error: "Failed to accept competitor" });

    res.json({ success: true, message: "Competitor accepted" });

    setImmediate(() => maybeTriggerPhase3(planId).catch(console.error));
  } catch (err) {
    console.error("Accept competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// IGNORE AI SUGGESTION
// ─────────────────────────────────────────
export const ignoreSuggestedCompetitor = async (req, res) => {
  try {
    const { id }     = req.params;
    const { planId } = req.body;

    if (!planId) return res.status(400).json({ error: "planId required" });

    const { error } = await supabase
      .from("aeo_competitors")
      .update({ approved: false, status: "ignored" })
      .eq("id", id)
      .eq("plan_id", planId);

    if (error) return res.status(500).json({ error: "Failed to ignore competitor" });

    res.json({ success: true, message: "Competitor ignored" });

    setImmediate(() => maybeTriggerPhase3(planId).catch(console.error));
  } catch (err) {
    console.error("Ignore competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// CONFIRM REVIEW
// ─────────────────────────────────────────
export const confirmCompetitorReview = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: "planId required" });

    const { data: status } = await supabase
      .from("aeo_pipeline_status")
      .select("pipeline_phase")
      .eq("plan_id", planId)
      .maybeSingle();

    if (status?.pipeline_phase !== "awaiting_competitor_review") {
      return res.json({ success: true, message: "Phase already progressed" });
    }

    res.json({ success: true, message: "Phase 3 starting" });

    setImmediate(() => runPipelinePhase3(planId).catch(console.error));
  } catch (err) {
    console.error("confirmCompetitorReview error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// REMOVE COMPETITOR
// ─────────────────────────────────────────
export const removeCompetitor = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: comp, error: fetchErr } = await supabase
      .from("aeo_competitors")
      .select("id, domain, plan_id, source")
      .eq("id", id)
      .single();

    if (fetchErr || !comp) {
      return res.status(404).json({ error: "Competitor not found" });
    }

    const { error } = await supabase
      .from("aeo_competitors")
      .delete()
      .eq("id", id);

    if (error) throw error;

    const { maxComp } = await getPlanTier(comp.plan_id);
    const { count: remaining } = await supabase
      .from("aeo_competitors")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", comp.plan_id)
      .eq("approved", true)
      .neq("status", "ignored");

    res.json({
      success:          true,
      removed:          comp.domain,
      competitors_used: remaining || 0,
      competitors_max:  maxComp,
      slots_freed:      1,
    });
  } catch (err) {
    console.error("Remove competitor error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// APPROVE COMPETITOR (legacy alias)
// ─────────────────────────────────────────
export const approveCompetitor = async (req, res) => {
  return acceptSuggestedCompetitor(req, res);
};

// ─────────────────────────────────────────
// SAVE AI-DISCOVERED COMPETITOR (internal)
// ─────────────────────────────────────────
export async function saveDiscoveredCompetitor(planId, domain, reason) {
  try {
    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

    const { data: existing } = await supabase
      .from("aeo_competitors")
      .select("id, status, times_seen")
      .eq("plan_id", planId)
      .eq("domain", cleanDomain)
      .maybeSingle();

    if (existing?.status === "ignored") return;
    if (existing?.status === "active")  return;

    const name      = domainToBrandName(cleanDomain);
    const aliases   = generateAliases(name, cleanDomain);
    const timesSeen = (existing?.times_seen || 0) + 1;

    if (existing) {
      await supabase
        .from("aeo_competitors")
        .update({ times_seen: timesSeen })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("aeo_competitors")
        .insert({
          plan_id:          planId,
          domain:           cleanDomain,
          name,
          aliases,
          source:           "ai_discovered",
          classification:   "discovered",
          confidence_score: 0.5,
          approved:         false,
          status:           "pending_approval",
          times_seen:       1,
          detected_reason:  reason || "Found in AI answers",
        });
    }
  } catch (err) {
    console.error("Save discovered competitor error:", err);
  }
}

// ─────────────────────────────────────────
// INTERNAL — trigger Phase 3
// ─────────────────────────────────────────
async function maybeTriggerPhase3(planId) {
  const { count } = await supabase
    .from("aeo_competitors")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId)
    .eq("status", "pending_approval");

  if (count > 0) return;

  const { data: status } = await supabase
    .from("aeo_pipeline_status")
    .select("pipeline_phase")
    .eq("plan_id", planId)
    .maybeSingle();

  if (status?.pipeline_phase !== "awaiting_competitor_review") return;

  console.log("🚀 All competitors reviewed — starting Phase 3:", planId);
  await runPipelinePhase3(planId);
}