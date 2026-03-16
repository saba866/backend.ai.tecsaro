






import { supabase }            from "../config/supabase.js";
import { checkAeoScoreAlert }  from "../services/aeo/aeoAlert.service.js";

export async function runAeoScoreJob(planId) {
  console.log("\n📊 [ScoreJob] Calculating AEO score for plan:", planId);

  // ── LOAD ALL DATA IN PARALLEL ──
  const [
    { count: pageCount },
    { count: understoodPages },
    { count: promptCount },
    { count: aiAnswerCount },
    { count: schemaCount },
    { count: gapCount },
    { count: recommendationCount },
    { count: competitorCount },
    { data: mentionData },
    { data: answerData },   // ← NEW: need answer→prompt mapping
  ] = await Promise.all([
    supabase.from("aeo_pages").select("*", { count: "exact", head: true }).eq("plan_id", planId),
    supabase.from("aeo_pages").select("*", { count: "exact", head: true }).eq("plan_id", planId).not("ai_summary", "is", null),
    supabase.from("aeo_prompts").select("*", { count: "exact", head: true }).eq("plan_id", planId).in("status", ["active", "manually_added"]),
    supabase.from("aeo_ai_answers").select("*", { count: "exact", head: true }).eq("plan_id", planId),
    supabase.from("aeo_schemas").select("*", { count: "exact", head: true }).eq("plan_id", planId),
    supabase.from("aeo_gaps").select("*", { count: "exact", head: true }).eq("plan_id", planId),
    supabase.from("aeo_recommendations").select("*", { count: "exact", head: true }).eq("plan_id", planId),
    supabase.from("aeo_competitors").select("*", { count: "exact", head: true }).eq("plan_id", planId).eq("approved", true),
    supabase.from("aeo_mention_results").select("answer_id, entity_type, mentioned").eq("plan_id", planId),
    supabase.from("aeo_ai_answers").select("id, prompt_id").eq("plan_id", planId),  // ← answer→prompt map
  ]);

  // ── BUILD answer_id → prompt_id MAP ──
  const answerToPrompt = {};
  for (const a of answerData || []) {
    if (a.prompt_id) answerToPrompt[a.id] = a.prompt_id;
  }

  // ── GROUP MENTIONS BY answer_id ──
  const byAnswer = {};
  for (const m of mentionData || []) {
    if (!byAnswer[m.answer_id]) byAnswer[m.answer_id] = [];
    byAnswer[m.answer_id].push(m);
  }

  // ── ANSWER-LEVEL metrics (for presence rate) ──
  let brandMentions = 0, totalBrandChecks = 0, competitorMentions = 0;
  for (const mentions of Object.values(byAnswer)) {
    const brandMentioned   = mentions.find(m => m.entity_type === "brand"       && m.mentioned);
    const competitorsFound = mentions.filter(m => m.entity_type === "competitor" && m.mentioned);
    if (brandMentioned) brandMentions++;
    competitorMentions += competitorsFound.length;
  }
  for (const m of mentionData || []) {
    if (m.entity_type === "brand") totalBrandChecks++;
  }

  const totalAnswers      = Object.keys(byAnswer).length;
  const brandPresenceRate = totalBrandChecks > 0 ? brandMentions / totalBrandChecks : 0;

  // ── PROMPT-LEVEL win/loss/shared/missed ──────────────────────────────────
  // A prompt "wins"   if brand mentioned in ALL engines and NO competitor in ANY engine
  // A prompt "loses"  if brand missed in MAJORITY of engines and competitor present
  // A prompt "shared" if brand mentioned in at least one engine alongside a competitor
  // A prompt "missed" if brand missed in ALL engines and no competitor either
  //
  // Simpler consistent rule: per-prompt, take the MAJORITY verdict across engines.
  // If brand was mentioned in ≥50% of its answers → brand present for that prompt.
  // If competitor mentioned in ≥50% of answers for that prompt → competitor present.

  const byPrompt = {}; // promptId → { brandCount, compCount, total }
  for (const [answerId, mentions] of Object.entries(byAnswer)) {
    const promptId = answerToPrompt[answerId];
    if (!promptId) continue;

    if (!byPrompt[promptId]) byPrompt[promptId] = { brandCount: 0, compCount: 0, total: 0 };

    const brandMentioned   = mentions.some(m => m.entity_type === "brand"       && m.mentioned);
    const compMentioned    = mentions.some(m => m.entity_type === "competitor"   && m.mentioned);

    byPrompt[promptId].total++;
    if (brandMentioned) byPrompt[promptId].brandCount++;
    if (compMentioned)  byPrompt[promptId].compCount++;
  }

  let promptWins = 0, promptLosses = 0, promptShared = 0, promptMissed = 0;

  for (const { brandCount, compCount, total } of Object.values(byPrompt)) {
    const brandPresent = brandCount >= total * 0.5;   // brand in ≥50% of engines
    const compPresent  = compCount  >= total * 0.5;   // competitor in ≥50% of engines

    if      (brandPresent && !compPresent)  promptWins++;
    else if (!brandPresent && compPresent)  promptLosses++;
    else if (brandPresent  && compPresent)  promptShared++;
    else                                    promptMissed++;
  }

  const totalPrompts     = Object.keys(byPrompt).length || promptCount || 1;
  const contestedPrompts = promptWins + promptLosses + promptShared;

  console.log("\n📊 ── RAW DATA ──────────────────────────");
  console.log(`   Pages crawled:          ${pageCount}`);
  console.log(`   Pages understood:       ${understoodPages}`);
  console.log(`   Active prompts:         ${promptCount}`);
  console.log(`   AI answers tracked:     ${aiAnswerCount}`);
  console.log(`   Competitors tracked:    ${competitorCount}`);
  console.log(`   Schemas generated:      ${schemaCount}`);
  console.log(`   Gaps found:             ${gapCount}`);
  console.log(`   Recommendations:        ${recommendationCount}`);
  console.log("\n📊 ── MENTION METRICS ───────────────────");
  console.log(`   Total answers analyzed: ${totalAnswers}`);
  console.log(`   Brand presence rate:    ${(brandPresenceRate * 100).toFixed(1)}%`);
  console.log(`   Prompt-level: Wins=${promptWins} Losses=${promptLosses} Shared=${promptShared} Missed=${promptMissed}`);

  // ── SCORING ─────────────────────────────────────────────────────────────
  // Presence: how often brand appears across all answers (answer-level, out of 35)
  const presenceScore = totalAnswers > 0
    ? Math.round(brandPresenceRate * 35)
    : 0;

  // Win Rate: prompt-level wins (+ half credit for shared) out of 25
  // Denominator = totalPrompts so the displayed value makes sense to users
  const winScore = totalPrompts > 0
    ? Math.round(((promptWins + promptShared * 0.5) / totalPrompts) * 25)
    : 0;

  // Query Coverage: prompts where brand appeared at least once (out of 20)
  const coveredPrompts = promptWins + promptShared;
  const coverageScore  = Math.round((totalPrompts > 0 ? coveredPrompts / totalPrompts : 0) * 20);

  // Competitive Position: of contested prompts, how many did brand win (out of 15)
  const competitiveScore = Math.round(
    (contestedPrompts > 0 ? promptWins / contestedPrompts : 0) * 15
  );

  // Technical Readiness (out of 5) — unchanged
  let technicalScore = 0;
  if (pageCount > 0 && understoodPages > 0) {
    const schemaRatio  = Math.min(1, schemaCount / pageCount);
    const crawlRatio   = Math.min(1, understoodPages / pageCount);
    technicalScore     = Math.round(((schemaRatio + crawlRatio) / 2) * 5);
  }

  const totalScore = Math.min(100, presenceScore + winScore + coverageScore + competitiveScore + technicalScore);

  const scoreComponents = [
    {
      category: "Presence Rate",
      points:   presenceScore,
      max:      35,
      detail:   `Brand in ${(brandPresenceRate * 100).toFixed(1)}% of AI answers`,
      explanation: `How consistently your brand appears across all AI engine answers.`,
    },
    {
      category: "Win Rate",
      points:   winScore,
      max:      25,
      // ← Now shows prompt-level numbers users can verify
      detail:   `${promptWins} wins, ${promptShared} shared out of ${totalPrompts} prompts`,
      explanation: `Prompts where your brand appeared without a competitor (wins) or alongside one (shared).`,
    },
    {
      category: "Query Coverage",
      points:   coverageScore,
      max:      20,
      detail:   `Covered ${coveredPrompts}/${totalPrompts} prompts`,
      explanation: `How many of your tracked prompts returned at least one mention of your brand.`,
    },
    {
      category: "Competitive Position",
      points:   competitiveScore,
      max:      15,
      detail:   `Won ${promptWins}/${contestedPrompts} contested prompts`,
      explanation: `Of prompts where a competitor appeared, how often your brand also appeared and led.`,
    },
    {
      category: "Technical Readiness",
      points:   technicalScore,
      max:      5,
      detail:   `${schemaCount} schemas, ${understoodPages}/${pageCount} pages understood`,
      explanation: `Schema markup coverage and page comprehension quality.`,
    },
  ];

  console.log("\n📊 ── SCORE BREAKDOWN ───────────────────");
  for (const item of scoreComponents) {
    const bar = "█".repeat(Math.round((item.points / item.max) * 10)) + "░".repeat(10 - Math.round((item.points / item.max) * 10));
    console.log(`   ${item.category.padEnd(24)} ${String(item.points).padStart(2)}/${item.max} [${bar}]`);
    console.log(`   ${"".padEnd(24)} ${item.detail}`);
  }
  console.log(`\n   ${"TOTAL SCORE".padEnd(24)} ${totalScore}/100`);
  console.log("─────────────────────────────────────────\n");

  const breakdown = {
    pageCount:          pageCount          || 0,
    understoodPages:    understoodPages    || 0,
    promptCount:        promptCount        || 0,
    aiAnswerCount:      aiAnswerCount      || 0,
    competitorCount:    competitorCount    || 0,
    schemaCount:        schemaCount        || 0,
    gapCount:           gapCount           || 0,
    recommendationCount:recommendationCount|| 0,
    brandPresenceRate:  parseFloat(brandPresenceRate.toFixed(3)),
    brandMentions,
    totalBrandChecks,
    competitorMentions,
    totalAnswers,
    // Prompt-level (what users see)
    totalPrompts,
    wins:    promptWins,
    losses:  promptLosses,
    shared:  promptShared,
    missed:  promptMissed,
    scoreComponents,
  };

  // ── SAVE ──
  await supabase.from("aeo_scores").delete().eq("plan_id", planId);

  const { error: insertErr } = await supabase
    .from("aeo_scores")
    .insert({ plan_id: planId, score: totalScore, breakdown });

  if (insertErr) {
    console.error("❌ Failed to save score:", insertErr.message);
    return null;
  }

  checkAeoScoreAlert(planId, totalScore).catch(e => console.warn("⚠️  Alert check failed:", e.message));

  console.log(`✅ [ScoreJob] Score saved: ${totalScore}/100`);
  return { score: totalScore, breakdown };
}