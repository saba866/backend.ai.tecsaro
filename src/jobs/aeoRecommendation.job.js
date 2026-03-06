



// import { supabase } from "../config/supabase.js";
// import { askAI } from "../services/aeo/index.js";
// import { safeJsonParse } from "../utils/aiJson.js";

// // ─────────────────────────────────────────
// // PATTERN CLASSIFIER
// //
// // Pattern 1: brand:false, competitors:none  → "missed"
// //   AI has no association between brand and this query
// //
// // Pattern 2: brand:false, competitors:yes   → "losing"
// //   Competitors winning, brand completely invisible
// //
// // Pattern 3: brand:true, competitors:yes    → "competing"
// //   Brand appears but not winning — ranks below competitors
// //
// // Pattern 4: brand:true, competitors:no     → "winning"
// //   Brand winning — protect + expand to adjacent queries
// // ─────────────────────────────────────────
// function classifyPattern(gap) {
//   const reasons       = Array.isArray(gap.gap_reasons) ? gap.gap_reasons : [];
//   const competitors   = Array.isArray(gap.competitor_positions) && gap.competitor_positions.length > 0;
//   const brandMissing  = reasons.includes("brand_not_mentioned");
//   const competitorWin = reasons.includes("competitor_dominates");

//   if (!brandMissing && !competitorWin) return "winning";
//   if (!brandMissing && competitorWin)  return "competing";
//   if (brandMissing  && competitorWin)  return "losing";
//   return "missed"; // brandMissing && !competitorWin
// }

// // ─────────────────────────────────────────
// // PRIORITY SCORER
// // ─────────────────────────────────────────
// function scorePriority(pattern, gap) {
//   const competitorCount = Array.isArray(gap.competitor_positions)
//     ? gap.competitor_positions.length
//     : 0;

//   if (pattern === "missed")    return "high";
//   if (pattern === "losing")    return competitorCount >= 2 ? "high" : "medium";
//   if (pattern === "competing") return "medium";
//   if (pattern === "winning")   return "low";
//   return "medium";
// }

// // ─────────────────────────────────────────
// // MAP PATTERN → TYPE (for DB + frontend filtering)
// // ─────────────────────────────────────────
// function patternToType(pattern) {
//   const map = {
//     missed:    "content_creation",
//     losing:    "comparison_content",
//     competing: "authority_building",
//     winning:   "protect_and_expand",
//   };
//   return map[pattern] || "content_creation";
// }

// // ─────────────────────────────────────────
// // STATIC FALLBACK RECOMMENDATIONS
// // Used when AI call fails or returns bad data.
// // Still specific and actionable — not generic.
// // ─────────────────────────────────────────
// function staticRecommendation(gap, pattern, brandName, topCompetitor) {
//   const q = gap.prompt;
//   const c = topCompetitor || "competitors";

//   const map = {
//     missed: {
//       summary: `AI engines don't associate your brand with "${q}" — no content on your site directly answers this question.`,
//       actions: [
//         {
//           timeframe: "immediate",
//           action: "Add category schema markup",
//           detail: `Add structured data to your homepage that signals the category of "${q}" — tells AI engines exactly what problem your brand solves`,
//         },
//         {
//           timeframe: "immediate",
//           action: "Update homepage heading",
//           detail: `Add the core topic of "${q}" into your homepage H1 or H2 tag — AI engines weight headings heavily as category signals`,
//         },
//         {
//           timeframe: "short_term",
//           action: "Create a dedicated content page",
//           detail: `Write a page that directly answers "${q}" — minimum 800 words, mention your brand in the first paragraph, compare yourself to top alternatives`,
//         },
//         {
//           timeframe: "ongoing",
//           action: "Build external mentions",
//           detail: `Get mentioned in listicles and review sites (G2, Capterra, Trustpilot) for the specific use case in this query`,
//         },
//       ],
//       expected_impact: "Brand begins appearing in AI answers within 4-8 weeks of implementation",
//       estimated_weeks: 6,
//     },

//     losing: {
//       summary: `${c} is winning "${q}" — your brand is invisible while competitors dominate this query.`,
//       actions: [
//         {
//           timeframe: "immediate",
//           action: "Add topic to homepage heading",
//           detail: `Include the core topic of "${q}" in your homepage H1 or H2 — AI reads headings as strong positioning signals`,
//         },
//         {
//           timeframe: "short_term",
//           action: "Create a competitor comparison page",
//           detail: `Write "Your Brand vs ${c} — Which is better for [use case]?" — minimum 1000 words, clear verdict with evidence, real customer quotes`,
//         },
//         {
//           timeframe: "short_term",
//           action: "Close the content gap",
//           detail: `Analyze what content ${c} has for this topic — create equivalent or better content on your site targeting the same query`,
//         },
//         {
//           timeframe: "ongoing",
//           action: "Get added to comparison articles",
//           detail: `Find existing "${q}" articles and ask authors to include your brand — offer a quote, a demo, or a unique data point`,
//         },
//       ],
//       expected_impact: `Start appearing alongside ${c} in shared AI answers within 3-6 weeks`,
//       estimated_weeks: 5,
//     },

//     competing: {
//       summary: `Your brand appears in AI answers for "${q}" but ranks below ${c} — authority signals need strengthening.`,
//       actions: [
//         {
//           timeframe: "immediate",
//           action: "Add use-case testimonials",
//           detail: `Add customer testimonials that specifically mention this use case to your homepage and key product pages — AI engines weight social proof heavily`,
//         },
//         {
//           timeframe: "immediate",
//           action: "Sharpen niche positioning",
//           detail: `Instead of competing broadly, claim a specific angle for this query — "the [adjective] solution for [specific audience]" gets stronger AI recommendations`,
//         },
//         {
//           timeframe: "short_term",
//           action: "Launch external mention campaign",
//           detail: `Target 10 new relevant articles this month — offer expert quotes to bloggers, submit to roundup posts, get listed in comparison articles`,
//         },
//         {
//           timeframe: "ongoing",
//           action: "Build review volume for this use case",
//           detail: `Ask customers to review you on G2/Capterra specifically mentioning this use case — reference the use case directly in your review request email`,
//         },
//       ],
//       expected_impact: "Move from option 3-4 to option 1-2 in AI answers within 6-8 weeks",
//       estimated_weeks: 7,
//     },

//     winning: {
//       summary: `Your brand is winning "${q}" — protect this position and expand to adjacent queries before competitors close the gap.`,
//       actions: [
//         {
//           timeframe: "protect",
//           action: "Keep content fresh",
//           detail: `Update your content targeting "${q}" every 6-8 weeks — add new customer stories, refresh stats, update examples with current data`,
//         },
//         {
//           timeframe: "protect",
//           action: "Add FAQ schema",
//           detail: `Add FAQ structured data to this page answering "Is your brand good for [use case]?" and "How does your brand compare for [use case]?" — becomes direct AI answer source`,
//         },
//         {
//           timeframe: "expand",
//           action: "Target adjacent queries now",
//           detail: `Create content for query variations — add specificity (audience segment, team size, budget range) to expand AI coverage before competitors do`,
//         },
//         {
//           timeframe: "expand",
//           action: "Publish a customer case study",
//           detail: `Publish 1-2 detailed case studies specifically for this use case — structured case studies are frequently cited verbatim in AI answers`,
//         },
//       ],
//       expected_impact: "Maintain current wins and expand to 3-5 adjacent queries within 4 weeks",
//       estimated_weeks: 4,
//     },
//   };

//   return map[pattern] || map.missed;
// }

// // ─────────────────────────────────────────
// // AI RECOMMENDATION GENERATOR
// // Builds a personalized prompt and calls AI.
// // Falls back to static if AI fails.
// // ─────────────────────────────────────────
// async function generateRecommendation(gap, pattern, brandName, topCompetitor) {
//   const competitorList = Array.isArray(gap.competitor_positions)
//     ? gap.competitor_positions.map((c) => c.name).filter(Boolean).join(", ")
//     : "none";

//   const patternContext = {
//     missed:    `Brand is completely invisible — AI doesn't associate it with this query at all. No competitors winning either — this is an open opportunity.`,
//     losing:    `Competitor(s) (${competitorList}) are winning this query. Brand not appearing at all.`,
//     competing: `Brand appears in AI answers but ranks below competitors (${competitorList}). Not winning.`,
//     winning:   `Brand is winning this query. Appears first or alone in AI answers. Need to protect and expand.`,
//   };

//   const actionStructure = {
//     missed:    `IMMEDIATE (this week), SHORT_TERM (2-4 weeks), ONGOING`,
//     losing:    `IMMEDIATE (this week), SHORT_TERM (2-4 weeks), ONGOING`,
//     competing: `IMMEDIATE (this week), SHORT_TERM (2-4 weeks), ONGOING`,
//     winning:   `PROTECT (keep winning), EXPAND (adjacent queries)`,
//   };

//   const aiPrompt = `
// You are an AEO (Answer Engine Optimization) expert. Help "${brandName}" improve AI search visibility.

// QUERY BEING ANALYZED: "${gap.prompt}"
// SITUATION: ${patternContext[pattern]}
// TOP COMPETITOR: ${topCompetitor || "none"}

// Generate specific, actionable recommendations using this timeframe structure: ${actionStructure[pattern]}

// STRICT RULES:
// - Be hyper-specific. Not "create content" but "Create a page titled exactly: [specific title]"
// - Include word counts, specific schema types, specific platforms by name
// - Include realistic timeline in weeks
// - Do NOT mention the brand name — use "your brand" instead
// - Keep each action under 30 words
// - Generate exactly 4 actions total

// Return ONLY valid JSON, no markdown, no explanation:
// {
//   "summary": "One sentence diagnosis of why brand is missing/winning for this exact query",
//   "actions": [
//     {
//       "timeframe": "immediate|short_term|ongoing|protect|expand",
//       "action": "Short action title (5 words max)",
//       "detail": "Specific detail — exact page title, schema type, platform name, word count"
//     }
//   ],
//   "expected_impact": "Specific result with timeframe e.g. Brand appears in AI answers within 4-6 weeks",
//   "estimated_weeks": 5
// }
// `;

//   try {
//     const raw = await askAI(aiPrompt, { max_tokens: 500 });
//     const parsed = safeJsonParse(raw);

//     if (
//       parsed?.summary &&
//       Array.isArray(parsed?.actions) &&
//       parsed.actions.length >= 2
//     ) {
//       return { data: parsed, source: "ai" };
//     }

//     throw new Error("Invalid response structure");
//   } catch (err) {
//     console.warn(`      ⚠️  AI failed (${err.message}) — using static fallback`);
//     return {
//       data: staticRecommendation(gap, pattern, brandName, topCompetitor),
//       source: "static",
//     };
//   }
// }

// // ─────────────────────────────────────────
// // BUILD FLAT MESSAGE (backward compat)
// // Some API consumers may still read the
// // plain `message` field — keep it populated.
// // ─────────────────────────────────────────
// function buildFlatMessage(recData, pattern, query, topCompetitor) {
//   const c = topCompetitor || "competitors";
//   const prefixes = {
//     missed:    `Your brand is not appearing when AI answers: "${query}".`,
//     losing:    `${c} is winning "${query}" — your brand is invisible.`,
//     competing: `Your brand appears for "${query}" but isn't winning.`,
//     winning:   `Your brand is winning "${query}" — protect and expand.`,
//   };

//   const prefix = prefixes[pattern] || prefixes.missed;
//   const firstAction = recData.actions?.[0];
//   const detail = firstAction
//     ? ` ${firstAction.action}: ${firstAction.detail}`
//     : "";

//   return `${prefix}${detail} ${recData.expected_impact || ""}`.trim();
// }

// // ─────────────────────────────────────────
// // MAIN — RUN RECOMMENDATION JOB
// //
// // FLOW:
// // 1. Load plan + brand name
// // 2. Load all gaps for this plan
// // 3. For each gap:
// //    a. Classify pattern
// //    b. Score priority
// //    c. Generate AI recommendation (with fallback)
// //    d. Build full recommendation record
// // 4. Delete old recommendations
// // 5. Insert fresh batch
// // 6. Update plan with recommendation count + timestamp
// // ─────────────────────────────────────────
// export async function runRecommendationJob(planId) {
//   console.log("\n🧠 [RecommendationJob] Starting for plan:", planId);

//   // ── STEP 1: LOAD PLAN ──
//   const { data: plan, error: planErr } = await supabase
//     .from("plans")
//     .select("id, name, website_url, tier")
//     .eq("id", planId)
//     .single();

//   if (planErr || !plan) {
//     console.error("❌ Plan not found:", planErr?.message);
//     return;
//   }

//   const brandName = plan.name || "your brand";
//   console.log(`📋 Plan: "${brandName}" | Tier: ${plan.tier}`);

//   // ── STEP 2: LOAD GAPS ──
//   const { data: gaps, error: gapsErr } = await supabase
//     .from("aeo_gaps")
//     .select("*")
//     .eq("plan_id", planId)
//     .order("created_at", { ascending: false });

//   if (gapsErr) {
//     console.error("❌ Failed to fetch gaps:", gapsErr.message);
//     return;
//   }

//   if (!gaps?.length) {
//     console.log("⚠️  No gaps found — skipping recommendations");
//     return;
//   }

//   console.log(`📊 Found ${gaps.length} gaps to process`);

//   // ── STEP 3: PROCESS EACH GAP ──
//   const recommendations = [];
//   let aiCount     = 0;
//   let staticCount = 0;

//   for (const gap of gaps) {
//     const pattern       = classifyPattern(gap);
//     const priority      = scorePriority(pattern, gap);
//     const competitors   = Array.isArray(gap.competitor_positions) ? gap.competitor_positions : [];
//     const topCompetitor = competitors[0]?.name || null;

//     console.log(`\n   🔍 "${gap.prompt}"`);
//     console.log(`      Pattern: ${pattern} | Priority: ${priority} | Competitor: ${topCompetitor || "none"}`);

//     const { data: recData, source } = await generateRecommendation(
//       gap,
//       pattern,
//       brandName,
//       topCompetitor
//     );

//     source === "ai" ? aiCount++ : staticCount++;
//     console.log(`      ${source === "ai" ? "✅ AI" : "⚡ Static"} recommendation ready`);

//     recommendations.push({
//       plan_id:          planId,
//       gap_id:           gap.id,
//       prompt:           gap.prompt,
//       pattern:          pattern,
//       priority:         priority,
//       type:             patternToType(pattern),

//       // Structured content — used by dashboard UI
//       summary:          recData.summary,
//       actions:          recData.actions,           // JSONB array
//       expected_impact:  recData.expected_impact,
//       estimated_weeks:  recData.estimated_weeks || 4,

//       // Flat message — backward compat for any existing API consumers
//       message: buildFlatMessage(recData, pattern, gap.prompt, topCompetitor),

//       // Meta
//       top_competitor:   topCompetitor,
//       competitor_count: competitors.length,
//       rec_source:       source,                    // "ai" | "static"
//       status:           "active",
//       created_at:       new Date().toISOString(),
//     });
//   }

//   if (!recommendations.length) {
//     console.log("ℹ️  No recommendations to insert");
//     return;
//   }

//   // ── STEP 4: DELETE OLD RECOMMENDATIONS ──
//   const { error: deleteErr } = await supabase
//     .from("aeo_recommendations")
//     .delete()
//     .eq("plan_id", planId);

//   if (deleteErr) {
//     console.error("❌ Failed to clear old recommendations:", deleteErr.message);
//     return;
//   }

//   // ── STEP 5: INSERT IN BATCHES (avoid hitting Supabase row limits) ──
//   const BATCH_SIZE = 20;
//   let insertedTotal = 0;

//   for (let i = 0; i < recommendations.length; i += BATCH_SIZE) {
//     const batch = recommendations.slice(i, i + BATCH_SIZE);

//     const { error: insertErr } = await supabase
//       .from("aeo_recommendations")
//       .insert(batch);

//     if (insertErr) {
//       console.error(`❌ Batch insert failed (offset ${i}):`, insertErr.message);
//     } else {
//       insertedTotal += batch.length;
//     }
//   }

//   // ── STEP 6: UPDATE PLAN STATS ──
//   await supabase
//     .from("plans")
//     .update({
//       recommendations_count:      insertedTotal,
//       recommendations_updated_at: new Date().toISOString(),
//     })
//     .eq("id", planId);

//   // ── SUMMARY ──
//   const highCount   = recommendations.filter((r) => r.priority === "high").length;
//   const mediumCount = recommendations.filter((r) => r.priority === "medium").length;
//   const lowCount    = recommendations.filter((r) => r.priority === "low").length;

//   console.log(`\n✅ [RecommendationJob] Complete`);
//   console.log(`   Inserted:  ${insertedTotal} recommendations`);
//   console.log(`   AI-powered: ${aiCount} | Static fallback: ${staticCount}`);
//   console.log(`   High: ${highCount} | Medium: ${mediumCount} | Low: ${lowCount}`);
// }



// import { supabase }      from "../config/supabase.js";
// import { askAI }         from "../services/aeo/index.js";
// import { safeJsonParse } from "../utils/aiJson.js";

// const BATCH_SIZE = 8; // gaps processed in parallel
// const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// // ─────────────────────────────────────────
// // PATTERN CLASSIFIER
// // ─────────────────────────────────────────
// function classifyPattern(gap) {
//   const reasons      = Array.isArray(gap.gap_reasons) ? gap.gap_reasons : [];
//   const competitors  = Array.isArray(gap.competitor_positions) && gap.competitor_positions.length > 0;
//   const brandMissing = reasons.includes("brand_not_mentioned");
//   const compWin      = reasons.includes("competitor_dominates");

//   if (!brandMissing && !compWin) return "winning";
//   if (!brandMissing &&  compWin) return "competing";
//   if ( brandMissing &&  compWin) return "losing";
//   return "missed";
// }

// function scorePriority(pattern, gap) {
//   const competitorCount = Array.isArray(gap.competitor_positions) ? gap.competitor_positions.length : 0;
//   if (pattern === "missed")    return "high";
//   if (pattern === "losing")    return competitorCount >= 2 ? "high" : "medium";
//   if (pattern === "competing") return "medium";
//   if (pattern === "winning")   return "low";
//   return "medium";
// }

// function patternToType(pattern) {
//   return { missed: "content_creation", losing: "comparison_content", competing: "authority_building", winning: "protect_and_expand" }[pattern] || "content_creation";
// }

// // ─────────────────────────────────────────
// // STATIC FALLBACK
// // ─────────────────────────────────────────
// function staticRecommendation(gap, pattern, brandName, topCompetitor) {
//   const q = gap.prompt;
//   const c = topCompetitor || "competitors";

//   const map = {
//     missed: {
//       summary: `AI engines don't associate your brand with "${q}" — no content directly answers this question.`,
//       actions: [
//         { timeframe: "immediate",   action: "Add category schema markup",   detail: `Add structured data signalling the category of "${q}" to your homepage` },
//         { timeframe: "immediate",   action: "Update homepage heading",       detail: `Add the core topic of "${q}" into your H1 or H2 tag` },
//         { timeframe: "short_term",  action: "Create a dedicated content page", detail: `Write 800+ words directly answering "${q}" — mention brand in first paragraph` },
//         { timeframe: "ongoing",     action: "Build external mentions",       detail: `Get listed on G2, Capterra, Trustpilot for the use case in this query` },
//       ],
//       expected_impact: "Brand begins appearing in AI answers within 4-8 weeks",
//       estimated_weeks: 6,
//     },
//     losing: {
//       summary: `${c} is winning "${q}" — your brand is invisible while competitors dominate.`,
//       actions: [
//         { timeframe: "immediate",   action: "Add topic to homepage heading",    detail: `Include the core topic of "${q}" in your H1 or H2` },
//         { timeframe: "short_term",  action: "Create a competitor comparison page", detail: `Write "Your Brand vs ${c}" — 1000+ words, clear verdict, real customer quotes` },
//         { timeframe: "short_term",  action: "Close the content gap",            detail: `Analyze ${c}'s content for this topic — create equivalent or better content` },
//         { timeframe: "ongoing",     action: "Get added to comparison articles", detail: `Find "${q}" articles and ask authors to include your brand` },
//       ],
//       expected_impact: `Start appearing alongside ${c} in shared AI answers within 3-6 weeks`,
//       estimated_weeks: 5,
//     },
//     competing: {
//       summary: `Your brand appears for "${q}" but ranks below ${c} — authority signals need strengthening.`,
//       actions: [
//         { timeframe: "immediate",   action: "Add use-case testimonials",     detail: `Add testimonials mentioning this use case to homepage and product pages` },
//         { timeframe: "immediate",   action: "Sharpen niche positioning",     detail: `Claim a specific angle — "the [adjective] solution for [specific audience]"` },
//         { timeframe: "short_term",  action: "Launch external mention campaign", detail: `Target 10 new relevant articles this month — offer expert quotes to bloggers` },
//         { timeframe: "ongoing",     action: "Build review volume for use case", detail: `Ask customers to review on G2/Capterra mentioning this specific use case` },
//       ],
//       expected_impact: "Move from option 3-4 to option 1-2 in AI answers within 6-8 weeks",
//       estimated_weeks: 7,
//     },
//     winning: {
//       summary: `Your brand is winning "${q}" — protect this position and expand to adjacent queries.`,
//       actions: [
//         { timeframe: "protect", action: "Keep content fresh",        detail: `Update content targeting "${q}" every 6-8 weeks — add customer stories, refresh stats` },
//         { timeframe: "protect", action: "Add FAQ schema",            detail: `Add FAQ structured data answering "Is brand good for [use case]?" and comparison questions` },
//         { timeframe: "expand",  action: "Target adjacent queries",   detail: `Create content for query variations — add audience segment, team size, budget range` },
//         { timeframe: "expand",  action: "Publish a customer case study", detail: `Publish 1-2 detailed case studies for this use case — AI engines frequently cite them` },
//       ],
//       expected_impact: "Maintain current wins and expand to 3-5 adjacent queries within 4 weeks",
//       estimated_weeks: 4,
//     },
//   };

//   return map[pattern] || map.missed;
// }

// // ─────────────────────────────────────────
// // AI RECOMMENDATION GENERATOR
// // ─────────────────────────────────────────
// async function generateRecommendation(gap, pattern, brandName, topCompetitor) {
//   const competitorList = Array.isArray(gap.competitor_positions)
//     ? gap.competitor_positions.map((c) => c.name).filter(Boolean).join(", ")
//     : "none";

//   const patternContext = {
//     missed:    `Brand completely invisible — AI doesn't associate it with this query. Open opportunity.`,
//     losing:    `Competitor(s) (${competitorList}) winning this query. Brand not appearing at all.`,
//     competing: `Brand appears but ranks below competitors (${competitorList}). Not winning.`,
//     winning:   `Brand winning this query. Appears first or alone. Need to protect and expand.`,
//   };

//   const actionStructure = {
//     missed:    "IMMEDIATE (this week), SHORT_TERM (2-4 weeks), ONGOING",
//     losing:    "IMMEDIATE (this week), SHORT_TERM (2-4 weeks), ONGOING",
//     competing: "IMMEDIATE (this week), SHORT_TERM (2-4 weeks), ONGOING",
//     winning:   "PROTECT (keep winning), EXPAND (adjacent queries)",
//   };

//   const aiPrompt = `
// You are an AEO (Answer Engine Optimization) expert. Help improve AI search visibility.

// QUERY: "${gap.prompt}"
// SITUATION: ${patternContext[pattern]}
// TOP COMPETITOR: ${topCompetitor || "none"}
// TIMEFRAME STRUCTURE: ${actionStructure[pattern]}

// STRICT RULES:
// - Hyper-specific: not "create content" but exact page titles, schema types, platforms
// - Include word counts, specific schema types, platform names
// - Realistic timeline in weeks
// - Use "your brand" not the brand name
// - Each action under 30 words
// - Exactly 4 actions

// Return ONLY valid JSON:
// {
//   "summary": "One sentence diagnosis for this exact query",
//   "actions": [
//     { "timeframe": "immediate|short_term|ongoing|protect|expand", "action": "Short title (5 words max)", "detail": "Specific detail with exact specs" }
//   ],
//   "expected_impact": "Specific result with timeframe",
//   "estimated_weeks": 5
// }`;

//   try {
//     const raw    = await askAI(aiPrompt, { max_tokens: 500 });
//     const parsed = safeJsonParse(raw);

//     if (parsed?.summary && Array.isArray(parsed?.actions) && parsed.actions.length >= 2) {
//       return { data: parsed, source: "ai" };
//     }
//     throw new Error("Invalid response structure");
//   } catch (err) {
//     console.warn(`      ⚠️  AI failed (${err.message}) — using static fallback`);
//     return { data: staticRecommendation(gap, pattern, brandName, topCompetitor), source: "static" };
//   }
// }

// function buildFlatMessage(recData, pattern, query, topCompetitor) {
//   const c = topCompetitor || "competitors";
//   const prefix = {
//     missed:    `Your brand is not appearing when AI answers: "${query}".`,
//     losing:    `${c} is winning "${query}" — your brand is invisible.`,
//     competing: `Your brand appears for "${query}" but isn't winning.`,
//     winning:   `Your brand is winning "${query}" — protect and expand.`,
//   }[pattern] || `Your brand is not appearing when AI answers: "${query}".`;

//   const firstAction = recData.actions?.[0];
//   const detail = firstAction ? ` ${firstAction.action}: ${firstAction.detail}` : "";
//   return `${prefix}${detail} ${recData.expected_impact || ""}`.trim();
// }

// // ─────────────────────────────────────────
// // PROCESS ONE GAP
// // ─────────────────────────────────────────
// async function processGap(gap, planId, brandName) {
//   const pattern       = classifyPattern(gap);
//   const priority      = scorePriority(pattern, gap);
//   const competitors   = Array.isArray(gap.competitor_positions) ? gap.competitor_positions : [];
//   const topCompetitor = competitors[0]?.name || null;

//   const { data: recData, source } = await generateRecommendation(gap, pattern, brandName, topCompetitor);

//   return {
//     plan_id:          planId,
//     gap_id:           gap.id,
//     prompt:           gap.prompt,
//     pattern,
//     priority,
//     type:             patternToType(pattern),
//     summary:          recData.summary,
//     actions:          recData.actions,
//     expected_impact:  recData.expected_impact,
//     estimated_weeks:  recData.estimated_weeks || 4,
//     message:          buildFlatMessage(recData, pattern, gap.prompt, topCompetitor),
//     top_competitor:   topCompetitor,
//     competitor_count: competitors.length,
//     rec_source:       source,
//     status:           "active",
//     created_at:       new Date().toISOString(),
//     _source:          source, // temp field for counting, removed before insert
//   };
// }

// // ─────────────────────────────────────────
// // MAIN
// // ─────────────────────────────────────────
// export async function runRecommendationJob(planId) {
//   console.log("\n🧠 [RecommendationJob] Starting for plan:", planId);

//   // Load plan + gaps in parallel
//   const [{ data: plan, error: planErr }, { data: gaps, error: gapsErr }] = await Promise.all([
//     supabase.from("plans").select("id, name, website_url, tier").eq("id", planId).single(),
//     supabase.from("aeo_gaps").select("*").eq("plan_id", planId).order("created_at", { ascending: false }),
//   ]);

//   if (planErr || !plan) { console.error("❌ Plan not found:", planErr?.message); return; }
//   if (gapsErr)          { console.error("❌ Failed to fetch gaps:", gapsErr.message); return; }
//   if (!gaps?.length)    { console.log("⚠️  No gaps found — skipping"); return; }

//   const brandName = plan.name || "your brand";
//   console.log(`📋 Plan: "${brandName}" | Tier: ${plan.tier}`);
//   console.log(`📊 Found ${gaps.length} gaps to process`);
//   console.log(`⚡ Parallel batch size: ${BATCH_SIZE}`);

//   const recommendations = [];
//   let aiCount = 0, staticCount = 0;

//   // ✅ Process gaps in parallel batches
//   for (let i = 0; i < gaps.length; i += BATCH_SIZE) {
//     const batch   = gaps.slice(i, i + BATCH_SIZE);
//     const batchNo = Math.floor(i / BATCH_SIZE) + 1;
//     const total   = Math.ceil(gaps.length / BATCH_SIZE);

//     console.log(`\n📦 Batch [${batchNo}/${total}] — ${batch.length} gaps in parallel`);

//     const results = await Promise.allSettled(
//       batch.map((gap) => {
//         const pattern     = classifyPattern(gap);
//         const priority    = scorePriority(pattern, gap);
//         const topComp     = gap.competitor_positions?.[0]?.name || null;
//         console.log(`   🔍 "${gap.prompt.slice(0, 55)}..." | ${pattern} | ${priority} | ${topComp || "none"}`);
//         return processGap(gap, planId, brandName);
//       })
//     );

//     for (const result of results) {
//       if (result.status === "rejected") {
//         console.error(`   ❌ Gap failed:`, result.reason?.message);
//         staticCount++;
//       } else {
//         const rec = result.value;
//         const src = rec._source;
//         delete rec._source;
//         src === "ai" ? aiCount++ : staticCount++;
//         console.log(`   ${src === "ai" ? "✅ AI" : "⚡ Static"} recommendation ready`);
//         recommendations.push(rec);
//       }
//     }

//     // Brief pause between batches to avoid rate limits
//     if (i + BATCH_SIZE < gaps.length) await sleep(300);
//   }

//   if (!recommendations.length) { console.log("ℹ️  No recommendations to insert"); return; }

//   // Delete old + insert new in batch
//   await supabase.from("aeo_recommendations").delete().eq("plan_id", planId);

//   const INSERT_BATCH = 20;
//   let insertedTotal  = 0;

//   for (let i = 0; i < recommendations.length; i += INSERT_BATCH) {
//     const { error } = await supabase.from("aeo_recommendations").insert(recommendations.slice(i, i + INSERT_BATCH));
//     if (error) console.error(`❌ Batch insert failed (offset ${i}):`, error.message);
//     else        insertedTotal += Math.min(INSERT_BATCH, recommendations.length - i);
//   }

//   // Update plan stats (non-blocking)
//   supabase.from("plans").update({
//     recommendations_count:      insertedTotal,
//     recommendations_updated_at: new Date().toISOString(),
//   }).eq("id", planId).then(() => {}).catch(() => {});

//   const highCount   = recommendations.filter((r) => r.priority === "high").length;
//   const mediumCount = recommendations.filter((r) => r.priority === "medium").length;
//   const lowCount    = recommendations.filter((r) => r.priority === "low").length;

//   console.log(`\n✅ [RecommendationJob] Complete`);
//   console.log(`   Inserted:   ${insertedTotal} recommendations`);
//   console.log(`   AI-powered: ${aiCount} | Static fallback: ${staticCount}`);
//   console.log(`   High: ${highCount} | Medium: ${mediumCount} | Low: ${lowCount}`);
// }










import { supabase }      from "../config/supabase.js";
import { askAI }         from "../services/aeo/index.js";
import { safeJsonParse } from "../utils/aiJson.js";

const BATCH_SIZE = 12; // gaps processed in parallel
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────
// PATTERN CLASSIFIER
// ─────────────────────────────────────────
function classifyPattern(gap) {
  const reasons      = Array.isArray(gap.gap_reasons) ? gap.gap_reasons : [];
  const competitors  = Array.isArray(gap.competitor_positions) && gap.competitor_positions.length > 0;
  const brandMissing = reasons.includes("brand_not_mentioned");
  const compWin      = reasons.includes("competitor_dominates");

  if (!brandMissing && !compWin) return "winning";
  if (!brandMissing &&  compWin) return "competing";
  if ( brandMissing &&  compWin) return "losing";
  return "missed";
}

function scorePriority(pattern, gap) {
  const competitorCount = Array.isArray(gap.competitor_positions) ? gap.competitor_positions.length : 0;
  if (pattern === "missed")    return "high";
  if (pattern === "losing")    return competitorCount >= 2 ? "high" : "medium";
  if (pattern === "competing") return "medium";
  if (pattern === "winning")   return "low";
  return "medium";
}

function patternToType(pattern) {
  return { missed: "content_creation", losing: "comparison_content", competing: "authority_building", winning: "protect_and_expand" }[pattern] || "content_creation";
}

// ─────────────────────────────────────────
// STATIC FALLBACK
// ─────────────────────────────────────────
function staticRecommendation(gap, pattern, brandName, topCompetitor) {
  const q = gap.prompt;
  const c = topCompetitor || "competitors";

  const map = {
    missed: {
      summary: `AI engines don't associate your brand with "${q}" — no content directly answers this question.`,
      actions: [
        { timeframe: "immediate",   action: "Add category schema markup",   detail: `Add structured data signalling the category of "${q}" to your homepage` },
        { timeframe: "immediate",   action: "Update homepage heading",       detail: `Add the core topic of "${q}" into your H1 or H2 tag` },
        { timeframe: "short_term",  action: "Create a dedicated content page", detail: `Write 800+ words directly answering "${q}" — mention brand in first paragraph` },
        { timeframe: "ongoing",     action: "Build external mentions",       detail: `Get listed on G2, Capterra, Trustpilot for the use case in this query` },
      ],
      expected_impact: "Brand begins appearing in AI answers within 4-8 weeks",
      estimated_weeks: 6,
    },
    losing: {
      summary: `${c} is winning "${q}" — your brand is invisible while competitors dominate.`,
      actions: [
        { timeframe: "immediate",   action: "Add topic to homepage heading",    detail: `Include the core topic of "${q}" in your H1 or H2` },
        { timeframe: "short_term",  action: "Create a competitor comparison page", detail: `Write "Your Brand vs ${c}" — 1000+ words, clear verdict, real customer quotes` },
        { timeframe: "short_term",  action: "Close the content gap",            detail: `Analyze ${c}'s content for this topic — create equivalent or better content` },
        { timeframe: "ongoing",     action: "Get added to comparison articles", detail: `Find "${q}" articles and ask authors to include your brand` },
      ],
      expected_impact: `Start appearing alongside ${c} in shared AI answers within 3-6 weeks`,
      estimated_weeks: 5,
    },
    competing: {
      summary: `Your brand appears for "${q}" but ranks below ${c} — authority signals need strengthening.`,
      actions: [
        { timeframe: "immediate",   action: "Add use-case testimonials",     detail: `Add testimonials mentioning this use case to homepage and product pages` },
        { timeframe: "immediate",   action: "Sharpen niche positioning",     detail: `Claim a specific angle — "the [adjective] solution for [specific audience]"` },
        { timeframe: "short_term",  action: "Launch external mention campaign", detail: `Target 10 new relevant articles this month — offer expert quotes to bloggers` },
        { timeframe: "ongoing",     action: "Build review volume for use case", detail: `Ask customers to review on G2/Capterra mentioning this specific use case` },
      ],
      expected_impact: "Move from option 3-4 to option 1-2 in AI answers within 6-8 weeks",
      estimated_weeks: 7,
    },
    winning: {
      summary: `Your brand is winning "${q}" — protect this position and expand to adjacent queries.`,
      actions: [
        { timeframe: "protect", action: "Keep content fresh",        detail: `Update content targeting "${q}" every 6-8 weeks — add customer stories, refresh stats` },
        { timeframe: "protect", action: "Add FAQ schema",            detail: `Add FAQ structured data answering "Is brand good for [use case]?" and comparison questions` },
        { timeframe: "expand",  action: "Target adjacent queries",   detail: `Create content for query variations — add audience segment, team size, budget range` },
        { timeframe: "expand",  action: "Publish a customer case study", detail: `Publish 1-2 detailed case studies for this use case — AI engines frequently cite them` },
      ],
      expected_impact: "Maintain current wins and expand to 3-5 adjacent queries within 4 weeks",
      estimated_weeks: 4,
    },
  };

  return map[pattern] || map.missed;
}

// ─────────────────────────────────────────
// AI RECOMMENDATION GENERATOR
// ─────────────────────────────────────────
async function generateRecommendation(gap, pattern, brandName, topCompetitor) {
  const competitorList = Array.isArray(gap.competitor_positions)
    ? gap.competitor_positions.map((c) => c.name).filter(Boolean).join(", ")
    : "none";

  const patternContext = {
    missed:    `Brand completely invisible — AI doesn't associate it with this query. Open opportunity.`,
    losing:    `Competitor(s) (${competitorList}) winning this query. Brand not appearing at all.`,
    competing: `Brand appears but ranks below competitors (${competitorList}). Not winning.`,
    winning:   `Brand winning this query. Appears first or alone. Need to protect and expand.`,
  };

  const actionStructure = {
    missed:    "IMMEDIATE (this week), SHORT_TERM (2-4 weeks), ONGOING",
    losing:    "IMMEDIATE (this week), SHORT_TERM (2-4 weeks), ONGOING",
    competing: "IMMEDIATE (this week), SHORT_TERM (2-4 weeks), ONGOING",
    winning:   "PROTECT (keep winning), EXPAND (adjacent queries)",
  };

  const aiPrompt = `
You are an AEO (Answer Engine Optimization) expert. Help improve AI search visibility.

QUERY: "${gap.prompt}"
SITUATION: ${patternContext[pattern]}
TOP COMPETITOR: ${topCompetitor || "none"}
TIMEFRAME STRUCTURE: ${actionStructure[pattern]}

STRICT RULES:
- Hyper-specific: not "create content" but exact page titles, schema types, platforms
- Include word counts, specific schema types, platform names
- Realistic timeline in weeks
- Use "your brand" not the brand name
- Each action under 30 words
- Exactly 4 actions

Return ONLY valid JSON:
{
  "summary": "One sentence diagnosis for this exact query",
  "actions": [
    { "timeframe": "immediate|short_term|ongoing|protect|expand", "action": "Short title (5 words max)", "detail": "Specific detail with exact specs" }
  ],
  "expected_impact": "Specific result with timeframe",
  "estimated_weeks": 5
}`;

  try {
    const raw    = await askAI(aiPrompt, { max_tokens: 350 });
    const parsed = safeJsonParse(raw);

    if (parsed?.summary && Array.isArray(parsed?.actions) && parsed.actions.length >= 2) {
      return { data: parsed, source: "ai" };
    }
    throw new Error("Invalid response structure");
  } catch (err) {
    console.warn(`      ⚠️  AI failed (${err.message}) — using static fallback`);
    return { data: staticRecommendation(gap, pattern, brandName, topCompetitor), source: "static" };
  }
}

function buildFlatMessage(recData, pattern, query, topCompetitor) {
  const c = topCompetitor || "competitors";
  const prefix = {
    missed:    `Your brand is not appearing when AI answers: "${query}".`,
    losing:    `${c} is winning "${query}" — your brand is invisible.`,
    competing: `Your brand appears for "${query}" but isn't winning.`,
    winning:   `Your brand is winning "${query}" — protect and expand.`,
  }[pattern] || `Your brand is not appearing when AI answers: "${query}".`;

  const firstAction = recData.actions?.[0];
  const detail = firstAction ? ` ${firstAction.action}: ${firstAction.detail}` : "";
  return `${prefix}${detail} ${recData.expected_impact || ""}`.trim();
}

// ─────────────────────────────────────────
// PROCESS ONE GAP
// ─────────────────────────────────────────
async function processGap(gap, planId, brandName) {
  const pattern       = classifyPattern(gap);
  const priority      = scorePriority(pattern, gap);
  const competitors   = Array.isArray(gap.competitor_positions) ? gap.competitor_positions : [];
  const topCompetitor = competitors[0]?.name || null;

  const { data: recData, source } = await generateRecommendation(gap, pattern, brandName, topCompetitor);

  return {
    plan_id:          planId,
    gap_id:           gap.id,
    prompt:           gap.prompt,
    pattern,
    priority,
    type:             patternToType(pattern),
    summary:          recData.summary,
    actions:          recData.actions,
    expected_impact:  recData.expected_impact,
    estimated_weeks:  recData.estimated_weeks || 4,
    message:          buildFlatMessage(recData, pattern, gap.prompt, topCompetitor),
    top_competitor:   topCompetitor,
    competitor_count: competitors.length,
    rec_source:       source,
    status:           "active",
    created_at:       new Date().toISOString(),
    _source:          source, // temp field for counting, removed before insert
  };
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────
export async function runRecommendationJob(planId) {
  console.log("\n🧠 [RecommendationJob] Starting for plan:", planId);

  // Load plan + gaps in parallel
  const [{ data: plan, error: planErr }, { data: gaps, error: gapsErr }] = await Promise.all([
    supabase.from("plans").select("id, name, website_url, tier").eq("id", planId).single(),
    supabase.from("aeo_gaps").select("*").eq("plan_id", planId).order("created_at", { ascending: false }),
  ]);

  if (planErr || !plan) { console.error("❌ Plan not found:", planErr?.message); return; }
  if (gapsErr)          { console.error("❌ Failed to fetch gaps:", gapsErr.message); return; }
  if (!gaps?.length)    { console.log("⚠️  No gaps found — skipping"); return; }

  const brandName = plan.name || "your brand";
  console.log(`📋 Plan: "${brandName}" | Tier: ${plan.tier}`);
  console.log(`📊 Found ${gaps.length} gaps to process`);
  console.log(`⚡ Parallel batch size: ${BATCH_SIZE}`);

  const recommendations = [];
  let aiCount = 0, staticCount = 0;

  // ✅ Process gaps in parallel batches
  for (let i = 0; i < gaps.length; i += BATCH_SIZE) {
    const batch   = gaps.slice(i, i + BATCH_SIZE);
    const batchNo = Math.floor(i / BATCH_SIZE) + 1;
    const total   = Math.ceil(gaps.length / BATCH_SIZE);

    console.log(`\n📦 Batch [${batchNo}/${total}] — ${batch.length} gaps in parallel`);

    const results = await Promise.allSettled(
      batch.map((gap) => {
        const pattern     = classifyPattern(gap);
        const priority    = scorePriority(pattern, gap);
        const topComp     = gap.competitor_positions?.[0]?.name || null;
        console.log(`   🔍 "${gap.prompt.slice(0, 55)}..." | ${pattern} | ${priority} | ${topComp || "none"}`);
        return processGap(gap, planId, brandName);
      })
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error(`   ❌ Gap failed:`, result.reason?.message);
        staticCount++;
      } else {
        const rec = result.value;
        const src = rec._source;
        delete rec._source;
        src === "ai" ? aiCount++ : staticCount++;
        console.log(`   ${src === "ai" ? "✅ AI" : "⚡ Static"} recommendation ready`);
        recommendations.push(rec);
      }
    }

    // Brief pause between batches to avoid rate limits
    if (i + BATCH_SIZE < gaps.length) await sleep(150);
  }

  if (!recommendations.length) { console.log("ℹ️  No recommendations to insert"); return; }

  // Delete old + insert new in batch
  await supabase.from("aeo_recommendations").delete().eq("plan_id", planId);

  const INSERT_BATCH = 20;
  let insertedTotal  = 0;

  for (let i = 0; i < recommendations.length; i += INSERT_BATCH) {
    const { error } = await supabase.from("aeo_recommendations").insert(recommendations.slice(i, i + INSERT_BATCH));
    if (error) console.error(`❌ Batch insert failed (offset ${i}):`, error.message);
    else        insertedTotal += Math.min(INSERT_BATCH, recommendations.length - i);
  }

  // Update plan stats (non-blocking)
  supabase.from("plans").update({
    recommendations_count:      insertedTotal,
    recommendations_updated_at: new Date().toISOString(),
  }).eq("id", planId).then(() => {}).catch(() => {});

  const highCount   = recommendations.filter((r) => r.priority === "high").length;
  const mediumCount = recommendations.filter((r) => r.priority === "medium").length;
  const lowCount    = recommendations.filter((r) => r.priority === "low").length;

  console.log(`\n✅ [RecommendationJob] Complete`);
  console.log(`   Inserted:   ${insertedTotal} recommendations`);
  console.log(`   AI-powered: ${aiCount} | Static fallback: ${staticCount}`);
  console.log(`   High: ${highCount} | Medium: ${mediumCount} | Low: ${lowCount}`);
}