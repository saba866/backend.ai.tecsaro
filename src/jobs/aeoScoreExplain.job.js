




// import { supabase } from "../config/supabase.js";
// import { runGemini } from "../services/gemini.service.js";
// import { safeJsonParse } from "../utils/aiJson.js";

// export async function runAeoScoreExplainJob(planId) {
//   console.log("\n🧠 [ScoreExplainJob] Starting for plan:", planId);

//   // ── LOAD SCORE ──
//   const { data: latest, error: scoreErr } = await supabase
//     .from("aeo_scores")
//     .select("*")
//     .eq("plan_id", planId)
//     .order("created_at", { ascending: false })
//     .limit(1)
//     .maybeSingle();

//   if (scoreErr || !latest) {
//     console.warn("⚠️  No score found — run score job first");
//     return;
//   }

//   // ── LOAD PLAN ──
//   const { data: plan } = await supabase
//     .from("plans")
//     .select("name, website_url, tier, country, language")
//     .eq("id", planId)
//     .single();

//   const brandName = plan?.name     || "your brand";
//   const tier      = plan?.tier     || "starter";
//   const country   = plan?.country  || "US";
//   const language  = plan?.language || "English";

//   console.log(`📋 Plan: "${brandName}" | Score: ${latest.score}/100 | Tier: ${tier}`);

//   // ── LOAD AI ANSWERS ──
//   const { data: answers } = await supabase
//     .from("aeo_ai_answers")
//     .select("id, prompt_id, answer_text, engine")
//     .eq("plan_id", planId)
//     .order("created_at", { ascending: false })
//     .limit(20);

//   // ── LOAD MENTION RESULTS ──
//   const answerIds = (answers || []).map((a) => a.id);
//   const { data: mentions } = await supabase
//     .from("aeo_mention_results")
//     .select("answer_id, entity_name, entity_type, mentioned")
//     .in("answer_id", answerIds.length > 0 ? answerIds : ["none"]);

//   // ── LOAD PROMPTS ──
//   const promptIds = [...new Set((answers || []).map((a) => a.prompt_id).filter(Boolean))];
//   const { data: prompts } = await supabase
//     .from("aeo_prompts")
//     .select("id, prompt")
//     .in("id", promptIds.length > 0 ? promptIds : ["none"]);

//   const promptMap = Object.fromEntries((prompts || []).map((p) => [p.id, p.prompt]));

//   // ── LOAD GAPS ──
//   const { data: gaps } = await supabase
//     .from("aeo_gaps")
//     .select("prompt, gap_reasons, competitor_positions")
//     .eq("plan_id", planId)
//     .limit(10);

//   // ── BUILD PER-QUERY EVIDENCE ──
//   const queryEvidence = [];
//   const seenPrompts   = new Set();

//   for (const answer of answers || []) {
//     const promptText = promptMap[answer.prompt_id];
//     if (!promptText || seenPrompts.has(promptText)) continue;
//     seenPrompts.add(promptText);

//     const answerMentions = (mentions || []).filter((m) => m.answer_id === answer.id);
//     const brandMentioned = answerMentions.find((m) => m.entity_type === "brand" && m.mentioned);
//     const competitorsWon = answerMentions
//       .filter((m) => m.entity_type === "competitor" && m.mentioned)
//       .map((m) => m.entity_name);

//     let outcome = "missed";
//     if      (brandMentioned && competitorsWon.length === 0) outcome = "win";
//     else if (brandMentioned && competitorsWon.length > 0)   outcome = "shared";
//     else if (!brandMentioned && competitorsWon.length > 0)  outcome = "loss";

//     const answerSnippet = answer.answer_text
//       ? answer.answer_text.slice(0, 300).replace(/\n+/g, " ") + "..."
//       : "No answer text available";

//     queryEvidence.push({
//       query:       promptText,
//       outcome,
//       competitors: competitorsWon,
//       engine:      answer.engine || "unknown",
//       snippet:     answerSnippet,
//     });

//     if (queryEvidence.length >= 8) break;
//   }

//   // ── BUILD COMPETITOR SUMMARY ──
//   const competitorTally = {};
//   for (const gap of gaps || []) {
//     const comps = Array.isArray(gap.competitor_positions) ? gap.competitor_positions : [];
//     for (const c of comps) {
//       if (c.name) competitorTally[c.name] = (competitorTally[c.name] || 0) + 1;
//     }
//   }

//   const topCompetitors = Object.entries(competitorTally)
//     .sort((a, b) => b[1] - a[1])
//     .slice(0, 3)
//     .map(([name, count]) => `${name} (appears in ${count} gap queries)`);

//   // ── BUILD PROMPT ──
//   const b = latest.breakdown;

//   const queryEvidenceText = queryEvidence.length > 0
//     ? queryEvidence.map((q, i) => {
//         const outcomeLabel = {
//           win:    "✅ WON (brand appeared alone)",
//           shared: `⚠️  SHARED (appeared with: ${q.competitors.join(", ")})`,
//           loss:   `❌ LOST (${q.competitors.join(", ")} appeared instead)`,
//           missed: "⬜ MISSED (no brand mentioned)",
//         }[q.outcome] || q.outcome;

//         return `Query ${i + 1}: "${q.query}"\n  Result: ${outcomeLabel}\n  AI said: "${q.snippet}"`;
//       }).join("\n\n")
//     : "No answer data available yet";

//   const competitorSummary = topCompetitors.length > 0
//     ? topCompetitors.join("\n  ")
//     : "No competitors identified yet";

//   const prompt = `
// You are an AEO (Answer Engine Optimization) expert analyzing ${brandName}'s AI search visibility in ${country} (${language} market).

// SCORE: ${latest.score}/100
// BRAND: ${brandName}

// SCORE BREAKDOWN:
// ${(b.scoreComponents || []).map((s) => `- ${s.category}: ${s.points}/${s.max} — ${s.detail}`).join("\n")}

// WHAT AI ACTUALLY SAID ABOUT ${brandName.toUpperCase()}:
// ${queryEvidenceText}

// COMPETITIVE REALITY:
// Top competitors winning queries instead of ${brandName}:
//   ${competitorSummary}

// SUMMARY STATS:
// - Brand presence rate: ${((b.brandPresenceRate || 0) * 100).toFixed(1)}%
// - Wins: ${b.wins} | Losses: ${b.losses} | Shared: ${b.shared} | Missed: ${b.missed}
// - Total queries analyzed: ${b.totalAnswers}
// - Gaps identified: ${b.gapCount}
// - Schema coverage: ${b.schemaCount} schemas for ${b.pageCount} pages

// YOUR TASK:
// Write a score explanation that feels like a real AEO consultant analyzed this brand.

// RULES:
// - Reference the ACTUAL query results above — name specific queries
// - Name the specific competitors that are winning
// - Be honest — if score is low, say why clearly
// - Do NOT be generic — "you need more content" is banned
// - Each improvement must have specific action, score impact, and timeline

// Return ONLY a valid JSON object with exactly these keys:
// {
//   "score": ${latest.score},
//   "headline": "8-12 word summary of the brand AEO situation",
//   "explanation": "2-3 sentences referencing actual query results and competitor names",
//   "what_is_working": ["specific strength 1", "specific strength 2"],
//   "top_issues": ["specific issue referencing actual data 1", "specific issue 2", "specific issue 3"],
//   "improvements": [
//     {
//       "action": "Specific action — exact page title, schema type, or platform",
//       "impact": "Which queries this fixes",
//       "score_impact": "+X to +Y points",
//       "timeline": "X weeks"
//     }
//   ]
// }
// `;

//   console.log("🤖 Sending to Gemini...");
//   console.log(`   Tier: ${tier} | Context: ${queryEvidence.length} queries, ${topCompetitors.length} competitors`);

//   // ── CALL GEMINI ──
//   // runGemini handles: retry on 503, model fallback, JSON fence stripping, truncation salvage
//   let parsed;
//   try {
//     const raw = await runGemini(prompt, {
//       tier,
//       temperature:     0.7,
//       maxOutputTokens: 4096,
//     });

//     parsed = safeJsonParse(raw);

//     if (!parsed?.explanation || !parsed?.improvements) {
//       throw new Error("Missing required fields");
//     }

//     console.log("\n✅ Explanation parsed from Gemini");

//   } catch (err) {
//     console.warn("⚠️  Gemini failed after all retries — using fallback:", err.message);
//     parsed = buildFallbackExplanation(latest.score, b, brandName, topCompetitors);
//   }

//   console.log(`   Headline:     ${parsed.headline}`);
//   console.log(`   Issues:       ${parsed.top_issues?.length || 0}`);
//   console.log(`   Improvements: ${parsed.improvements?.length || 0}`);

//   // ── SAVE EXPLANATION ──
//   await supabase
//     .from("aeo_score_explanations")
//     .delete()
//     .eq("plan_id", planId);

//   const { error: insertErr } = await supabase
//     .from("aeo_score_explanations")
//     .insert({
//       plan_id:         planId,
//       score:           latest.score,
//       headline:        parsed.headline        || null,
//       explanation:     parsed.explanation     || null,
//       what_is_working: parsed.what_is_working || [],
//       top_issues:      parsed.top_issues      || [],
//       improvements:    parsed.improvements    || [],
//       recommendations: parsed.improvements
//         ? parsed.improvements.map((i) => i.action).join(". ")
//         : null,
//       context_queries: queryEvidence,
//       created_at:      new Date().toISOString(),
//     });

//   if (insertErr) {
//     console.error("❌ Failed to save explanation:", insertErr.message);
//     return;
//   }

//   console.log("✅ [ScoreExplainJob] Explanation saved");
//   return parsed;
// }

// // ─────────────────────────────────────────
// // FALLBACK — only fires if Gemini fails
// // after all retries + model fallback
// // Still uses real score data, not generic
// // ─────────────────────────────────────────
// function buildFallbackExplanation(score, b, brandName, topCompetitors) {
//   const presencePercent = ((b.brandPresenceRate || 0) * 100).toFixed(1);
//   const topComp = topCompetitors[0]?.split(" (")[0] || "competitors";

//   let headline;
//   if      (score >= 70) headline = "Brand has strong AI visibility with room to grow";
//   else if (score >= 50) headline = "Brand appears in AI answers but rarely wins outright";
//   else if (score >= 30) headline = "Brand is visible but consistently outranked by competitors";
//   else                  headline = "Brand is largely invisible in AI search answers";

//   return {
//     score,
//     headline,
//     explanation: `${brandName} scores ${score}/100 because it appears in ${presencePercent}% of AI answers but wins only ${b.wins} out of ${b.totalAnswers} queries outright. ${topComp} is appearing in ${b.losses + b.shared} of the same queries, reducing ${brandName}'s competitive standing.`,
//     what_is_working: [
//       b.wins > 0
//         ? `Winning ${b.wins} quer${b.wins === 1 ? "y" : "ies"} outright`
//         : "Schema markup is in place",
//       b.schemaCount > 0
//         ? `Schema coverage across ${b.schemaCount} pages`
//         : "Prompts are actively tracked",
//     ].filter(Boolean),
//     top_issues: [
//       `Missing from ${b.missed} queries completely — no brand presence at all`,
//       b.losses > 0
//         ? `Lost ${b.losses} queries to competitors with no brand appearance`
//         : `Appearing alongside competitors in ${b.shared} shared queries`,
//       `Brand presence rate of ${presencePercent}% needs to reach 70%+ for strong AEO health`,
//     ],
//     improvements: [
//       {
//         action:       `Create dedicated content pages directly answering the ${b.missed} queries where brand is completely missing`,
//         impact:       `Recover ${b.missed} missed queries`,
//         score_impact: `+${Math.round(b.missed * 2)} to +${Math.round(b.missed * 4)} points`,
//         timeline:     "4-6 weeks",
//       },
//       {
//         action:       `Build comparison content targeting "${topComp}" — "${brandName} vs ${topComp}" page minimum 1000 words`,
//         impact:       "Convert shared mentions to wins on competitive queries",
//         score_impact: "+5 to +10 points",
//         timeline:     "2-3 weeks",
//       },
//       {
//         action:       "Add FAQ schema to key pages answering common queries in your tracked prompt list",
//         impact:       "Stronger AI category association",
//         score_impact: "+3 to +5 points",
//         timeline:     "1 week",
//       },
//     ],
//   };
// }



import { supabase }      from "../config/supabase.js";
import { runGemini }     from "../services/gemini.service.js";
import { safeJsonParse } from "../utils/aiJson.js";

export async function runAeoScoreExplainJob(planId) {
  console.log("\n🧠 [ScoreExplainJob] Starting for plan:", planId);

  // ── LOAD SCORE + PLAN + ANSWERS + GAPS all in parallel ──
  const [
    { data: latest, error: scoreErr },
    { data: plan },
    { data: answers },
    { data: gaps },
  ] = await Promise.all([
    supabase.from("aeo_scores").select("*").eq("plan_id", planId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("plans").select("name, website_url, tier, country, language").eq("id", planId).single(),
    supabase.from("aeo_ai_answers").select("id, prompt_id, answer_text, engine").eq("plan_id", planId).order("created_at", { ascending: false }).limit(20),
    supabase.from("aeo_gaps").select("prompt, gap_reasons, competitor_positions").eq("plan_id", planId).limit(10),
  ]);

  if (scoreErr || !latest) { console.warn("⚠️  No score found — run score job first"); return; }

  const brandName = plan?.name     || "your brand";
  const tier      = plan?.tier     || "starter";
  const country   = plan?.country  || "US";
  const language  = plan?.language || "English";

  console.log(`📋 Plan: "${brandName}" | Score: ${latest.score}/100 | Tier: ${tier}`);

  // ── LOAD MENTIONS + PROMPTS in parallel (depend on answers) ──
  const answerIds = (answers || []).map((a) => a.id);
  const promptIds = [...new Set((answers || []).map((a) => a.prompt_id).filter(Boolean))];

  const [{ data: mentions }, { data: prompts }] = await Promise.all([
    answerIds.length > 0
      ? supabase.from("aeo_mention_results").select("answer_id, entity_name, entity_type, mentioned").in("answer_id", answerIds)
      : Promise.resolve({ data: [] }),
    promptIds.length > 0
      ? supabase.from("aeo_prompts").select("id, prompt").in("id", promptIds)
      : Promise.resolve({ data: [] }),
  ]);

  const promptMap = Object.fromEntries((prompts || []).map((p) => [p.id, p.prompt]));

  // ── BUILD QUERY EVIDENCE ──
  const queryEvidence = [];
  const seenPrompts   = new Set();

  for (const answer of answers || []) {
    const promptText = promptMap[answer.prompt_id];
    if (!promptText || seenPrompts.has(promptText)) continue;
    seenPrompts.add(promptText);

    const answerMentions = (mentions || []).filter((m) => m.answer_id === answer.id);
    const brandMentioned = answerMentions.find((m) => m.entity_type === "brand" && m.mentioned);
    const competitorsWon = answerMentions.filter((m) => m.entity_type === "competitor" && m.mentioned).map((m) => m.entity_name);

    const outcome = brandMentioned && competitorsWon.length === 0 ? "win"
                  : brandMentioned && competitorsWon.length > 0   ? "shared"
                  : !brandMentioned && competitorsWon.length > 0  ? "loss"
                  : "missed";

    queryEvidence.push({
      query:       promptText,
      outcome,
      competitors: competitorsWon,
      engine:      answer.engine || "unknown",
      snippet:     answer.answer_text ? answer.answer_text.slice(0, 300).replace(/\n+/g, " ") + "..." : "No answer available",
    });

    if (queryEvidence.length >= 8) break;
  }

  // ── BUILD COMPETITOR SUMMARY ──
  const competitorTally = {};
  for (const gap of gaps || []) {
    for (const c of (Array.isArray(gap.competitor_positions) ? gap.competitor_positions : [])) {
      if (c.name) competitorTally[c.name] = (competitorTally[c.name] || 0) + 1;
    }
  }
  const topCompetitors = Object.entries(competitorTally)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([name, count]) => `${name} (appears in ${count} gap queries)`);

  // ── BUILD PROMPT ──
  const b = latest.breakdown;
  const queryEvidenceText = queryEvidence.length > 0
    ? queryEvidence.map((q, i) => {
        const label = {
          win:    "✅ WON (brand appeared alone)",
          shared: `⚠️  SHARED (appeared with: ${q.competitors.join(", ")})`,
          loss:   `❌ LOST (${q.competitors.join(", ")} appeared instead)`,
          missed: "⬜ MISSED (no brand mentioned)",
        }[q.outcome] || q.outcome;
        return `Query ${i + 1}: "${q.query}"\n  Result: ${label}\n  AI said: "${q.snippet}"`;
      }).join("\n\n")
    : "No answer data available yet";

  const prompt = `
You are an AEO (Answer Engine Optimization) expert analyzing ${brandName}'s AI search visibility in ${country} (${language} market).

SCORE: ${latest.score}/100
BRAND: ${brandName}

SCORE BREAKDOWN:
${(b.scoreComponents || []).map((s) => `- ${s.category}: ${s.points}/${s.max} — ${s.detail}`).join("\n")}

WHAT AI ACTUALLY SAID ABOUT ${brandName.toUpperCase()}:
${queryEvidenceText}

COMPETITIVE REALITY:
Top competitors winning queries instead of ${brandName}:
  ${topCompetitors.join("\n  ") || "None identified yet"}

SUMMARY STATS:
- Brand presence rate: ${((b.brandPresenceRate || 0) * 100).toFixed(1)}%
- Wins: ${b.wins} | Losses: ${b.losses} | Shared: ${b.shared} | Missed: ${b.missed}
- Total queries analyzed: ${b.totalAnswers}
- Gaps identified: ${b.gapCount}
- Schema coverage: ${b.schemaCount} schemas for ${b.pageCount} pages

YOUR TASK:
Write a score explanation that feels like a real AEO consultant analyzed this brand.

RULES:
- Reference ACTUAL query results above — name specific queries
- Name specific competitors that are winning
- Be honest — if score is low, say why clearly
- Do NOT be generic — "you need more content" is banned
- Each improvement must have specific action, score impact, and timeline

Return ONLY valid JSON:
{
  "score": ${latest.score},
  "headline": "8-12 word summary of the brand AEO situation",
  "explanation": "2-3 sentences referencing actual query results and competitor names",
  "what_is_working": ["specific strength 1", "specific strength 2"],
  "top_issues": ["specific issue 1", "specific issue 2", "specific issue 3"],
  "improvements": [
    {
      "action": "Specific action — exact page title, schema type, or platform",
      "impact": "Which queries this fixes",
      "score_impact": "+X to +Y points",
      "timeline": "X weeks"
    }
  ]
}`;

  console.log("🤖 Sending to Gemini...");
  console.log(`   Tier: ${tier} | Context: ${queryEvidence.length} queries, ${topCompetitors.length} competitors`);

  let parsed;
  try {
    const raw = await runGemini(prompt, { tier, temperature: 0.7, maxOutputTokens: 4096 });
    parsed = safeJsonParse(raw);
    if (!parsed?.explanation || !parsed?.improvements) throw new Error("Missing required fields");
    console.log("\n✅ Explanation parsed from Gemini");
  } catch (err) {
    console.warn("⚠️  Gemini failed — using fallback:", err.message);
    parsed = buildFallbackExplanation(latest.score, b, brandName, topCompetitors);
  }

  console.log(`   Headline:     ${parsed.headline}`);
  console.log(`   Issues:       ${parsed.top_issues?.length || 0}`);
  console.log(`   Improvements: ${parsed.improvements?.length || 0}`);

  // ── SAVE — delete + insert (fast, no batching needed) ──
  await supabase.from("aeo_score_explanations").delete().eq("plan_id", planId);

  const { error: insertErr } = await supabase.from("aeo_score_explanations").insert({
    plan_id:         planId,
    score:           latest.score,
    headline:        parsed.headline        || null,
    explanation:     parsed.explanation     || null,
    what_is_working: parsed.what_is_working || [],
    top_issues:      parsed.top_issues      || [],
    improvements:    parsed.improvements    || [],
    recommendations: parsed.improvements?.map((i) => i.action).join(". ") || null,
    context_queries: queryEvidence,
    created_at:      new Date().toISOString(),
  });

  if (insertErr) { console.error("❌ Failed to save explanation:", insertErr.message); return; }

  console.log("✅ [ScoreExplainJob] Explanation saved");
  return parsed;
}

// ─────────────────────────────────────────
// FALLBACK
// ─────────────────────────────────────────
function buildFallbackExplanation(score, b, brandName, topCompetitors) {
  const presencePercent = ((b.brandPresenceRate || 0) * 100).toFixed(1);
  const topComp = topCompetitors[0]?.split(" (")[0] || "competitors";

  const headline = score >= 70 ? "Brand has strong AI visibility with room to grow"
                 : score >= 50 ? "Brand appears in AI answers but rarely wins outright"
                 : score >= 30 ? "Brand is visible but consistently outranked by competitors"
                 :               "Brand is largely invisible in AI search answers";

  return {
    score, headline,
    explanation: `${brandName} scores ${score}/100 because it appears in ${presencePercent}% of AI answers but wins only ${b.wins} out of ${b.totalAnswers} queries outright. ${topComp} is appearing in ${b.losses + b.shared} of the same queries, reducing ${brandName}'s competitive standing.`,
    what_is_working: [
      b.wins > 0 ? `Winning ${b.wins} quer${b.wins === 1 ? "y" : "ies"} outright` : "Schema markup is in place",
      b.schemaCount > 0 ? `Schema coverage across ${b.schemaCount} pages` : "Prompts are actively tracked",
    ].filter(Boolean),
    top_issues: [
      `Missing from ${b.missed} queries completely — no brand presence at all`,
      b.losses > 0 ? `Lost ${b.losses} queries to competitors with no brand appearance` : `Appearing alongside competitors in ${b.shared} shared queries`,
      `Brand presence rate of ${presencePercent}% needs to reach 70%+ for strong AEO health`,
    ],
    improvements: [
      { action: `Create dedicated content pages answering the ${b.missed} queries where brand is completely missing`, impact: `Recover ${b.missed} missed queries`, score_impact: `+${Math.round(b.missed * 2)} to +${Math.round(b.missed * 4)} points`, timeline: "4-6 weeks" },
      { action: `Build "${brandName} vs ${topComp}" comparison page — minimum 1000 words`, impact: "Convert shared mentions to wins on competitive queries", score_impact: "+5 to +10 points", timeline: "2-3 weeks" },
      { action: "Add FAQ schema to key pages answering common queries in your tracked prompt list", impact: "Stronger AI category association", score_impact: "+3 to +5 points", timeline: "1 week" },
    ],
  };
}