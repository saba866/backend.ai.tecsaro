



// import { supabase } from "../config/supabase.js";
// import { crawlDomain } from "../services/scrape.service.js";
// import { generatePrompts } from "../services/aeo/promptGenerator.service.js";
// import { analyzeVisibility } from "../services/aeo/visibilityAnalyzer.service.js";

// export async function runAeoGapJob(planId) {
//   try {
//     // 1️⃣ Get brand domain
//  // 1️⃣ Get brand website_url
// const { data: plan, error } = await supabase
//   .from("plans")
//   .select("website_url")
//   .eq("id", planId)
//   .single();

// if (error || !plan) {
//   throw new Error("Plan not found or invalid planId");
// }

// // Clean domain
// const rawUrl = plan.website_url;

// const brandDomain = rawUrl
//   .replace("https://", "")
//   .replace("http://", "")
//   .replace("www.", "")
//   .split("/")[0];


//     // 2️⃣ Get approved competitors
//     const { data: competitors } = await supabase
//       .from("aeo_competitors")
//       .select("*")
//       .eq("plan_id", planId)
//       .eq("approved", true);

//     if (!competitors || competitors.length === 0) {
//       console.log("No competitors found");
//       return;
//     }

//     // 3️⃣ Crawl brand
//     const brandTopics = await crawlDomain(brandDomain);

//     // 4️⃣ Crawl competitors
//     let competitorTopics = [];
//     for (const comp of competitors) {
//       const topics = await crawlDomain(comp.domain);
//       competitorTopics = competitorTopics.concat(topics);
//     }

//     const combinedTopics = [...brandTopics, ...competitorTopics];

//     // 5️⃣ Generate prompts
//      const prompts = await generatePrompts(combinedTopics);

// if (!Array.isArray(prompts) || prompts.length === 0) {
//   console.log("No prompts generated");
//   return;
// }


// const limitedPrompts = prompts.slice(0, 5);

// const results = await Promise.all(
//   limitedPrompts.map((p) =>
//     analyzeVisibility(p.prompt, brandDomain, competitors)
//   )
// );

// for (const result of results) {
//   if (!result) continue;

//   await supabase.from("aeo_gaps").insert({
//     plan_id: planId,
//     prompt: result.prompt,
//     brand_position: result.brand_position,
//     competitor_positions: result.competitor_positions,
//     raw_answer: result.raw_answer,
//   });
// }


//     console.log("AEO Gap Job Completed");
//   } catch (err) {
//     console.error("AEO Gap Job Error:", err.message);
//   }
// }




// import { supabase } from "../config/supabase.js";
// import { crawlDomain } from "../services/scrape.service.js";
// import { generatePrompts } from "../services/aeo/promptGenerator.service.js";
// import { analyzeVisibility } from "../services/aeo/visibilityAnalyzer.service.js";

// export async function runAeoGapJob(planId) {
//   try {

//     /* =========================
//        GET BRAND DOMAIN
//     ========================== */
//     const { data: plan } = await supabase
//       .from("plans")
//       .select("website_url, name")
//       .eq("id", planId)
//       .single();

//     if (!plan) throw new Error("Plan not found");

//     const brandDomain = plan.website_url
//       .replace("https://", "")
//       .replace("http://", "")
//       .replace("www.", "")
//       .split("/")[0];

//     /* =========================
//        GET USER COMPETITORS
//     ========================== */
//     const { data: competitors } = await supabase
//       .from("aeo_competitors")
//       .select("*")
//       .eq("plan_id", planId)
//       .eq("approved", true);

//     if (!competitors?.length) {
//       console.log("No competitors found");
//       return;
//     }

//     /* =========================
//        CRAWL BRAND + COMPETITORS
//     ========================== */
//     const brandTopics = await crawlDomain(brandDomain);

//     let competitorTopics = [];
//     for (const c of competitors) {
//       const t = await crawlDomain(c.domain);
//       competitorTopics = competitorTopics.concat(t);
//     }

//     const combinedTopics = [...brandTopics, ...competitorTopics];

//     /* =========================
//        GENERATE PROMPTS
//     ========================== */
//     const prompts = await generatePrompts(combinedTopics);

//     if (!Array.isArray(prompts) || !prompts.length) {
//       console.log("No prompts generated");
//       return;
//     }

//     const limitedPrompts = prompts.slice(0, 5);

//     /* =========================
//        ANALYZE VISIBILITY + GAP
//     ========================== */
//     const results = await Promise.all(
//       limitedPrompts.map(p =>
//         analyzeVisibility(p.prompt, brandDomain, competitors)
//       )
//     );

//     for (const result of results) {
//       if (!result) continue;

//       /* -------------------------
//          GAP DETECTION
//       -------------------------- */

//       const brandMissing = result.brand_position === null;

//       const competitorFirst = result.competitor_positions
//         .filter(c => c.position !== -1)
//         .sort((a,b) => a.position - b.position)[0];

//       const lostToCompetitor =
//         competitorFirst &&
//         (result.brand_position === null ||
//          competitorFirst.position < result.brand_position);

//       const gapReasons = [];

//       if (brandMissing) gapReasons.push("brand_not_mentioned");
//       if (lostToCompetitor) gapReasons.push("competitor_dominates");

//       if (result.entities?.length) {
//         gapReasons.push("missing_entities");
//       }

//       if (result.claims?.length > 2) {
//         gapReasons.push("weak_claim_support");
//       }

//       /* -------------------------
//          STORE GAP RESULT
//       -------------------------- */

//       await supabase.from("aeo_gaps").insert({
//         plan_id: planId,
//         prompt: result.prompt,
//         brand_position: result.brand_position,
//         competitor_positions: result.competitor_positions,
//         gap_reasons: gapReasons,
//         entities_detected: result.entities,
//         claims_detected: result.claims,
//         raw_answer: result.raw_answer
//       });
//     }

//     console.log("AEO Gap Job Completed");

//   } catch (err) {
//     console.error("AEO Gap Job Error:", err.message);
//   }
// }





// import { supabase } from "../config/supabase.js";
// import { crawlDomain } from "../services/scrape.service.js";
// import { generatePrompts } from "../services/aeo/promptGenerator.service.js";
// import { generateMarketPrompts } from "../services/aeo/generateMarketPrompts.service.js";
// import { analyzeVisibility } from "../services/aeo/visibilityAnalyzer.service.js";

// export async function runAeoGapJob(planId) {
//   try {

//     /* =========================
//        GET BRAND DOMAIN + NAME
//     ========================== */
//     const { data: plan } = await supabase
//       .from("plans")
//       .select("website_url, name")
//       .eq("id", planId)
//       .single();

//     if (!plan) throw new Error("Plan not found");

//     const brandDomain = plan.website_url
//       .replace("https://", "")
//       .replace("http://", "")
//       .replace("www.", "")
//       .split("/")[0];

//     const brandName = plan.name;

//     /* =========================
//        GET APPROVED COMPETITORS
//     ========================== */
//     const { data: competitors } = await supabase
//       .from("aeo_competitors")
//       .select("*")
//       .eq("plan_id", planId)
//       .eq("approved", true);

//     if (!competitors?.length) {
//       console.log("No competitors found");
//       return;
//     }

//     /* =========================
//        CRAWL BRAND + COMPETITORS
//     ========================== */
//     const brandTopics = await crawlDomain(brandDomain);

//     let competitorTopics = [];
//     for (const c of competitors) {
//       const t = await crawlDomain(c.domain);
//       competitorTopics = competitorTopics.concat(t);
//     }

//     const combinedTopics = [...brandTopics, ...competitorTopics];

//     /* =========================
//        GENERATE PROMPTS
//     ========================== */

//     // 🔹 Brand-based prompts
//     const brandPrompts = await generatePrompts(combinedTopics);

//     // 🔹 Market-neutral prompts (THIS FIXES YOUR PROBLEM)
//     const marketPrompts = await generateMarketPrompts(brandName);

//     // 🔹 Merge prompts
//     const prompts = [
//       ...(brandPrompts || []),
//       ...(marketPrompts || [])
//     ];

//     if (!Array.isArray(prompts) || !prompts.length) {
//       console.log("No prompts generated");
//       return;
//     }

//     // 🔹 Increase prompt pool for real intelligence
//     const limitedPrompts = prompts.slice(0, 15);

//     /* =========================
//        ANALYZE VISIBILITY
//     ========================== */
//     const results = await Promise.all(
//       limitedPrompts.map(p =>
//         analyzeVisibility(p.prompt, brandDomain, competitors, plan.name)
//       )
//     );

//     /* =========================
//        STORE GAP RESULTS
//     ========================== */
//     for (const result of results) {
//       if (!result) continue;

//       const brandMissing = result.brand_position === null;

//       const competitorFirst = result.competitor_positions
//         .filter(c => c.position !== -1)
//         .sort((a, b) => a.position - b.position)[0];

//       const lostToCompetitor =
//         competitorFirst &&
//         (result.brand_position === null ||
//          competitorFirst.position < result.brand_position);

//       const gapReasons = [];

//       if (brandMissing) gapReasons.push("brand_not_mentioned");
//       if (lostToCompetitor) gapReasons.push("competitor_dominates");

//       if (result.entities?.length) {
//         gapReasons.push("missing_entities");
//       }

//       if (result.claims?.length > 2) {
//         gapReasons.push("weak_claim_support");
//       }

//       await supabase.from("aeo_gaps").insert({
//         plan_id: planId,
//         prompt: result.prompt,
//         brand_position: result.brand_position,
//         competitor_positions: result.competitor_positions,
//         gap_reasons: gapReasons,
//         entities_detected: result.entities,
//         claims_detected: result.claims,
//         raw_answer: result.raw_answer
//       });
//     }

//     console.log("AEO Gap Job Completed");

//   } catch (err) {
//     console.error("AEO Gap Job Error:", err.message);
//   }
// }





// import { supabase } from "../config/supabase.js";
// import { askAI } from "../services/aeo/index.js";
// import { safeJsonParse } from "../utils/aiJson.js";

// export async function runAeoGapJob(planId) {
//   try {
//     console.log("📊 Fetching gaps for plan:", planId);

//     // 1️⃣ Read mention results already stored by visibility job
//     const { data: mentions } = await supabase
//       .from("aeo_mention_results")
//       .select("answer_id, entity_name, entity_type, mentioned")
//       .eq("plan_id", planId);

//     if (!mentions?.length) {
//       console.log(`✅ Found 0 gaps for plan ${planId}`);
//       return;
//     }

//     // 2️⃣ Find answers where brand was NOT mentioned
//     const answerIds = [...new Set(mentions.map(m => m.answer_id))];
    
//     const gapAnswerIds = answerIds.filter(answerId => {
//       const answerMentions = mentions.filter(m => m.answer_id === answerId);
//       const brandMentioned = answerMentions.find(
//         m => m.entity_type === "brand" && m.mentioned
//       );
//       return !brandMentioned; // brand missing = gap
//     });

//     if (!gapAnswerIds.length) {
//       console.log(`✅ Found 0 gaps for plan ${planId}`);
//       return;
//     }

//     // 3️⃣ Load the actual answers and prompts for gap answers
//     const { data: answers } = await supabase
//       .from("aeo_ai_answers")
//       .select("id, prompt_id, answer_text")
//       .in("id", gapAnswerIds);

//     if (!answers?.length) return;

//     const promptIds = answers.map(a => a.prompt_id).filter(Boolean);

//     const { data: prompts } = await supabase
//       .from("aeo_prompts")
//       .select("id, prompt")
//       .in("id", promptIds);

//     const promptMap = Object.fromEntries(
//       (prompts || []).map(p => [p.id, p.prompt])
//     );

//     // 4️⃣ For each gap, identify which competitors won and why
//     for (const answer of answers) {
//       const answerMentions = mentions.filter(
//         m => m.answer_id === answer.id
//       );

//       const competitorsWon = answerMentions
//         .filter(m => m.entity_type === "competitor" && m.mentioned)
//         .map(m => m.entity_name);

//       const promptText = promptMap[answer.prompt_id] || "";

//       const gapReasons = [];
//       if (competitorsWon.length > 0) gapReasons.push("competitor_dominates");
//       else gapReasons.push("brand_not_mentioned");

//       // 5️⃣ Store gap
//       await supabase.from("aeo_gaps").insert({
//         plan_id: planId,
//         prompt: promptText,
//         brand_position: null,
//         competitor_positions: competitorsWon.map(name => ({ name, position: 1 })),
//         gap_reasons: gapReasons,
//         raw_answer: answer.answer_text
//       });
//     }

//     console.log(`✅ Found ${gapAnswerIds.length} gaps for plan ${planId}`);

//   } catch (err) {
//     console.error("❌ AEO Gap Job Error:", err.message);
//   }
// }







// import { supabase } from "../config/supabase.js";

// export async function runAeoGapJob(planId) {
//   try {
//     console.log("📊 Fetching gaps for plan:", planId);

//     const { data: mentions } = await supabase
//       .from("aeo_mention_results")
//       .select("answer_id, entity_name, entity_type, mentioned")
//       .eq("plan_id", planId);

//     if (!mentions?.length) {
//       console.log(`✅ Found 0 gaps for plan ${planId}`);
//       return;
//     }

//     // ✅ Clear old gaps before inserting fresh ones
//     await supabase.from("aeo_gaps").delete().eq("plan_id", planId);

//     const answerIds = [...new Set(mentions.map(m => m.answer_id))];

//     const gapAnswerIds = answerIds.filter(answerId => {
//       const answerMentions = mentions.filter(m => m.answer_id === answerId);
//       const brandMentioned = answerMentions.find(
//         m => m.entity_type === "brand" && m.mentioned
//       );
//       return !brandMentioned;
//     });

//     if (!gapAnswerIds.length) {
//       console.log(`✅ Found 0 gaps for plan ${planId}`);
//       return;
//     }

//     const { data: answers } = await supabase
//       .from("aeo_ai_answers")
//       .select("id, prompt_id, answer_text")
//       .in("id", gapAnswerIds);

//     if (!answers?.length) return;

//     const promptIds = answers.map(a => a.prompt_id).filter(Boolean);

//     const { data: prompts } = await supabase
//       .from("aeo_prompts")
//       .select("id, prompt")
//       .in("id", promptIds);

//     const promptMap = Object.fromEntries(
//       (prompts || []).map(p => [p.id, p.prompt])
//     );

//     const gapsToInsert = [];

//     for (const answer of answers) {
//       const answerMentions = mentions.filter(m => m.answer_id === answer.id);

//       const competitorsWon = answerMentions
//         .filter(m => m.entity_type === "competitor" && m.mentioned)
//         .map(m => ({ name: m.entity_name, position: 1 }));

//       const promptText = promptMap[answer.prompt_id] || "";
//       const gapReasons = [];

//       if (competitorsWon.length > 0) gapReasons.push("competitor_dominates");
//       gapReasons.push("brand_not_mentioned");

//       gapsToInsert.push({
//         plan_id: planId,
//         prompt: promptText,
//         brand_position: null,
//         competitor_positions: competitorsWon,
//         gap_reasons: gapReasons,
//         raw_answer: answer.answer_text
//       });
//     }

//     const { error: insertErr } = await supabase
//       .from("aeo_gaps")
//       .insert(gapsToInsert);

//     if (insertErr) {
//       console.error("❌ Failed to insert gaps:", insertErr.message);
//       return;
//     }

//     console.log(`✅ Found ${gapsToInsert.length} gaps for plan ${planId}`);

//   } catch (err) {
//     console.error("❌ AEO Gap Job Error:", err.message);
//   }
// }



// import { supabase } from "../config/supabase.js";

// export async function runAeoGapJob(planId) {
//   try {
//     console.log("📊 Fetching gaps for plan:", planId);

//     const { data: mentions } = await supabase
//       .from("aeo_mention_results")
//       .select("answer_id, entity_name, entity_type, mentioned")
//       .eq("plan_id", planId);

//     if (!mentions?.length) {
//       console.log(`✅ Found 0 gaps for plan ${planId}`);
//       return [];
//     }

//     // ✅ Clear old gaps before inserting fresh ones
//     await supabase.from("aeo_gaps").delete().eq("plan_id", planId);

//     const answerIds = [...new Set(mentions.map(m => m.answer_id))];

//     const gapAnswerIds = answerIds.filter(answerId => {
//       const answerMentions = mentions.filter(m => m.answer_id === answerId);
//       const brandMentioned = answerMentions.find(
//         m => m.entity_type === "brand" && m.mentioned
//       );
//       return !brandMentioned;
//     });

//     if (!gapAnswerIds.length) {
//       console.log(`✅ Found 0 gaps for plan ${planId}`);
//       return [];
//     }

//     const { data: answers } = await supabase
//       .from("aeo_ai_answers")
//       .select("id, prompt_id, answer_text")
//       .in("id", gapAnswerIds);

//     if (!answers?.length) return [];

//     const promptIds = answers.map(a => a.prompt_id).filter(Boolean);

//     const { data: prompts } = await supabase
//       .from("aeo_prompts")
//       .select("id, prompt")
//       .in("id", promptIds);

//     const promptMap = Object.fromEntries(
//       (prompts || []).map(p => [p.id, p.prompt])
//     );

//     const gapsToInsert = [];

//     for (const answer of answers) {
//       const answerMentions = mentions.filter(m => m.answer_id === answer.id);

//       const competitorsWon = answerMentions
//         .filter(m => m.entity_type === "competitor" && m.mentioned)
//         .map(m => ({ name: m.entity_name, position: 1 }));

//       const promptText = promptMap[answer.prompt_id] || "";
//       const gapReasons = [];

//       if (competitorsWon.length > 0) gapReasons.push("competitor_dominates");
//       gapReasons.push("brand_not_mentioned");

//       gapsToInsert.push({
//         plan_id: planId,
//         prompt: promptText,
//         brand_position: null,
//         competitor_positions: competitorsWon,
//         gap_reasons: gapReasons,
//         raw_answer: answer.answer_text
//       });
//     }

//     // ✅ Return inserted gaps with their IDs
//     const { data: insertedGaps, error: insertErr } = await supabase
//       .from("aeo_gaps")
//       .insert(gapsToInsert)
//       .select("id, prompt, gap_reasons, competitor_positions, raw_answer"); // 👈 get IDs back

//     if (insertErr) {
//       console.error("❌ Failed to insert gaps:", insertErr.message);
//       return [];
//     }

//     console.log(`✅ Found ${insertedGaps.length} gaps for plan ${planId}`);
//     return insertedGaps; // 👈 return so recommendation engine can use gap.id

//   } catch (err) {
//     console.error("❌ AEO Gap Job Error:", err.message);
//     return [];
//   }
// }



import { supabase } from "../config/supabase.js";
import { generateBulkGapSuggestions } from "../services/aeo/aeoGapSuggestion.service.js";

// ─────────────────────────────────────────
// AEO GAP JOB
//
// FLOW:
// 1. Load mention results for this plan
// 2. Group by prompt (not answer_id) for accurate win_rate
// 3. For each prompt:
//    a. Check brand mentioned across all answers
//    b. Identify which competitors won
//    c. Calculate brand_mentioned % and win_rate
//    d. Build gap_reasons array
// 4. Delete old gaps
// 5. Insert fresh gaps
// 6. Generate suggestions in bulk
// 7. Return inserted gaps for recommendation job
// ─────────────────────────────────────────
export async function runAeoGapJob(planId) {
  try {
    console.log("\n📊 [GapJob] Starting for plan:", planId);

    // ── STEP 1: LOAD MENTION RESULTS ──
    const { data: mentions, error: mentionErr } = await supabase
      .from("aeo_mention_results")
      .select("answer_id, entity_name, entity_type, mentioned, position")
      .eq("plan_id", planId);

    if (mentionErr) {
      console.error("❌ Failed to load mention results:", mentionErr.message);
      return [];
    }

    if (!mentions?.length) {
      console.log("⚠️  No mention results found — skipping gap analysis");
      return [];
    }

    // ── STEP 2: LOAD ANSWERS WITH PROMPT CONTEXT ──
    const answerIds = [...new Set(mentions.map((m) => m.answer_id))];

    const { data: answers, error: answerErr } = await supabase
      .from("aeo_ai_answers")
      .select("id, prompt_id, answer_text, engine")
      .in("id", answerIds);

    if (answerErr || !answers?.length) {
      console.error("❌ Failed to load answers:", answerErr?.message);
      return [];
    }

    // ── STEP 3: LOAD PROMPTS ──
    const promptIds = [...new Set(answers.map((a) => a.prompt_id).filter(Boolean))];

    const { data: prompts, error: promptErr } = await supabase
      .from("aeo_prompts")
      .select("id, prompt")
      .in("id", promptIds);

    if (promptErr) {
      console.error("❌ Failed to load prompts:", promptErr?.message);
      return [];
    }

    // ── STEP 4: LOAD PLAN (for brand name in suggestions) ──
    const { data: plan } = await supabase
      .from("plans")
      .select("name")
      .eq("id", planId)
      .single();

    const brandName = plan?.name || "your brand";

    // Build lookup maps
    const promptMap  = Object.fromEntries((prompts || []).map((p) => [p.id, p.prompt]));
    const answerMap  = Object.fromEntries(answers.map((a) => [a.id, a]));

    // ── STEP 5: GROUP MENTIONS BY PROMPT ──
    // Each prompt may have multiple answers (one per engine).
    // We need win_rate across all engines for that prompt.
    const promptGroups = {}; // promptId → { promptText, answers: [{ answerId, mentions[] }] }

    for (const answer of answers) {
      if (!answer.prompt_id) continue;
      if (!promptGroups[answer.prompt_id]) {
        promptGroups[answer.prompt_id] = {
          promptText: promptMap[answer.prompt_id] || "",
          answers: [],
        };
      }
      const answerMentions = mentions.filter((m) => m.answer_id === answer.id);
      promptGroups[answer.prompt_id].answers.push({
        answerId:    answer.id,
        answerText:  answer.answer_text,
        engine:      answer.engine,
        mentions:    answerMentions,
      });
    }

    // ── STEP 6: ANALYZE EACH PROMPT ──
    const gapsToInsert = [];

    for (const [promptId, group] of Object.entries(promptGroups)) {
      const { promptText, answers: promptAnswers } = group;
      if (!promptText) continue;

      let brandMentionedCount = 0;
      let totalAnswers        = promptAnswers.length;
      const competitorTally   = {}; // name → mention count

      for (const ans of promptAnswers) {
        const brandMention = ans.mentions.find(
          (m) => m.entity_type === "brand" && m.mentioned === true
        );
        if (brandMention) brandMentionedCount++;

        // Tally competitor appearances
        for (const m of ans.mentions) {
          if (m.entity_type === "competitor" && m.mentioned === true) {
            competitorTally[m.entity_name] = (competitorTally[m.entity_name] || 0) + 1;
          }
        }
      }

      const brandMentionRate = totalAnswers > 0
        ? Math.round((brandMentionedCount / totalAnswers) * 100)
        : 0;

      // Build sorted competitor positions (most mentioned first)
      const competitorPositions = Object.entries(competitorTally)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          mention_count: count,
          win_rate: Math.round((count / totalAnswers) * 100),
        }));

      const hasCompetitors  = competitorPositions.length > 0;
      const brandMissing    = brandMentionedCount === 0;
      const brandDominating = brandMentionRate >= 60;

      // Build gap reasons
      const gapReasons = [];
      if (brandMissing)    gapReasons.push("brand_not_mentioned");
      if (hasCompetitors && brandMissing)  gapReasons.push("competitor_dominates");
      if (hasCompetitors && !brandMissing) gapReasons.push("competitor_present");
      if (!brandMissing && !hasCompetitors && brandDominating) gapReasons.push("brand_winning");

      // Use most recent answer text for raw_answer
      const latestAnswer = promptAnswers[promptAnswers.length - 1];

      gapsToInsert.push({
        plan_id:              planId,
        prompt_id:            promptId,
        prompt:               promptText,
        brand_mentioned:      !brandMissing,
        brand_mention_rate:   brandMentionRate,
        win_rate:             brandMentionRate,
        brand_position:       brandMentionedCount > 0 ? 1 : null,
        competitor_positions: competitorPositions,
        gap_reasons:          gapReasons,
        raw_answer:           latestAnswer?.answerText || null,
        engines_checked:      totalAnswers,
        created_at:           new Date().toISOString(),
      });
    }

    if (!gapsToInsert.length) {
      console.log("✅ No gaps found — brand is mentioned in all answers");

      // Still clear old gaps so stale data doesn't persist
      await supabase.from("aeo_gaps").delete().eq("plan_id", planId);
      return [];
    }

    // ── STEP 7: DELETE OLD GAPS ──
    const { error: deleteErr } = await supabase
      .from("aeo_gaps")
      .delete()
      .eq("plan_id", planId);

    if (deleteErr) {
      console.error("❌ Failed to delete old gaps:", deleteErr.message);
      return [];
    }

    // ── STEP 8: INSERT FRESH GAPS ──
    const { data: insertedGaps, error: insertErr } = await supabase
      .from("aeo_gaps")
      .insert(gapsToInsert)
      .select("id, prompt, prompt_id, gap_reasons, competitor_positions, brand_mentioned, win_rate, raw_answer");

    if (insertErr) {
      console.error("❌ Failed to insert gaps:", insertErr.message);
      return [];
    }

    console.log(`✅ [GapJob] Inserted ${insertedGaps.length} gaps`);

    // ── STEP 9: GENERATE BULK SUGGESTIONS ──
    // Attach suggestion text to each gap in DB
    try {
      console.log("💡 Generating gap suggestions...");
      const suggestions = await generateBulkGapSuggestions(insertedGaps, brandName);

      for (const [gapId, suggestion] of Object.entries(suggestions)) {
        await supabase
          .from("aeo_gaps")
          .update({ suggestion })
          .eq("id", gapId);
      }

      console.log(`✅ Suggestions generated for ${Object.keys(suggestions).length} gaps`);
    } catch (err) {
      // Non-fatal — gaps still usable without suggestions
      console.warn("⚠️  Bulk suggestion generation failed:", err.message);
    }

    // ── SUMMARY ──
    const brandMissingCount  = gapsToInsert.filter((g) => g.gap_reasons.includes("brand_not_mentioned")).length;
    const competitorWinCount = gapsToInsert.filter((g) => g.gap_reasons.includes("competitor_dominates")).length;
    const winningCount       = gapsToInsert.filter((g) => g.gap_reasons.includes("brand_winning")).length;

    console.log(`\n📊 [GapJob] Summary:`);
    console.log(`   Brand missing:      ${brandMissingCount}`);
    console.log(`   Competitor winning: ${competitorWinCount}`);
    console.log(`   Brand winning:      ${winningCount}`);

    return insertedGaps;

  } catch (err) {
    console.error("❌ [GapJob] Crashed:", err.message);
    return [];
  }
}