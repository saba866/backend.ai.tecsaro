



//these code is working with gemini api
import { supabase } from "../../config/supabase.js";
import { safeJsonParse } from "../../utils/aiJson.js";


import { runGemini, runGeminiJSON } from "../gemini.service.js";



// ─────────────────────────────────────────
// PROMPT CONFIG PER TIER
// generate   → how many AI creates for user to review
// select_max → how many user can activate (includes manual prompts)
// select_min → minimum required to start tracking
// ─────────────────────────────────────────
const PROMPT_CONFIG = {
  free: {generate: 20,  select_max: 10, select_min: 5},
  starter: { generate: 50,  select_max: 20, select_min: 5  },
  pro:     { generate: 100, select_max: 50, select_min: 10 },
  
};

// ─────────────────────────────────────────
// INDUSTRY DETECTION
// ─────────────────────────────────────────
async function detectIndustry(topics) {
  const prompt = `
Read this business description and classify it.

BUSINESS CONTENT:
${topics.slice(0, 1000)}

Return a JSON object with exactly these keys:
{
  "industry": "saas|ecommerce|local_business|professional_services|healthcare|education|finance|food|travel|fitness|real_estate|other",
  "category": "specific description e.g. project management software, italian restaurant, divorce lawyer",
  "business_model": "b2b|b2c|both",
  "product_type": "software|physical_product|service|content|marketplace",
  "target_audience": "who buys this e.g. startup founders, home cooks, small business owners"
}
`;

  try {
    const raw = await runGemini(prompt, { maxOutputTokens: 1000 });
    const parsed = safeJsonParse(raw);
    if (parsed?.industry) return parsed;
  } catch (err) {
    console.warn("⚠️  Industry detection failed:", err.message);
  }

  return {
    industry: "other",
    category: "unknown",
    business_model: "b2c",
    product_type: "service",
    target_audience: "general audience",
  };
}

// ─────────────────────────────────────────
// PROMPT QUALITY VALIDATOR
// Exported so controller can reuse for manual prompts
// ─────────────────────────────────────────
export function isValidPrompt(promptText, brandName = "") {
  if (!promptText || typeof promptText !== "string") return false;

  const text = promptText.toLowerCase().trim();
  const wordCount = text.split(/\s+/).length;

  if (wordCount < 5) {
    console.log(`   ❌ Too short (${wordCount} words): "${promptText}"`);
    return false;
  }
  if (wordCount > 25) {
    console.log(`   ❌ Too long (${wordCount} words): "${promptText}"`);
    return false;
  }

  if (brandName && text.includes(brandName.toLowerCase())) {
    console.log(`   ❌ Contains brand name: "${promptText}"`);
    return false;
  }

  if (text.match(/\.(com|ai|co|io|org|net)/)) {
    console.log(`   ❌ Contains domain: "${promptText}"`);
    return false;
  }

  const headingPhrases = [
    "key features", "understanding", "leveraging", "utilizing",
    "implementation of", "overview of", "introduction to",
    "the benefits of", "an analysis", "a comprehensive",
    "enterprise-grade", "multi-departmental", "organizational",
    "disparate tools", "holistic approach", "in conclusion",
    "it is important", "this document", "case study",
  ];
  if (headingPhrases.some((p) => text.includes(p))) {
    console.log(`   ❌ Heading phrase: "${promptText}"`);
    return false;
  }

  const intentSignals = [
    "what", "which", "how", "can", "is there", "are there",
    "should i", "do you", "does anyone", "why",
    "best", "top", "recommend", "suggest", "worth",
    "replace", "switch", "choose", "popular", "trusted",
    "vs", "versus", "compare", "difference", "better",
    "alternative", "alternatives", "similar", "instead of",
    "struggle", "too many", "waste", "inefficient",
    "overwhelmed", "expensive", "hard to",
    "looking for", "switching from", "evaluating",
    "thinking of", "deciding between",
    "my team", "we're", "i'm", "i need", "our team",
    "we use", "help me", "we need",
  ];

  if (!intentSignals.some((s) => text.includes(s))) {
    console.log(`   ❌ No intent signal: "${promptText}"`);
    return false;
  }

  return true;
}

// ─────────────────────────────────────────
// INDUSTRY PROMPT TEMPLATES
// ─────────────────────────────────────────
function getIndustryTemplate(industryData, generateCount, topics) {
  const { industry, category, target_audience } = industryData;

  const outputFormat = `
═══════════════════════════════════════════
BUSINESS CONTEXT
═══════════════════════════════════════════
Category: ${category}
Target audience: ${target_audience}

Study this content carefully and generate prompts
that buyers of this type of business would ask:

${topics.slice(0, 2000)}

═══════════════════════════════════════════
OUTPUT — STRICT RULES
═══════════════════════════════════════════
- Return a JSON object: { "prompts": [ ... ] }
- Generate exactly ${generateCount} prompts inside the array
- Every prompt must be unique
- No markdown, no explanation, no preamble

Example format:
{
  "prompts": [
    {
      "prompt": "What are the best all-in-one workspace tools for remote startup teams?",
      "intent": "best-of",
      "keywords": ["best", "workspace tools", "remote", "startups"]
    }
  ]
}

Intent values: best-of | comparison | alternative | problem | recommendation | research | local | review | switching | hiring | buying
`;

  const templates = {
    saas: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when researching software tools and platforms to buy for their business.

KEY RULE: Full conversational questions, NOT short Google keywords.
WRONG: "notion alternatives"
RIGHT: "What are the best Notion alternatives for a small startup that needs project management?"

QUESTION STARTERS:
"What are the best..." / "Which tool should I use for..." / "Can you recommend a platform for..."
"My team is struggling with..." / "We're switching from..." / "What's the difference between..."
"I'm looking for an alternative to..." / "What do startups use for..." / "Is there a tool that can..."

INTENT MIX for ${generateCount} prompts:
- 8+ best-of:        "What are the best [tool type] for [use case]?"
- 8+ comparison:     "What's the difference between [tool A] and [tool B] for [team]?"
- 7+ alternative:    "I'm looking for an alternative to [tool type] that [specific need]"
- 7+ problem:        "My team struggles with [pain] — what tools can help?"
- 5+ recommendation: "Can you recommend a [tool] for [audience]?"
- 5+ switching:      "We're moving away from [tool type] — what do you suggest?"

LENGTH: 8-20 words. DO NOT mention specific brand names.
${outputFormat}`,

    ecommerce: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when looking to buy products online.

KEY RULE: These are shoppers asking about quality, price, and reviews.
WRONG: "best running shoes"
RIGHT: "What are the best running shoes for flat feet under $150 for long distances?"

QUESTION STARTERS:
"Where can I buy..." / "What are the best..." / "Which brand makes the best..."
"What should I look for when buying..." / "Are there good alternatives to..."
"Is [product type] worth buying?" / "What's the difference between..."

INTENT MIX for ${generateCount} prompts:
- 8+ best-of:        "What are the best [product] for [specific need/person]?"
- 8+ buying:         "Where can I buy [product] with [specific feature]?"
- 7+ quality:        "Is [product type] worth buying or should I look at alternatives?"
- 7+ comparison:     "What's better for [use case] — [product A] or [product B]?"
- 5+ recommendation: "Can you recommend a good [product] for [specific person]?"
- 5+ alternative:    "What are more affordable alternatives to [product type]?"

LENGTH: 8-20 words. DO NOT mention specific brand names.
${outputFormat}`,

    local_business: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when looking for local businesses or services near them.

KEY RULE: Always include location or proximity context.
WRONG: "good restaurant"
RIGHT: "What are the best Italian restaurants near downtown for a business dinner?"

QUESTION STARTERS:
"What's the best [business] in [area] for..." / "Where can I find a good [business] near..."
"Can you recommend a [business] in [area] for..." / "What do people say about [business] in [city]?"

INTENT MIX for ${generateCount} prompts:
- 10+ local:         "Best [business type] in [city/area] for [occasion/need]?"
- 8+  recommendation:"Can you recommend a [business] near [area] for [purpose]?"
- 7+  review:        "What do people say about [business type] in [area]?"
- 7+  best-of:       "What are the top [business type] for [specific need]?"
- 8+  comparison:    "Which is better for [occasion] — [business type A] or [B]?"

LENGTH: 6-18 words. Use placeholders like "near me", "in my city".
${outputFormat}`,

    professional_services: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when looking to hire lawyers, agencies, consultants, or accountants.

KEY RULE: High-stakes hiring decisions with specific requirements.
WRONG: "find a good lawyer"
RIGHT: "How do I find a startup lawyer who specializes in equity agreements?"

QUESTION STARTERS:
"How do I find a good [professional] for..." / "What should I look for when hiring..."
"Can you recommend a [service] for..." / "How much does [service] cost for..."

INTENT MIX for ${generateCount} prompts:
- 8+ hiring:         "How do I find a reliable [professional] for [situation]?"
- 8+ recommendation: "Can you recommend a [service] that specializes in [niche]?"
- 7+ research:       "What should I know before hiring a [professional]?"
- 7+ comparison:     "What's the difference between [service A] and [service B]?"
- 5+ cost:           "How much does [service] typically cost for [situation]?"
- 5+ best-of:        "What are the best [service type] for [specific audience]?"

LENGTH: 8-22 words.
${outputFormat}`,

    healthcare: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when looking for healthcare providers or wellness services.

KEY RULE: Sensitive personal queries seeking trusted guidance.
WRONG: "back pain doctor"
RIGHT: "How do I find a physiotherapist who specializes in chronic lower back pain?"

QUESTION STARTERS:
"What's the best treatment for..." / "How do I find a [specialist] for..."
"Can you recommend a [provider] for..." / "What should I look for in a [provider]?"

INTENT MIX for ${generateCount} prompts:
- 8+ finding:        "How do I find a [provider] who specializes in [condition]?"
- 8+ recommendation: "Can you recommend a good [provider] for [condition]?"
- 7+ research:       "What should I know about [treatment] before trying it?"
- 7+ comparison:     "What's the difference between [treatment A] and [treatment B]?"
- 5+ cost:           "How much does [treatment] cost without insurance?"
- 5+ best-of:        "What are the best [treatment] options for [condition]?"

LENGTH: 8-20 words.
${outputFormat}`,

    education: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when looking for courses, certifications, or learning resources.

KEY RULE: Career and skill investment decisions — people want ROI clarity.
WRONG: "learn python course"
RIGHT: "What are the best online Python courses for beginners who want a data science job?"

QUESTION STARTERS:
"What are the best courses for learning..." / "Is [course type] worth it for..."
"Can you recommend a course for someone who wants to..." / "How do I learn [skill] from scratch?"

INTENT MIX for ${generateCount} prompts:
- 8+ best-of:        "What are the best [course type] for learning [skill]?"
- 8+ recommendation: "Can you recommend a [resource] for someone who wants [goal]?"
- 7+ comparison:     "Which is better for [goal] — [option A] or [option B]?"
- 7+ research:       "Is [course type] worth the investment for [career goal]?"
- 5+ alternative:    "What are free alternatives to [paid learning platform]?"
- 5+ outcome:        "Which [course type] leads to the best career outcomes?"

LENGTH: 8-20 words.
${outputFormat}`,

    finance: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when researching financial products or services.

KEY RULE: High-stakes money decisions — people want clarity and safety.
WRONG: "best investment account"
RIGHT: "What's the best investment account for a 30-year-old with $500/month to invest?"

QUESTION STARTERS:
"What's the best [financial product] for..." / "Is [product type] worth it for..."
"How does [product A] compare to [product B]?" / "What are the risks of [financial product]?"

INTENT MIX for ${generateCount} prompts:
- 8+ best-of:        "What's the best [financial product] for [situation]?"
- 8+ comparison:     "How does [product A] compare to [product B] for [goal]?"
- 7+ research:       "What should I know before [financial decision]?"
- 7+ recommendation: "Can you recommend a [service] for [financial situation]?"
- 5+ risk:           "What are the risks of [financial product] for [audience]?"
- 5+ cost:           "How much does [service] cost for [situation]?"

LENGTH: 8-20 words.
${outputFormat}`,

    food: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when looking for food products, recipes, or meal services.

KEY RULE: Personal taste and lifestyle decisions — very specific needs.
WRONG: "healthy snacks"
RIGHT: "What are the best high-protein snacks for losing weight without giving up taste?"

QUESTION STARTERS:
"What are the best [food type] for..." / "Can you recommend [food product] for..."
"Is [food type] actually healthy for..." / "What's a good substitute for [ingredient]?"

INTENT MIX for ${generateCount} prompts:
- 8+ best-of:        "What are the best [food type] for [dietary need/occasion]?"
- 8+ recommendation: "Can you recommend a [food product] for [specific need]?"
- 7+ health:         "Is [food type] actually good for [health goal]?"
- 7+ comparison:     "What's the difference between [food A] and [food B]?"
- 5+ substitute:     "What's a good substitute for [ingredient] in [use case]?"
- 5+ buying:         "Where can I buy [food product] online with [feature]?"

LENGTH: 7-18 words.
${outputFormat}`,

    travel: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when planning trips or researching destinations.

KEY RULE: Always specific about budget, duration, and experience type.
WRONG: "good hotels london"
RIGHT: "What are the best boutique hotels in central London for a couple on $200/night?"

QUESTION STARTERS:
"What are the best [travel option] for..." / "Where should I stay in [destination] for..."
"Can you recommend [travel service] for [trip type]?" / "What should I know before visiting..."

INTENT MIX for ${generateCount} prompts:
- 10+ best-of:       "What are the best [travel option] in [destination] for [traveler type]?"
- 8+  recommendation:"Can you recommend [travel service] for [trip type/budget]?"
- 7+  research:      "What should I know before visiting [destination] for [reason]?"
- 7+  comparison:    "What's better for [trip type] — [option A] or [option B]?"
- 8+  budget:        "How do I find affordable [travel option] for [trip type]?"

LENGTH: 8-20 words.
${outputFormat}`,

    fitness: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when looking for fitness services or workout programs.

KEY RULE: Goal-specific queries — people ask about results not just services.
WRONG: "good gym near me"
RIGHT: "What should I look for in a personal trainer to lose 20 pounds in 6 months?"

QUESTION STARTERS:
"What's the best workout program for..." / "Can you recommend a [fitness service] for..."
"Is [fitness program] effective for..." / "How long does it take to see results with..."

INTENT MIX for ${generateCount} prompts:
- 8+ best-of:        "What's the best [fitness program] for [specific goal]?"
- 8+ recommendation: "Can you recommend a [fitness service] for [person/goal]?"
- 7+ research:       "Is [fitness program] effective for [specific goal]?"
- 7+ comparison:     "What's the difference between [program A] and [program B]?"
- 5+ finding:        "How do I find a [fitness professional] who specializes in [need]?"
- 5+ cost:           "How much does [fitness service] cost for [commitment level]?"

LENGTH: 8-20 words.
${outputFormat}`,

    real_estate: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when looking for real estate agents or property.

KEY RULE: High-stakes with location and budget always in context.
WRONG: "find real estate agent"
RIGHT: "How do I find a reliable real estate agent who specializes in first-time buyers?"

QUESTION STARTERS:
"How do I find a [real estate professional] who specializes in..."
"What should I look for when hiring a real estate agent for..."
"What's the best neighborhood in [city] for..."

INTENT MIX for ${generateCount} prompts:
- 8+ hiring:         "How do I find a [real estate professional] for [situation]?"
- 8+ research:       "What should I know about [process] before [buying/selling]?"
- 7+ recommendation: "Can you recommend a [area/property type] for [buyer/budget]?"
- 7+ comparison:     "What's the difference between [option A] and [option B]?"
- 5+ cost:           "How much does [real estate service] cost in [area]?"
- 5+ best-of:        "What are the best [neighborhoods] for [buyer profile]?"

LENGTH: 8-22 words.
${outputFormat}`,

    other: `
You are simulating how real people search on ChatGPT, Gemini, Perplexity
when researching products or services to buy.

KEY RULE: Full conversational questions, NOT short Google keywords.
WRONG: "best service provider"
RIGHT: "What are the best [service type] options for someone with [specific need]?"

QUESTION STARTERS:
"What are the best..." / "Can you recommend..." / "Which is better for..."
"I'm looking for..." / "What do people use for..." / "What's the difference between..."
"My [team/family/company] needs..." / "We're currently using [X] — what are better alternatives?"

INTENT MIX for ${generateCount} prompts:
- 10+ best-of:       "What are the best [product/service] for [specific use case]?"
- 8+  recommendation:"Can you recommend a [product/service] for [audience/need]?"
- 8+  comparison:    "What's the difference between [option A] and [option B]?"
- 7+  problem:       "I'm struggling with [problem] — what solutions do people use?"
- 7+  research:      "What should I know before buying or hiring [product/service]?"

LENGTH: 8-20 words. DO NOT mention specific brand names.
${outputFormat}`,
  };

  return templates[industry] || templates.other;
}

// ─────────────────────────────────────────
// MAIN — START PROMPT DISCOVERY
// ─────────────────────────────────────────
export const startPromptDiscovery = async (planId) => {

  // ── STEP 1: CHECK IF PROMPTS ALREADY EXIST ──
  const { count: existingCount, error: countErr } = await supabase
    .from("aeo_prompts")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .in("status", ["active", "pending_review", "manually_added"]);

  if (countErr) {
    console.error("❌ Failed to check existing prompts:", countErr.message);
    return;
  }

  if (existingCount > 0) {
    console.log(`⏭️  Prompts already exist (${existingCount}) — skipping generation`);
    return;
  }

  console.log("📝 No existing prompts — starting generation...");

  // ── STEP 2: LOAD PLAN + TIER ──
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("name, website_url, tier")
    .eq("id", planId)
    .single();

  if (planErr || !plan) {
    console.warn("⚠️  Plan not found:", planErr?.message);
    return;
  }

  const brandName = plan.name?.toLowerCase() || "";
  const tier = plan.tier || "starter";
  const config = PROMPT_CONFIG[tier] || PROMPT_CONFIG.default;

  console.log(`\n📊 Plan:        ${plan.name}`);
  console.log(`   Tier:        ${tier}`);
  console.log(`   Generating:  ${config.generate} prompts for user to review`);
  console.log(`   User selects: ${config.select_min}–${config.select_max} to activate`);

  // // ── STEP 3: LOAD PAGE SUMMARIES ──
  // const { data: pages } = await supabase
  //   .from("aeo_pages")
  //   .select("ai_summary, content_text, url")
  //   .eq("plan_id", planId)
  //   .limit(20);

  // if (!pages?.length) {
  //   console.warn("⚠️  No pages found — aborting");
  //   return;
  // }

  // const topics = pages
  //   .map((p) => p.ai_summary || p.content_text?.slice(0, 300))
  //   .filter(Boolean)
  //   .join("\n");

  // console.log(`📄 Using ${pages.length} pages for context`);

  // // ── STEP 4: DETECT INDUSTRY ──
  // console.log("\n🏭 Detecting industry...");
  // const industryData = await detectIndustry(topics);
  // console.log(`   Industry:   ${industryData.industry}`);
  // console.log(`   Category:   ${industryData.category}`);
  // console.log(`   Audience:   ${industryData.target_audience}`);

  // ── STEP 3 + 4: LOAD PAGES & DETECT INDUSTRY IN PARALLEL ──
const [pagesResult] = await Promise.all([
  supabase
    .from("aeo_pages")
    .select("ai_summary, content_text, url")
    .eq("plan_id", planId)
    .limit(20),
]);

const pages = pagesResult.data;

if (!pages?.length) {
  console.warn("⚠️  No pages found — aborting");
  return;
}

const topics = pages
  .map((p) => p.ai_summary || p.content_text?.slice(0, 300))
  .filter(Boolean)
  .join("\n");

console.log(`📄 Using ${pages.length} pages for context`);

// Detect industry
console.log("\n🏭 Detecting industry...");
const industryData = await detectIndustry(topics);
console.log(`   Industry: ${industryData.industry} | Category: ${industryData.category}`);

  // ── STEP 5: GENERATE PROMPTS VIA OPENAI ──
  console.log(`\n🤖 Generating ${config.generate} prompts...`);
  const finalPrompt = getIndustryTemplate(industryData, config.generate, topics);

  let parsed = null;

  try {
    // Use the array wrapper approach since OpenAI json_object requires object root
    const result = await runGeminiJSON(finalPrompt, { maxOutputTokens: 9000 });
parsed = result?.prompts ?? result;
    
  } catch (err) {
    console.error("❌ OpenAI generation failed:", err.message);
    return;
  }

  // ── STEP 6: VALIDATE PARSE RESULT ──
  if (!Array.isArray(parsed) || !parsed.length) {
    console.error("❌ Could not parse prompts from OpenAI response — aborting");
    return;
  }

  console.log(`📊 Raw from AI: ${parsed.length}`);

  // ── STEP 7: VALIDATE PROMPT QUALITY ──
  console.log("\n🔍 Validating prompts:");
  const validPrompts = parsed.filter((p) => {
    if (!p?.prompt) return false;
    const valid = isValidPrompt(p.prompt, brandName);
    if (valid) console.log(`   ✅ "${p.prompt}"`);
    return valid;
  });

  console.log(`\n📊 Valid: ${validPrompts.length}/${parsed.length}`);

  if (!validPrompts.length) {
    console.warn("❌ No valid prompts — aborting");
    return;
  }

  // ── STEP 8: SAVE ALL AS pending_review ──
  // ── STEP 8: BATCH INSERT ALL AT ONCE ──
const toSave = validPrompts.slice(0, config.generate);

console.log(`\n💾 Batch inserting ${toSave.length} prompts...`);

const rows = toSave.map((p) => ({
  plan_id:  planId,
  prompt:   p.prompt.trim(),
  intent:   p.intent   || "informational",
  source:   "market_ai",
  status:   "pending_review",
  keywords: p.keywords || [],
  industry: industryData.industry,
  category: industryData.category,
}));

const { error: batchErr } = await supabase
  .from("aeo_prompts")
  .insert(rows);   // ← single DB call instead of 50 individual calls

if (batchErr) {
  console.error("❌ Batch insert failed:", batchErr.message);
  return;
}

const savedCount = rows.length;
console.log(`✅ Inserted ${savedCount} prompts in one shot`);

  // ── STEP 9: UPDATE PLAN STATUS ──
  await supabase
    .from("plans")
    .update({
      prompts_ready_for_review:  true,
      prompts_approved:          false,
      prompt_select_max:         config.select_max,
      prompt_select_min:         config.select_min,
      prompts_generate_count:    savedCount,
      pipeline_status:           "awaiting_prompt_review",
    })
    .eq("id", planId);

  console.log(`\n✅ Generation complete`);
  console.log(`   Saved:      ${savedCount} prompts (pending_review)`);
  console.log(`   User picks: ${config.select_min}–${config.select_max} to activate`);
  console.log(`   Pipeline:   PAUSED → waiting for user approval`);
};

// ─────────────────────────────────────────
// APPROVE PROMPTS
// ─────────────────────────────────────────
export const approvePrompts = async (planId, selectedIds) => {
  console.log(`\n✅ Approving prompts for plan: ${planId}`);

  const { data: plan } = await supabase
    .from("plans")
    .select("prompt_select_max, prompt_select_min, tier")
    .eq("id", planId)
    .single();

  if (!plan) return { error: "Plan not found" };

  const max = plan.prompt_select_max || 20;
  const min = plan.prompt_select_min || 5;

  const { count: manualCount } = await supabase
    .from("aeo_prompts")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .eq("status", "manually_added");

  const availableSlots = max - (manualCount || 0);

  if (selectedIds.length < min) {
    return { error: `Please select at least ${min} prompts to start tracking` };
  }
  if (selectedIds.length > availableSlots) {
    return {
      error: manualCount > 0
        ? `You have ${manualCount} manual prompt(s) already. You can activate up to ${availableSlots} more (total cap: ${max}).`
        : `You can only activate up to ${max} prompts on your ${plan.tier} plan`,
    };
  }

  const { error: activateErr } = await supabase
    .from("aeo_prompts")
    .update({ status: "active" })
    .in("id", selectedIds)
    .eq("plan_id", planId);

  if (activateErr) {
    console.error("❌ Failed to activate prompts:", activateErr.message);
    return { error: "Failed to activate prompts" };
  }

  await supabase
    .from("aeo_prompts")
    .update({ status: "dismissed" })
    .eq("plan_id", planId)
    .eq("status", "pending_review")
    .not("id", "in", `(${selectedIds.map((id) => `'${id}'`).join(",")})`);

  await supabase
    .from("plans")
    .update({
      prompts_approved:     true,
      prompts_approved_at:  new Date().toISOString(),
      pipeline_status:      "running",
    })
    .eq("id", planId);

  console.log(`   Activated: ${selectedIds.length}`);
  console.log(`   Pipeline:  resuming...`);

  return {
    success: true,
    activated: selectedIds.length,
    remaining_slots: availableSlots - selectedIds.length,
    message: `${selectedIds.length} prompts activated. Tracking will start shortly.`,
  };
};

// ─────────────────────────────────────────
// ADD MANUAL PROMPT
// ─────────────────────────────────────────
export const addManualPrompt = async (planId, promptText, intent = "informational") => {
  const { data: plan } = await supabase
    .from("plans")
    .select("prompt_select_max, tier, name")
    .eq("id", planId)
    .single();

  if (!plan) return { error: "Plan not found" };

  const brandName = plan.name?.toLowerCase() || "";
  const max = plan.prompt_select_max || 20;

  if (!isValidPrompt(promptText, brandName)) {
    return {
      error: "This doesn't look like a real search query. Try something like: 'What are the best tools for team collaboration?'",
    };
  }

  const { count: activeCount } = await supabase
    .from("aeo_prompts")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .in("status", ["active", "manually_added"]);

  if ((activeCount || 0) >= max) {
    return {
      error: `You've reached your limit of ${max} active prompts. Remove one to add a new prompt.`,
      limit_reached: true,
    };
  }

  const { data: existing } = await supabase
    .from("aeo_prompts")
    .select("id")
    .eq("plan_id", planId)
    .eq("prompt", promptText.trim())
    .in("status", ["active", "manually_added", "pending_review"])
    .maybeSingle();

  if (existing) return { error: "This prompt already exists in your list" };

  const { data: inserted, error: insertErr } = await supabase
    .from("aeo_prompts")
    .insert({
      plan_id:  planId,
      prompt:   promptText.trim(),
      intent,
      source:   "manual",
      status:   "manually_added",
      keywords: [],
    })
    .select()
    .single();

  if (insertErr) {
    console.error("❌ Failed to save manual prompt:", insertErr.message);
    return { error: "Failed to save prompt" };
  }

  const remaining = max - (activeCount || 0) - 1;

  return {
    success: true,
    prompt: inserted,
    remaining_slots: remaining,
    message: `Prompt added. ${remaining} slot${remaining !== 1 ? "s" : ""} remaining.`,
  };
};

// ─────────────────────────────────────────
// REMOVE PROMPT
// ─────────────────────────────────────────
export const removePrompt = async (planId, promptId) => {
  const { error } = await supabase
    .from("aeo_prompts")
    .update({ status: "dismissed" })
    .eq("id", promptId)
    .eq("plan_id", planId)
    .in("status", ["active", "manually_added"]);

  if (error) return { error: "Failed to remove prompt" };

  const { count: activeCount } = await supabase
    .from("aeo_prompts")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .in("status", ["active", "manually_added"]);

  const { data: plan } = await supabase
    .from("plans")
    .select("prompt_select_max")
    .eq("id", planId)
    .single();

  const max = plan?.prompt_select_max || 20;

  return {
    success: true,
    active_count: activeCount || 0,
    remaining_slots: max - (activeCount || 0),
  };
};

// ─────────────────────────────────────────
// GET PROMPTS FOR REVIEW UI
// ─────────────────────────────────────────
export const getPromptsForReview = async (planId) => {
  const { data: plan } = await supabase
    .from("plans")
    .select("prompt_select_max, prompt_select_min, prompts_generate_count, tier")
    .eq("id", planId)
    .single();

  const { data: prompts } = await supabase
    .from("aeo_prompts")
    .select("id, prompt, intent, keywords, status, created_at")
    .eq("plan_id", planId)
    .eq("status", "pending_review")
    .order("intent", { ascending: true });

  const { count: manualCount } = await supabase
    .from("aeo_prompts")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .eq("status", "manually_added");

  const selectMax = plan?.prompt_select_max || 20;
  const selectMin = plan?.prompt_select_min || 5;
  const manualUsed = manualCount || 0;
  const availableSlots = Math.max(0, selectMax - manualUsed);

  const grouped = {};
  for (const p of prompts || []) {
    const intent = p.intent || "informational";
    if (!grouped[intent]) grouped[intent] = [];
    grouped[intent].push(p);
  }

  return {
    prompts: prompts || [],
    grouped,
    total: prompts?.length || 0,
    select_max: selectMax,
    select_min: selectMin,
    available_slots: availableSlots,
    manual_used: manualUsed,
    tier: plan?.tier || "starter",
  };
};

// ─────────────────────────────────────────
// GET ACTIVE PROMPTS
// ─────────────────────────────────────────
export const getActivePrompts = async (planId) => {
  const { data: prompts, error } = await supabase
    .from("aeo_prompts")
    .select("id, prompt, intent, keywords")
    .eq("plan_id", planId)
    .in("status", ["active", "manually_added"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Failed to load active prompts:", error.message);
    return [];
  }

  return prompts || [];
};

// ─────────────────────────────────────────
// GET PROMPT SLOT SUMMARY
// ─────────────────────────────────────────
export const getPromptSlotSummary = async (planId) => {
  const { data: plan } = await supabase
    .from("plans")
    .select("prompt_select_max, prompt_select_min, tier, prompts_approved")
    .eq("id", planId)
    .single();

  if (!plan) return null;

  const { count: activeCount } = await supabase
    .from("aeo_prompts")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .in("status", ["active", "manually_added"]);

  const { count: manualCount } = await supabase
    .from("aeo_prompts")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .eq("status", "manually_added");

  const max = plan.prompt_select_max || 20;
  const used = activeCount || 0;

  return {
    tier:         plan.tier,
    max,
    used,
    manual_used:  manualCount || 0,
    ai_used:      used - (manualCount || 0),
    remaining:    max - used,
    approved:     plan.prompts_approved || false,
  };
};

// ─────────────────────────────────────────
// SUGGEST NEW PROMPTS (weekly refresh only)
// ─────────────────────────────────────────
export const suggestNewPrompts = async (planId) => {
  console.log("💡 Generating prompt suggestions for plan:", planId);

  const { data: existingPrompts } = await supabase
    .from("aeo_prompts")
    .select("prompt")
    .eq("plan_id", planId)
    .in("status", ["active", "manually_added", "suggested"]);

  const existingTexts = existingPrompts?.map((p) => p.prompt.toLowerCase()) || [];

  const { data: gaps } = await supabase
    .from("aeo_gaps")
    .select("prompt, gap_reasons")
    .eq("plan_id", planId)
    .limit(10);

  if (!gaps?.length) {
    console.log("⏭️  No gaps found — skipping suggestions");
    return;
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("name")
    .eq("id", planId)
    .single();

  const brandName = plan?.name?.toLowerCase() || "";
  const gapSummary = gaps.map((g) => `"${g.prompt}"`).join("\n");

  const suggestionPrompt = `
A brand is missing from AI answers for these queries.
Suggest 6 NEW related search queries they should also track.

QUERIES WHERE BRAND IS MISSING:
${gapSummary}

RULES:
- Suggest adjacent queries not already tracked
- 8-20 words — conversational AI query style
- Sound like real users typing into ChatGPT
- Do NOT repeat gap queries exactly
- Do NOT mention specific brand names

Return a JSON object with key "prompts" containing an array:
{
  "prompts": [
    {
      "prompt": "...",
      "intent": "best-of|comparison|alternative|problem|recommendation",
      "reason": "why worth tracking"
    }
  ]
}
`;

  

try {
  const wrapper = await runGeminiJSON(suggestionPrompt, { maxOutputTokens: 1000 });
  const parsed = Array.isArray(wrapper?.prompts) ? wrapper.prompts : null;
  if (!parsed) return;

  let count = 0;
  for (const p of parsed) {
    if (!p?.prompt) continue;
    if (!isValidPrompt(p.prompt, brandName)) continue;
    if (existingTexts.includes(p.prompt.toLowerCase())) continue;

    const { error } = await supabase.from("aeo_prompts").insert({
      plan_id:           planId,
      prompt:            p.prompt.trim(),
      intent:            p.intent || "informational",
      source:            "gap_suggestion",
      status:            "suggested",
      suggestion_reason: p.reason || "Found during gap analysis",
      keywords:          [],
    });

    if (!error) {
      count++;
      console.log(`   💡 Suggested: "${p.prompt}"`);
    }
  }

  console.log(`✅ ${count} suggestions added (pending user approval)`);
} catch (err) {
  console.error("❌ Suggestion failed:", err.message);
}
};
// ─────────────────────────────────────────
// APPROVE SUGGESTED PROMPT
// ─────────────────────────────────────────
export const approveSuggestedPrompt = async (planId, promptId) => {
  const { data: plan } = await supabase
    .from("plans")
    .select("prompt_select_max, tier")
    .eq("id", planId)
    .single();

  if (!plan) return { error: "Plan not found" };

  const max = plan.prompt_select_max || 20;

  const { count: activeCount } = await supabase
    .from("aeo_prompts")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)
    .in("status", ["active", "manually_added"]);

  if ((activeCount || 0) >= max) {
    return {
      error: `You've reached your limit of ${max} active prompts. Remove one to add this suggestion.`,
      limit_reached: true,
    };
  }

  const { error } = await supabase
    .from("aeo_prompts")
    .update({ status: "active" })
    .eq("id", promptId)
    .eq("plan_id", planId)
    .eq("status", "suggested");

  if (error) return { error: "Failed to approve suggestion" };

  return {
    success: true,
    remaining_slots: max - (activeCount || 0) - 1,
  };
};

// ─────────────────────────────────────────
// DISMISS SUGGESTED PROMPT
// ─────────────────────────────────────────
export const dismissSuggestedPrompt = async (planId, promptId) => {
  const { error } = await supabase
    .from("aeo_prompts")
    .update({ status: "dismissed" })
    .eq("id", promptId)
    .eq("plan_id", planId)
    .eq("status", "suggested");

  if (error) return { error: "Failed to dismiss suggestion" };
  return { success: true };
};