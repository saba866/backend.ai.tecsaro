







// // import { supabase }      from "../config/supabase.js";
// // import { safeJsonParse } from "../utils/aiJson.js";
// // import { runGemini }     from "../services/aeo/gemini.js";
// // import OpenAI            from "openai";

// // const openai     = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// // const sleep      = (ms) => new Promise((r) => setTimeout(r, ms));
// // const BATCH_SIZE = 10;

// // // ─────────────────────────────────────────
// // // ENGINE FUNCTIONS
// // // ─────────────────────────────────────────
// // async function askChatGPT(prompt) {
// //   try {
// //     const response = await openai.chat.completions.create({
// //       model: "gpt-4o-mini", max_tokens: 400, temperature: 0.3,
// //       messages: [
// //         { role: "system", content: "You are a helpful AI assistant. Answer clearly, mentioning relevant tools, platforms, and brands by name." },
// //         { role: "user",   content: prompt },
// //       ],
// //     });
// //     return response.choices[0]?.message?.content || null;
// //   } catch (err) { console.error("❌ ChatGPT error:", err.message); return null; }
// // }

// // async function askGeminiVisibility(prompt) {
// //   try {
// //     const result = await runGemini(
// //       `Answer this question naturally, naming real tools, platforms, and brands:\n\n${prompt}`,
// //       { temperature: 0.3, maxOutputTokens: 400 }
// //     );
// //     if (!result) return null;
// //     try {
// //       const parsed = JSON.parse(result);
// //       return parsed?.answer || parsed?.summary || parsed?.text || result;
// //     } catch { return result; }
// //   } catch (err) { console.error("❌ Gemini error:", err.message); return null; }
// // }

// // async function askPerplexityVisibility(prompt) {
// //   try {
// //     const response = await fetch("https://api.perplexity.ai/chat/completions", {
// //       method: "POST",
// //       headers: { "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
// //       body: JSON.stringify({
// //         model: "sonar", max_tokens: 400, temperature: 0.2,
// //         messages: [
// //           { role: "system", content: "Answer clearly, naming real tools, platforms, and brands." },
// //           { role: "user",   content: prompt },
// //         ],
// //       }),
// //     });
// //     if (!response.ok) return null;
// //     const data = await response.json();
// //     return data.choices?.[0]?.message?.content || null;
// //   } catch (err) { console.error("❌ Perplexity error:", err.message); return null; }
// // }

// // // ─────────────────────────────────────────
// // // DETECTION
// // // ─────────────────────────────────────────
// // function normalize(str = "") {
// //   return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
// // }

// // function firstIndex(normalizedText, aliases) {
// //   let earliest = Infinity;
// //   for (const alias of aliases) {
// //     if (alias.length < 3) continue;
// //     const idx = normalizedText.indexOf(alias);
// //     if (idx !== -1 && idx < earliest) earliest = idx;
// //   }
// //   return earliest;
// // }

// // function detectMentions(answerText, brandProfile, competitorProfiles) {
// //   const normalized = normalize(answerText);

// //   const brandAliases = [
// //     brandProfile.name,
// //     brandProfile.domain?.replace(/\.(com|ai|co|io|org|net)$/i, ""),
// //     ...(brandProfile.aliases || []),
// //   ].filter(Boolean).map(normalize);

// //   const competitorEntries = competitorProfiles.map((c) => ({
// //     entity_name: c.name || c.domain,
// //     entity_type: "competitor",
// //     aliases: [
// //       c.name,
// //       c.domain?.replace(/\.(com|ai|co|io|org|net)$/i, ""),
// //       ...(c.aliases || []),
// //     ].filter(Boolean).map(normalize),
// //   }));

// //   const allEntities = [
// //     { entity_name: brandProfile.name || "brand", entity_type: "brand", aliases: brandAliases },
// //     ...competitorEntries,
// //   ].map((e) => ({
// //     ...e,
// //     firstIdx:  firstIndex(normalized, e.aliases),
// //     mentioned: firstIndex(normalized, e.aliases) !== Infinity,
// //   }));

// //   const mentionedEntities = allEntities
// //     .filter((e) => e.mentioned)
// //     .sort((a, b) => a.firstIdx - b.firstIdx);

// //   const positionMap = {};
// //   mentionedEntities.forEach((e, idx) => { positionMap[e.entity_name] = idx + 1; });

// //   return allEntities.map((e) => ({
// //     entity_name: e.entity_name,
// //     entity_type: e.entity_type,
// //     mentioned:   e.mentioned,
// //     position:    e.mentioned ? (positionMap[e.entity_name] ?? null) : null,
// //   }));
// // }

// // // ─────────────────────────────────────────
// // // SAVE ONE ENGINE RESULT
// // // ─────────────────────────────────────────
// // async function saveEngineResult(planId, promptId, engine, answerText, brandProfile, competitorProfiles) {
// //   if (!answerText) return null;

// //   const { data: answerRow, error: insertErr } = await supabase
// //     .from("aeo_ai_answers")
// //     .insert({ plan_id: planId, prompt_id: promptId, engine, answer_text: answerText, created_at: new Date().toISOString() })
// //     .select("id")
// //     .single();

// //   if (insertErr || !answerRow) {
// //     console.error(`   ❌ [${engine}] Save failed:`, insertErr?.message);
// //     return null;
// //   }

// //   const mentions         = detectMentions(answerText, brandProfile, competitorProfiles);
// //   const brandResult      = mentions.find((m) => m.entity_type === "brand");
// //   const brandMentioned   = brandResult?.mentioned || false;
// //   const brandPosition    = brandResult?.position  ?? null;
// //   const competitorsFound = mentions.filter((m) => m.entity_type === "competitor" && m.mentioned).map((m) => m.entity_name);

// //   console.log(`   ✅ [${engine}] Brand: ${brandMentioned ? `✓ pos=${brandPosition}` : "✗"} | Competitors: ${competitorsFound.join(", ") || "none"}`);

// //   if (mentions.length > 0) {
// //     await supabase.from("aeo_mention_results").insert(
// //       mentions.map((m) => ({
// //         plan_id:     planId,
// //         answer_id:   answerRow.id,
// //         entity_name: m.entity_name,
// //         entity_type: m.entity_type,
// //         mentioned:   m.mentioned,
// //         position:    m.position,
// //       }))
// //     );
// //   }

// //   return { answerId: answerRow.id, brandMentioned, brandPosition, competitorsFound };
// // }

// // // ─────────────────────────────────────────
// // // PROCESS ONE PROMPT
// // // ─────────────────────────────────────────
// // async function processPrompt(p, engineNames, engineFns, planId, brandProfile, competitorProfiles) {
// //   const results = await Promise.allSettled(engineFns.map((fn) => fn(p.prompt)));
// //   const answers = [];
// //   let anySuccess = false;

// //   for (let e = 0; e < results.length; e++) {
// //     const answer     = results[e].status === "fulfilled" ? results[e].value : null;
// //     const engineName = engineNames[e];
// //     if (!answer) { console.log(`   ⚠️  [${engineName}] No answer`); continue; }
// //     await saveEngineResult(planId, p.id, engineName, answer, brandProfile, competitorProfiles);
// //     answers.push(answer);
// //     anySuccess = true;
// //   }

// //   return { anySuccess, answers };
// // }

// // // ─────────────────────────────────────────
// // // DISCOVER NEW COMPETITORS
// // //
// // // Fixes vs old version:
// // //  1. onConflict was "plan_id,name" → no such constraint → now "plan_id,domain"
// // //  2. AI returned string names → domain was never set → now asks for {name, domain} pairs
// // //  3. status was "pending_approval" → suggestions never showed → now "active"
// // // ─────────────────────────────────────────
// // async function discoverNewCompetitors(planId, allAnswers) {
// //   if (!allAnswers.length) return;

// //   try {
// //     const combinedText = allAnswers.join(" ").slice(0, 3000);

// //     const response = await openai.chat.completions.create({
// //       model:           "gpt-4o-mini",
// //       max_tokens:      400,
// //       temperature:     0,
// //       response_format: { type: "json_object" },
// //       messages: [
// //         {
// //           role:    "system",
// //           content: "Extract all software tools, platforms, SaaS products, or services mentioned. Return JSON only.",
// //         },
// //         {
// //           role:    "user",
// //           content: `Extract every tool/platform/service from this text.\n\n${combinedText}\n\nReturn ONLY this JSON shape — include the website domain for each:\n{ "tools": [{ "name": "Acuity Scheduling", "domain": "acuityscheduling.com" }, { "name": "Doodle", "domain": "doodle.com" }] }`,
// //         },
// //       ],
// //     });

// //     const parsed = safeJsonParse(response.choices[0]?.message?.content || "{}");
// //     const tools  = Array.isArray(parsed?.tools) ? parsed.tools : [];
// //     if (!tools.length) return;

// //     // Fetch known competitors + brand to avoid duplicates
// //     const [{ data: known }, { data: brand }] = await Promise.all([
// //       supabase.from("aeo_competitors").select("name, domain").eq("plan_id", planId),
// //       supabase.from("aeo_brand_profile").select("brand_name, domain").eq("plan_id", planId).maybeSingle(),
// //     ]);

// //     const knownValues = [
// //       brand?.brand_name, brand?.domain,
// //       ...(known || []).flatMap((c) => [c.name, c.domain]),
// //     ].filter(Boolean).map((n) => n.toLowerCase());

// //     const newTools = tools
// //       .filter((t) => t?.name && t.name.length > 2 && !knownValues.includes(t.name.toLowerCase()))
// //       .slice(0, 10);

// //     if (!newTools.length) return;

// //     await Promise.allSettled(newTools.map(async (tool) => {
// //       // Clean domain — fallback: slugify name + .com
// //       let domain = (tool.domain || "")
// //         .toLowerCase()
// //         .replace(/^https?:\/\//, "")
// //         .replace(/^www\./, "")
// //         .split("/")[0]
// //         .trim();

// //       if (!domain || !domain.includes(".")) {
// //         domain = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".com";
// //       }

// //       // Check if already exists by domain
// //       const { data: existing } = await supabase
// //         .from("aeo_competitors")
// //         .select("id, times_seen, status")
// //         .eq("plan_id", planId)
// //         .eq("domain", domain)
// //         .maybeSingle();

// //       if (existing?.status === "ignored") return;

// //       const { error } = await supabase
// //         .from("aeo_competitors")
// //         .upsert(
// //           {
// //             plan_id:          planId,
// //             domain,                         // ← required for unique constraint
// //             name:             tool.name,
// //             source:           "ai",
// //             classification:   "direct",
// //             confidence_score: 0.5,
// //             approved:         false,
// //             status:           "active",     // ← was "pending_approval" — suggestions were hidden
// //             times_seen:       (existing?.times_seen || 0) + 1,
// //             detected_reason:  "Found in AI visibility answers",
// //             last_seen_at:     new Date().toISOString(),
// //           },
// //           { onConflict: "plan_id,domain" }  // ← THE FIX: was "plan_id,name" (constraint doesn't exist)
// //         );

// //       if (error) {
// //         console.error(`   ❌ Failed to upsert ${tool.name}:`, error.message);
// //       } else {
// //         console.log(`   ✅ Competitor saved: ${tool.name} (${domain})`);
// //       }
// //     }));

// //     console.log(`💡 Discovered ${newTools.length} new competitors: ${newTools.map(t => t.name).join(", ")}`);
// //   } catch (err) {
// //     console.error("❌ Competitor discovery failed:", err.message);
// //   }
// // }

// // // ─────────────────────────────────────────
// // // MAIN
// // // ─────────────────────────────────────────
// // export async function runVisibilityJob(planId) {
// //   console.log("\n🔭 [VisibilityJob] Starting for plan:", planId);

// //   const { data: plan } = await supabase.from("plans").select("tier, name").eq("id", planId).single();
// //   const tier  = plan?.tier || "starter";
// //   const isPro = tier === "pro";

// //   const engineNames = isPro ? ["chatgpt", "gemini", "perplexity"] : ["chatgpt", "gemini"];
// //   const engineFns   = isPro ? [askChatGPT, askGeminiVisibility, askPerplexityVisibility] : [askChatGPT, askGeminiVisibility];

// //   console.log(`📦 Tier: ${tier.toUpperCase()} | Engines: ${engineNames.join(", ")}`);

// //   const { data: prompts, error: promptErr } = await supabase
// //     .from("aeo_prompts")
// //     .select("id, prompt")
// //     .eq("plan_id", planId)
// //     .in("status", ["active", "manually_added"])
// //     .order("created_at", { ascending: true });

// //   if (promptErr || !prompts?.length) { console.log("ℹ️  No active prompts — skipping"); return; }

// //   console.log(`📊 ${prompts.length} prompts × ${engineNames.length} engines = ${prompts.length * engineNames.length} answers`);

// //   const [{ data: brand }, { data: competitors }] = await Promise.all([
// //     supabase.from("aeo_brand_profile").select("brand_name, domain, aliases").eq("plan_id", planId).maybeSingle(),
// //     supabase.from("aeo_competitors").select("name, domain, aliases").eq("plan_id", planId).eq("status", "active").eq("approved", true),
// //   ]);

// //   const brandProfile = {
// //     name:    brand?.brand_name || plan?.name || "",
// //     domain:  brand?.domain     || "",
// //     aliases: brand?.aliases    || [],
// //   };

// //   const competitorProfiles = (competitors || []).map((c) => ({
// //     name: c.name || c.domain, domain: c.domain || "", aliases: c.aliases || [],
// //   }));

// //   console.log(`🧠 Brand: "${brandProfile.name}" | Competitors: ${competitorProfiles.length}`);

// //   const allAnswers = [];
// //   let tracked = 0, failed = 0;

// //   for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
// //     const batch   = prompts.slice(i, i + BATCH_SIZE);
// //     const batchNo = Math.floor(i / BATCH_SIZE) + 1;
// //     const total   = Math.ceil(prompts.length / BATCH_SIZE);

// //     console.log(`\n📦 Batch [${batchNo}/${total}] — ${batch.length} prompts in parallel`);

// //     const results = await Promise.allSettled(
// //       batch.map((p) => {
// //         console.log(`   📍 "${p.prompt.slice(0, 55)}..."`);
// //         return processPrompt(p, engineNames, engineFns, planId, brandProfile, competitorProfiles);
// //       })
// //     );

// //     for (const result of results) {
// //       if (result.status === "rejected") { failed++; continue; }
// //       const { anySuccess, answers } = result.value;
// //       if (anySuccess) { tracked++; allAnswers.push(...answers); }
// //       else              failed++;
// //     }

// //     if (i + BATCH_SIZE < prompts.length) await sleep(200);
// //   }

// //   if (allAnswers.length > 0) {
// //     console.log("\n🔍 Scanning answers for new competitors...");
// //     await discoverNewCompetitors(planId, allAnswers);
// //   }

// //   console.log(`\n✅ [VisibilityJob] Complete`);
// //   console.log(`   Tier:    ${tier} (${engineNames.join(" + ")})`);
// //   console.log(`   Tracked: ${tracked}/${prompts.length} prompts`);
// //   console.log(`   Failed:  ${failed}`);
// // }

// // export { runVisibilityJob as startVisibilityJob };



// import { supabase }        from "../config/supabase.js"
// import { safeJsonParse }   from "../utils/aiJson.js"
// import { runGemini }       from "../services/aeo/gemini.js"
// import { askOpenAI, askOpenAIText } from "../services/aeo/openai.js"
// import { askPerplexity }   from "../services/aeo/perplexity.js"

// const sleep      = (ms) => new Promise((r) => setTimeout(r, ms))
// const BATCH_SIZE = 10

// // ─────────────────────────────────────────
// // TIER → ENGINE MAP
// // free    → gemini only
// // starter → chatgpt + gemini
// // pro     → chatgpt + gemini + perplexity
// // ─────────────────────────────────────────
// const TIER_ENGINES = {
//   free:    ["gemini"],
//   starter: ["chatgpt", "gemini"],
//   pro:     ["chatgpt", "gemini", "perplexity"],
// }

// // ─────────────────────────────────────────
// // GEMINI WRAPPER
// // Strips JSON wrapper if Gemini returns one
// // ─────────────────────────────────────────
// async function askGeminiVisibility(prompt) {
//   try {
//     const result = await runGemini(
//       `Answer this question naturally, naming real tools, platforms, and brands:\n\n${prompt}`,
//       { temperature: 0.3, maxOutputTokens: 400 }
//     )
//     if (!result) return null
//     try {
//       const parsed = JSON.parse(result)
//       return parsed?.answer || parsed?.summary || parsed?.text || result
//     } catch { return result }
//   } catch (err) { console.error("❌ Gemini error:", err.message); return null }
// }

// // ─────────────────────────────────────────
// // ENGINE NAME → FUNCTION MAP
// // All engine functions imported from services
// // ─────────────────────────────────────────
// const ENGINE_FN_MAP = {
//   chatgpt:    (prompt) => askOpenAIText(prompt),
//   gemini:     (prompt) => askGeminiVisibility(prompt),
//   perplexity: (prompt) => askPerplexity(prompt),
// }

// // ─────────────────────────────────────────
// // DETECTION
// // ─────────────────────────────────────────
// function normalize(str = "") {
//   return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
// }

// function firstIndex(normalizedText, aliases) {
//   let earliest = Infinity
//   for (const alias of aliases) {
//     if (alias.length < 3) continue
//     const idx = normalizedText.indexOf(alias)
//     if (idx !== -1 && idx < earliest) earliest = idx
//   }
//   return earliest
// }

// function detectMentions(answerText, brandProfile, competitorProfiles) {
//   const normalized = normalize(answerText)

//   const brandAliases = [
//     brandProfile.name,
//     brandProfile.domain?.replace(/\.(com|ai|co|io|org|net)$/i, ""),
//     ...(brandProfile.aliases || []),
//   ].filter(Boolean).map(normalize)

//   const competitorEntries = competitorProfiles.map((c) => ({
//     entity_name: c.name || c.domain,
//     entity_type: "competitor",
//     aliases: [
//       c.name,
//       c.domain?.replace(/\.(com|ai|co|io|org|net)$/i, ""),
//       ...(c.aliases || []),
//     ].filter(Boolean).map(normalize),
//   }))

//   const allEntities = [
//     { entity_name: brandProfile.name || "brand", entity_type: "brand", aliases: brandAliases },
//     ...competitorEntries,
//   ].map((e) => ({
//     ...e,
//     firstIdx:  firstIndex(normalized, e.aliases),
//     mentioned: firstIndex(normalized, e.aliases) !== Infinity,
//   }))

//   const mentionedEntities = allEntities
//     .filter((e) => e.mentioned)
//     .sort((a, b) => a.firstIdx - b.firstIdx)

//   const positionMap = {}
//   mentionedEntities.forEach((e, idx) => { positionMap[e.entity_name] = idx + 1 })

//   return allEntities.map((e) => ({
//     entity_name: e.entity_name,
//     entity_type: e.entity_type,
//     mentioned:   e.mentioned,
//     position:    e.mentioned ? (positionMap[e.entity_name] ?? null) : null,
//   }))
// }

// // ─────────────────────────────────────────
// // SAVE ONE ENGINE RESULT
// // ─────────────────────────────────────────
// async function saveEngineResult(planId, promptId, engine, answerText, brandProfile, competitorProfiles) {
//   if (!answerText) return null

//   const { data: answerRow, error: insertErr } = await supabase
//     .from("aeo_ai_answers")
//     .insert({ plan_id: planId, prompt_id: promptId, engine, answer_text: answerText, created_at: new Date().toISOString() })
//     .select("id")
//     .single()

//   if (insertErr || !answerRow) {
//     console.error(`   ❌ [${engine}] Save failed:`, insertErr?.message)
//     return null
//   }

//   const mentions         = detectMentions(answerText, brandProfile, competitorProfiles)
//   const brandResult      = mentions.find((m) => m.entity_type === "brand")
//   const brandMentioned   = brandResult?.mentioned || false
//   const brandPosition    = brandResult?.position  ?? null
//   const competitorsFound = mentions.filter((m) => m.entity_type === "competitor" && m.mentioned).map((m) => m.entity_name)

//   console.log(`   ✅ [${engine}] Brand: ${brandMentioned ? `✓ pos=${brandPosition}` : "✗"} | Competitors: ${competitorsFound.join(", ") || "none"}`)

//   if (mentions.length > 0) {
//     await supabase.from("aeo_mention_results").insert(
//       mentions.map((m) => ({
//         plan_id:     planId,
//         answer_id:   answerRow.id,
//         entity_name: m.entity_name,
//         entity_type: m.entity_type,
//         mentioned:   m.mentioned,
//         position:    m.position,
//         engine,
//       }))
//     )
//   }

//   return { answerId: answerRow.id, brandMentioned, brandPosition, competitorsFound }
// }

// // ─────────────────────────────────────────
// // PROCESS ONE PROMPT
// // ─────────────────────────────────────────
// async function processPrompt(p, engineNames, engineFns, planId, brandProfile, competitorProfiles) {
//   const results  = await Promise.allSettled(engineFns.map((fn) => fn(p.prompt)))
//   const answers  = []
//   let anySuccess = false

//   for (let e = 0; e < results.length; e++) {
//     const answer     = results[e].status === "fulfilled" ? results[e].value : null
//     const engineName = engineNames[e]
//     if (!answer) { console.log(`   ⚠️  [${engineName}] No answer`); continue }
//     await saveEngineResult(planId, p.id, engineName, answer, brandProfile, competitorProfiles)
//     answers.push(answer)
//     anySuccess = true
//   }

//   return { anySuccess, answers }
// }

// // ─────────────────────────────────────────
// // DISCOVER NEW COMPETITORS
// // Uses askOpenAI (JSON mode) from service
// // Skipped for free tier
// // ─────────────────────────────────────────
// async function discoverNewCompetitors(planId, allAnswers, tier) {
//   if (!allAnswers.length) return
//   if (tier === "free") {
//     console.log("ℹ️  [discoverCompetitors] Skipped for free tier")
//     return
//   }

//   try {
//     const combinedText = allAnswers.join(" ").slice(0, 3000)

//     const raw = await askOpenAI(
//       `Extract every tool/platform/service from this text.\n\n${combinedText}\n\nReturn ONLY this JSON shape — include the website domain for each:\n{ "tools": [{ "name": "Acuity Scheduling", "domain": "acuityscheduling.com" }, { "name": "Doodle", "domain": "doodle.com" }] }`,
//       { max_tokens: 400 }
//     )

//     const parsed = safeJsonParse(raw || "{}")
//     const tools  = Array.isArray(parsed?.tools) ? parsed.tools : []
//     if (!tools.length) return

//     const [{ data: known }, { data: brand }] = await Promise.all([
//       supabase.from("aeo_competitors").select("name, domain").eq("plan_id", planId),
//       supabase.from("aeo_brand_profile").select("brand_name, domain").eq("plan_id", planId).maybeSingle(),
//     ])

//     const knownValues = [
//       brand?.brand_name, brand?.domain,
//       ...(known || []).flatMap((c) => [c.name, c.domain]),
//     ].filter(Boolean).map((n) => n.toLowerCase())

//     const newTools = tools
//       .filter((t) => t?.name && t.name.length > 2 && !knownValues.includes(t.name.toLowerCase()))
//       .slice(0, 10)

//     if (!newTools.length) return

//     await Promise.allSettled(newTools.map(async (tool) => {
//       let domain = (tool.domain || "")
//         .toLowerCase()
//         .replace(/^https?:\/\//, "")
//         .replace(/^www\./, "")
//         .split("/")[0]
//         .trim()

//       if (!domain || !domain.includes(".")) {
//         domain = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".com"
//       }

//       const { data: existing } = await supabase
//         .from("aeo_competitors")
//         .select("id, times_seen, status")
//         .eq("plan_id", planId)
//         .eq("domain", domain)
//         .maybeSingle()

//       if (existing?.status === "ignored") return

//       const { error } = await supabase
//         .from("aeo_competitors")
//         .upsert(
//           {
//             plan_id:          planId,
//             domain,
//             name:             tool.name,
//             source:           "ai",
//             classification:   "direct",
//             confidence_score: 0.5,
//             approved:         false,
//             status:           "active",
//             times_seen:       (existing?.times_seen || 0) + 1,
//             detected_reason:  "Found in AI visibility answers",
//             last_seen_at:     new Date().toISOString(),
//           },
//           { onConflict: "plan_id,domain" }
//         )

//       if (error) {
//         console.error(`   ❌ Failed to upsert ${tool.name}:`, error.message)
//       } else {
//         console.log(`   ✅ Competitor saved: ${tool.name} (${domain})`)
//       }
//     }))

//     console.log(`💡 Discovered ${newTools.length} new competitors: ${newTools.map(t => t.name).join(", ")}`)
//   } catch (err) {
//     console.error("❌ Competitor discovery failed:", err.message)
//   }
// }

// // ─────────────────────────────────────────
// // CHECK MANUAL RUN LIMIT
// // free: 1/month | starter: 2/month | pro: 4/month
// // ─────────────────────────────────────────
// async function checkManualRunLimit(planId, tier) {
//   const { data: pricing } = await supabase
//     .from("pricing_plans")
//     .select("manual_runs_limit")
//     .eq("slug", tier)
//     .maybeSingle()

//   const limit = pricing?.manual_runs_limit ?? 1

//   const { data: runs } = await supabase
//     .from("plans")
//     .select("visibility_runs_this_month")
//     .eq("id", planId)
//     .single()

//   const used = runs?.visibility_runs_this_month ?? 0

//   return { allowed: used < limit, limit, used }
// }

// // ─────────────────────────────────────────
// // MAIN
// // ─────────────────────────────────────────
// export async function runVisibilityJob(planId, { skipLimitCheck = false } = {}) {
//   console.log("\n🔭 [VisibilityJob] Starting for plan:", planId)

//   // ── Load plan + tier ──
//   const { data: plan } = await supabase
//     .from("plans")
//     .select("tier, name")
//     .eq("id", planId)
//     .single()

//   const tier = plan?.tier || "free"

//   // ── Check manual run limit (skip for daily automated jobs) ──
//   if (!skipLimitCheck) {
//     const limitCheck = await checkManualRunLimit(planId, tier)
//     if (!limitCheck.allowed) {
//       console.log(`🚫 [VisibilityJob] Run limit reached for ${tier} plan (${limitCheck.used}/${limitCheck.limit} this month)`)
//       return {
//         blocked: true,
//         reason:  "manual_run_limit_reached",
//         used:    limitCheck.used,
//         limit:   limitCheck.limit,
//         message: `You've used ${limitCheck.used}/${limitCheck.limit} AI audits this month. Upgrade to run more.`,
//       }
//     }
//   }

//   // ── Resolve engines for this tier ──
//   const engineNames = TIER_ENGINES[tier] ?? TIER_ENGINES.free
//   const engineFns   = engineNames.map((name) => ENGINE_FN_MAP[name])

//   console.log(`📦 Tier: ${tier.toUpperCase()} | Engines: ${engineNames.join(", ")}`)

//   // ── Load prompts ──
//   const { data: prompts, error: promptErr } = await supabase
//     .from("aeo_prompts")
//     .select("id, prompt")
//     .eq("plan_id", planId)
//     .in("status", ["active", "manually_added"])
//     .order("created_at", { ascending: true })

//   if (promptErr || !prompts?.length) {
//     console.log("ℹ️  No active prompts — skipping")
//     return { blocked: false, tracked: 0, failed: 0 }
//   }

//   console.log(`📊 ${prompts.length} prompts × ${engineNames.length} engines = ${prompts.length * engineNames.length} answers`)

//   // ── Load brand + competitors ──
//   const [{ data: brand }, { data: competitors }] = await Promise.all([
//     supabase.from("aeo_brand_profile").select("brand_name, domain, aliases").eq("plan_id", planId).maybeSingle(),
//     supabase.from("aeo_competitors").select("name, domain, aliases").eq("plan_id", planId).eq("status", "active").eq("approved", true),
//   ])

//   const brandProfile = {
//     name:    brand?.brand_name || plan?.name || "",
//     domain:  brand?.domain     || "",
//     aliases: brand?.aliases    || [],
//   }

//   const competitorProfiles = (competitors || []).map((c) => ({
//     name: c.name || c.domain, domain: c.domain || "", aliases: c.aliases || [],
//   }))

//   console.log(`🧠 Brand: "${brandProfile.name}" | Competitors: ${competitorProfiles.length}`)

//   // ── Run prompts in batches ──
//   const allAnswers = []
//   let tracked = 0, failed = 0

//   for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
//     const batch   = prompts.slice(i, i + BATCH_SIZE)
//     const batchNo = Math.floor(i / BATCH_SIZE) + 1
//     const total   = Math.ceil(prompts.length / BATCH_SIZE)

//     console.log(`\n📦 Batch [${batchNo}/${total}] — ${batch.length} prompts in parallel`)

//     const results = await Promise.allSettled(
//       batch.map((p) => {
//         console.log(`   📍 "${p.prompt.slice(0, 55)}..."`)
//         return processPrompt(p, engineNames, engineFns, planId, brandProfile, competitorProfiles)
//       })
//     )

//     for (const result of results) {
//       if (result.status === "rejected") { failed++; continue }
//       const { anySuccess, answers } = result.value
//       if (anySuccess) { tracked++; allAnswers.push(...answers) }
//       else              failed++
//     }

//     if (i + BATCH_SIZE < prompts.length) await sleep(200)
//   }

//   // ── Increment run counter ──
//   const { data: currentRuns } = await supabase
//     .from("plans")
//     .select("visibility_runs_this_month")
//     .eq("id", planId)
//     .single()

//   await supabase
//     .from("plans")
//     .update({ visibility_runs_this_month: (currentRuns?.visibility_runs_this_month ?? 0) + 1 })
//     .eq("id", planId)

//   // ── Discover competitors (starter + pro only) ──
//   if (allAnswers.length > 0) {
//     console.log("\n🔍 Scanning answers for new competitors...")
//     await discoverNewCompetitors(planId, allAnswers, tier)
//   }

//   console.log(`\n✅ [VisibilityJob] Complete`)
//   console.log(`   Tier:    ${tier} (${engineNames.join(" + ")})`)
//   console.log(`   Tracked: ${tracked}/${prompts.length} prompts`)
//   console.log(`   Failed:  ${failed}`)

//   return { blocked: false, tracked, failed, tier, engines: engineNames }
// }

// export { runVisibilityJob as startVisibilityJob }





import { supabase }                        from "../config/supabase.js"
import { safeJsonParse }                   from "../utils/aiJson.js"
import { runGemini }                       from "../services/aeo/gemini.js"
import { askOpenAI, askOpenAIText }        from "../services/aeo/openai.js"
import { askPerplexity }                   from "../services/aeo/perplexity.js"
import {
  wrapWithCitationRequest,
  parseCitationsFromAnswer,
  isBrandInCitations,
} from "../utils/citationParser.js"

const sleep      = (ms) => new Promise((r) => setTimeout(r, ms))
const BATCH_SIZE = 10

// ─────────────────────────────────────────
// TIER → ENGINE MAP
// free    → gemini only
// starter → chatgpt + gemini
// pro     → chatgpt + gemini + perplexity
// ─────────────────────────────────────────
const TIER_ENGINES = {
  free:    ["gemini"],
  starter: ["chatgpt", "gemini"],
  pro:     ["chatgpt", "gemini", "perplexity"],
}

// ─────────────────────────────────────────
// ENGINE WRAPPERS
// All return { answer: string|null, citations: string[] }
// Pro tier passes withCitations=true to get sources
// ─────────────────────────────────────────
async function askChatGPTVisibility(prompt, withCitations = false) {
  try {
    const finalPrompt = withCitations ? wrapWithCitationRequest(prompt) : prompt
    const rawText     = await askOpenAIText(finalPrompt)
    if (!rawText) return { answer: null, citations: [] }
    if (withCitations) return parseCitationsFromAnswer(rawText)
    return { answer: rawText, citations: [] }
  } catch (err) {
    console.error("❌ ChatGPT error:", err.message)
    return { answer: null, citations: [] }
  }
}

async function askGeminiVisibility(prompt, withCitations = false) {
  try {
    const finalPrompt = withCitations ? wrapWithCitationRequest(prompt) : prompt
    const result = await runGemini(
      `Answer this question naturally, naming real tools, platforms, and brands:\n\n${finalPrompt}`,
      { temperature: 0.3, maxOutputTokens: 500 }
    )
    if (!result) return { answer: null, citations: [] }

    // Strip JSON wrapper if Gemini returns one
    let rawText = result
    try {
      const parsed = JSON.parse(result)
      rawText = parsed?.answer || parsed?.summary || parsed?.text || result
    } catch {}

    if (withCitations) return parseCitationsFromAnswer(rawText)
    return { answer: rawText, citations: [] }
  } catch (err) {
    console.error("❌ Gemini error:", err.message)
    return { answer: null, citations: [] }
  }
}

async function askPerplexityVisibility(prompt, withCitations = false) {
  return askPerplexity(prompt, { withCitations })
}

// ─────────────────────────────────────────
// ENGINE NAME → FUNCTION MAP
// ─────────────────────────────────────────
const ENGINE_FN_MAP = {
  chatgpt:    (prompt, withCitations) => askChatGPTVisibility(prompt, withCitations),
  gemini:     (prompt, withCitations) => askGeminiVisibility(prompt, withCitations),
  perplexity: (prompt, withCitations) => askPerplexityVisibility(prompt, withCitations),
}

// ─────────────────────────────────────────
// DETECTION
// ─────────────────────────────────────────
function normalize(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

function firstIndex(normalizedText, aliases) {
  let earliest = Infinity
  for (const alias of aliases) {
    if (alias.length < 3) continue
    const idx = normalizedText.indexOf(alias)
    if (idx !== -1 && idx < earliest) earliest = idx
  }
  return earliest
}

function detectMentions(answerText, brandProfile, competitorProfiles) {
  const normalized = normalize(answerText)

  const brandAliases = [
    brandProfile.name,
    brandProfile.domain?.replace(/\.(com|ai|co|io|org|net)$/i, ""),
    ...(brandProfile.aliases || []),
  ].filter(Boolean).map(normalize)

  const competitorEntries = competitorProfiles.map((c) => ({
    entity_name: c.name || c.domain,
    entity_type: "competitor",
    aliases: [
      c.name,
      c.domain?.replace(/\.(com|ai|co|io|org|net)$/i, ""),
      ...(c.aliases || []),
    ].filter(Boolean).map(normalize),
  }))

  const allEntities = [
    { entity_name: brandProfile.name || "brand", entity_type: "brand", aliases: brandAliases },
    ...competitorEntries,
  ].map((e) => ({
    ...e,
    firstIdx:  firstIndex(normalized, e.aliases),
    mentioned: firstIndex(normalized, e.aliases) !== Infinity,
  }))

  const mentionedEntities = allEntities.filter((e) => e.mentioned).sort((a, b) => a.firstIdx - b.firstIdx)
  const positionMap = {}
  mentionedEntities.forEach((e, idx) => { positionMap[e.entity_name] = idx + 1 })

  return allEntities.map((e) => ({
    entity_name: e.entity_name,
    entity_type: e.entity_type,
    mentioned:   e.mentioned,
    position:    e.mentioned ? (positionMap[e.entity_name] ?? null) : null,
  }))
}

// ─────────────────────────────────────────
// SAVE ONE ENGINE RESULT
// Saves answer + mentions + citations (Pro)
// ─────────────────────────────────────────
async function saveEngineResult(planId, promptId, promptText, engine, answerText, citations = [], brandProfile, competitorProfiles, isPro) {
  if (!answerText) return null

  const { data: answerRow, error: insertErr } = await supabase
    .from("aeo_ai_answers")
    .insert({ plan_id: planId, prompt_id: promptId, engine, answer_text: answerText, created_at: new Date().toISOString() })
    .select("id")
    .single()

  if (insertErr || !answerRow) {
    console.error(`   ❌ [${engine}] Save failed:`, insertErr?.message)
    return null
  }

  const mentions         = detectMentions(answerText, brandProfile, competitorProfiles)
  const brandResult      = mentions.find((m) => m.entity_type === "brand")
  const brandMentioned   = brandResult?.mentioned || false
  const brandPosition    = brandResult?.position  ?? null
  const competitorsFound = mentions.filter((m) => m.entity_type === "competitor" && m.mentioned).map((m) => m.entity_name)

  console.log(`   ✅ [${engine}] Brand: ${brandMentioned ? `✓ pos=${brandPosition}` : "✗"} | Competitors: ${competitorsFound.join(", ") || "none"}${citations.length ? ` | Citations: ${citations.length}` : ""}`)

  if (mentions.length > 0) {
    await supabase.from("aeo_mention_results").insert(
      mentions.map((m) => ({
        plan_id:     planId,
        answer_id:   answerRow.id,
        entity_name: m.entity_name,
        entity_type: m.entity_type,
        mentioned:   m.mentioned,
        position:    m.position,
        engine,
      }))
    )
  }

  // ── Save citations for Pro users (all 3 engines) ──
  if (isPro && citations.length > 0) {
    const brandIsSource = isBrandInCitations(citations, brandProfile.domain)

    await supabase.from("aeo_citations").insert({
      plan_id:         planId,
      prompt_id:       promptId,
      prompt_text:     promptText,
      engine,
      answer_text:     answerText,
      source_urls:     citations,
      brand_is_source: brandIsSource,
      brand_position:  brandPosition,
    })

    console.log(`   📎 [${engine}] Citations: ${citations.length} | Brand is source: ${brandIsSource}`)
  }

  return { answerId: answerRow.id, brandMentioned, brandPosition, competitorsFound, citations }
}

// ─────────────────────────────────────────
// PROCESS ONE PROMPT
// ─────────────────────────────────────────
async function processPrompt(p, engineNames, engineFns, planId, brandProfile, competitorProfiles, isPro) {
  // Pro users get citation-enriched prompts for all engines
  const results  = await Promise.allSettled(engineFns.map((fn) => fn(p.prompt, isPro)))
  const answers  = []
  let anySuccess = false

  for (let e = 0; e < results.length; e++) {
    const result     = results[e].status === "fulfilled" ? results[e].value : null
    const engineName = engineNames[e]
    const answer     = result?.answer ?? null
    const citations  = result?.citations ?? []

    if (!answer) { console.log(`   ⚠️  [${engineName}] No answer`); continue }

    await saveEngineResult(planId, p.id, p.prompt, engineName, answer, citations, brandProfile, competitorProfiles, isPro)
    answers.push(answer)
    anySuccess = true
  }

  return { anySuccess, answers }
}

// ─────────────────────────────────────────
// DISCOVER NEW COMPETITORS
// ─────────────────────────────────────────
async function discoverNewCompetitors(planId, allAnswers, tier) {
  if (!allAnswers.length) return
  if (tier === "free") {
    console.log("ℹ️  [discoverCompetitors] Skipped for free tier")
    return
  }

  try {
    const combinedText = allAnswers.join(" ").slice(0, 3000)
    const raw = await askOpenAI(
      `Extract every tool/platform/service from this text.\n\n${combinedText}\n\nReturn ONLY this JSON shape:\n{ "tools": [{ "name": "Acuity Scheduling", "domain": "acuityscheduling.com" }] }`,
      { max_tokens: 400 }
    )

    const parsed = safeJsonParse(raw || "{}")
    const tools  = Array.isArray(parsed?.tools) ? parsed.tools : []
    if (!tools.length) return

    const [{ data: known }, { data: brand }] = await Promise.all([
      supabase.from("aeo_competitors").select("name, domain").eq("plan_id", planId),
      supabase.from("aeo_brand_profile").select("brand_name, domain").eq("plan_id", planId).maybeSingle(),
    ])

    const knownValues = [
      brand?.brand_name, brand?.domain,
      ...(known || []).flatMap((c) => [c.name, c.domain]),
    ].filter(Boolean).map((n) => n.toLowerCase())

    const newTools = tools
      .filter((t) => t?.name && t.name.length > 2 && !knownValues.includes(t.name.toLowerCase()))
      .slice(0, 10)

    if (!newTools.length) return

    await Promise.allSettled(newTools.map(async (tool) => {
      let domain = (tool.domain || "")
        .toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim()

      if (!domain || !domain.includes(".")) {
        domain = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".com"
      }

      const { data: existing } = await supabase
        .from("aeo_competitors")
        .select("id, times_seen, status")
        .eq("plan_id", planId).eq("domain", domain).maybeSingle()

      if (existing?.status === "ignored") return

      const { error } = await supabase.from("aeo_competitors").upsert(
        {
          plan_id: planId, domain, name: tool.name,
          source: "ai", classification: "direct", confidence_score: 0.5,
          approved: false, status: "active",
          times_seen: (existing?.times_seen || 0) + 1,
          detected_reason: "Found in AI visibility answers",
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "plan_id,domain" }
      )

      if (error) console.error(`   ❌ Failed to upsert ${tool.name}:`, error.message)
      else        console.log(`   ✅ Competitor saved: ${tool.name} (${domain})`)
    }))

    console.log(`💡 Discovered ${newTools.length} new competitors`)
  } catch (err) {
    console.error("❌ Competitor discovery failed:", err.message)
  }
}

// ─────────────────────────────────────────
// CHECK MANUAL RUN LIMIT
// ─────────────────────────────────────────
async function checkManualRunLimit(planId, tier) {
  const { data: pricing } = await supabase
    .from("pricing_plans").select("manual_runs_limit").eq("slug", tier).maybeSingle()

  const limit = pricing?.manual_runs_limit ?? 1

  const { data: runs } = await supabase
    .from("plans").select("visibility_runs_this_month").eq("id", planId).single()

  const used = runs?.visibility_runs_this_month ?? 0
  return { allowed: used < limit, limit, used }
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────
export async function runVisibilityJob(planId, { skipLimitCheck = false } = {}) {
  console.log("\n🔭 [VisibilityJob] Starting for plan:", planId)

  const { data: plan } = await supabase
    .from("plans").select("tier, name").eq("id", planId).single()

  const tier  = plan?.tier || "free"
  const isPro = tier === "pro"

  if (!skipLimitCheck) {
    const limitCheck = await checkManualRunLimit(planId, tier)
    if (!limitCheck.allowed) {
      console.log(`🚫 [VisibilityJob] Run limit reached for ${tier} (${limitCheck.used}/${limitCheck.limit})`)
      return {
        blocked: true,
        reason:  "manual_run_limit_reached",
        used:    limitCheck.used,
        limit:   limitCheck.limit,
        message: `You've used ${limitCheck.used}/${limitCheck.limit} AI audits this month. Upgrade to run more.`,
      }
    }
  }

  const engineNames = TIER_ENGINES[tier] ?? TIER_ENGINES.free
  const engineFns   = engineNames.map((name) => ENGINE_FN_MAP[name])

  console.log(`📦 Tier: ${tier.toUpperCase()} | Engines: ${engineNames.join(", ")} | Citations: ${isPro ? "ON" : "OFF"}`)

  const { data: prompts, error: promptErr } = await supabase
    .from("aeo_prompts").select("id, prompt")
    .eq("plan_id", planId).in("status", ["active", "manually_added"])
    .order("created_at", { ascending: true })

  if (promptErr || !prompts?.length) {
    console.log("ℹ️  No active prompts — skipping")
    return { blocked: false, tracked: 0, failed: 0 }
  }

  console.log(`📊 ${prompts.length} prompts × ${engineNames.length} engines = ${prompts.length * engineNames.length} answers`)

  const [{ data: brand }, { data: competitors }] = await Promise.all([
    supabase.from("aeo_brand_profile").select("brand_name, domain, aliases").eq("plan_id", planId).maybeSingle(),
    supabase.from("aeo_competitors").select("name, domain, aliases").eq("plan_id", planId).eq("status", "active").eq("approved", true),
  ])

  const brandProfile = {
    name:    brand?.brand_name || plan?.name || "",
    domain:  brand?.domain     || "",
    aliases: brand?.aliases    || [],
  }

  const competitorProfiles = (competitors || []).map((c) => ({
    name: c.name || c.domain, domain: c.domain || "", aliases: c.aliases || [],
  }))

  console.log(`🧠 Brand: "${brandProfile.name}" | Competitors: ${competitorProfiles.length}`)

  const allAnswers = []
  let tracked = 0, failed = 0

  for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
    const batch   = prompts.slice(i, i + BATCH_SIZE)
    const batchNo = Math.floor(i / BATCH_SIZE) + 1
    const total   = Math.ceil(prompts.length / BATCH_SIZE)

    console.log(`\n📦 Batch [${batchNo}/${total}] — ${batch.length} prompts`)

    const results = await Promise.allSettled(
      batch.map((p) => {
        console.log(`   📍 "${p.prompt.slice(0, 55)}..."`)
        return processPrompt(p, engineNames, engineFns, planId, brandProfile, competitorProfiles, isPro)
      })
    )

    for (const result of results) {
      if (result.status === "rejected") { failed++; continue }
      const { anySuccess, answers } = result.value
      if (anySuccess) { tracked++; allAnswers.push(...answers) }
      else              failed++
    }

    if (i + BATCH_SIZE < prompts.length) await sleep(200)
  }

  // ── Increment run counter ──
  const { data: currentRuns } = await supabase
    .from("plans").select("visibility_runs_this_month").eq("id", planId).single()

  await supabase
    .from("plans")
    .update({ visibility_runs_this_month: (currentRuns?.visibility_runs_this_month ?? 0) + 1 })
    .eq("id", planId)

  if (allAnswers.length > 0) {
    console.log("\n🔍 Scanning answers for new competitors...")
    await discoverNewCompetitors(planId, allAnswers, tier)
  }

  console.log(`\n✅ [VisibilityJob] Complete`)
  console.log(`   Tier:    ${tier} (${engineNames.join(" + ")})`)
  console.log(`   Tracked: ${tracked}/${prompts.length} prompts`)
  console.log(`   Failed:  ${failed}`)

  return { blocked: false, tracked, failed, tier, engines: engineNames }
}

export { runVisibilityJob as startVisibilityJob }