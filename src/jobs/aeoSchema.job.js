


import { supabase }      from "../config/supabase.js";
import { runGemini }     from "../services/gemini.service.js";
import { safeJsonParse } from "../utils/aiJson.js";

const BATCH_SIZE = 6; // pages processed in parallel
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────
// PAGE TYPE DETECTION
// ─────────────────────────────────────────
function detectPageType(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path === "/" || path === "")                                                       return "homepage";
    if (path.match(/\/(pricing|plans|subscription)/))                                     return "pricing";
    if (path.match(/\/(about|company|team|story|mission)/))                               return "about";
    if (path.match(/\/(blog|post|article|news|insights|resources)\//))                    return "blog";
    if (path.match(/\/(product|features?|solutions?|platform|capabilities)/))             return "product";
    if (path.match(/\/(compare|vs|versus|alternative|alternatives|competitor)/))          return "comparison";
    if (path.match(/\/(customer|case-study|case_study|success|testimonial)/))             return "casestudy";
    if (path.match(/\/(faq|help|support|docs|documentation|knowledge)/))                  return "faq";
    if (path.match(/\/(contact|demo|trial|signup|register|get-started)/))                 return "cta";
    return "general";
  } catch { return "general"; }
}

// ─────────────────────────────────────────
// SCHEMA RULES BY PAGE TYPE
// ─────────────────────────────────────────
function getSchemaRules(pageType, brandName, competitors) {
  const compList = competitors.length > 0 ? `Key competitors: ${competitors.slice(0, 3).join(", ")}` : "";

  const rules = {
    homepage: `
REQUIRED SCHEMA TYPES: Organization, WebSite, SoftwareApplication, FAQPage

Organization: name, url, logo, description, sameAs (Twitter, LinkedIn, G2, Capterra)
  knowsAbout: list 5-8 expertise topics

WebSite: name, url, potentialAction: SearchAction

SoftwareApplication:
  applicationCategory: specific (e.g. "ProjectManagementApplication")
  applicationSubCategory: niche (e.g. "AI Workspace, Knowledge Management")
  featureList: 8-12 SPECIFIC features
  operatingSystem: "Web, iOS, Android, macOS, Windows"
  audience: BusinessAudience with specific audienceType
  offers: AggregateOffer with pricing hint

FAQPage — 5 questions users ACTUALLY ask:
  - "What is ${brandName} used for?"
  - "Is ${brandName} good for [audience type]?"
  - "How does ${brandName} compare to [top competitor]?" ${compList}
  - "What makes ${brandName} different from other tools?"
  - "Does ${brandName} work for [use case]?"
  Each answer: 2-3 sentences, specific, mention key features.`,

    pricing: `
REQUIRED SCHEMA TYPES: Product, AggregateOffer, FAQPage

Product: name, description, brand
AggregateOffer: priceCurrency USD, lowPrice, highPrice, offerCount

FAQPage — 4 pricing questions:
  - "How much does ${brandName} cost?"
  - "Does ${brandName} have a free plan?"
  - "What's included in ${brandName}'s plan?"
  - "Is ${brandName} worth the price compared to [competitor]?"`,

    product: `
REQUIRED SCHEMA TYPES: SoftwareApplication, ItemList

SoftwareApplication:
  featureList: 10-15 SPECIFIC features for THIS product page
  applicationSubCategory: specific to this product area
  audience: detailed audienceType for this feature set
  description: include keywords users search for these features

ItemList: each major feature as ListItem with name + specific description`,

    about: `
REQUIRED SCHEMA TYPES: Organization, AboutPage

Organization: name, url, logo, description, foundingDate, numberOfEmployees, areaServed
  founder: Person schema if inferable
  knowsAbout: expertise areas

AboutPage: name, description, url, about: Organization reference`,

    blog: `
REQUIRED SCHEMA TYPES: Article, BlogPosting, BreadcrumbList

Article: headline, description, articleSection, keywords (5-8), author, datePublished, publisher
BreadcrumbList: homepage → blog → article`,

    comparison: `
REQUIRED SCHEMA TYPES: Article, ItemList, FAQPage

Article: headline "[Brand] vs [Competitor]", description, keywords (both brand names + category)
ItemList: each tool compared as ListItem with brief description

FAQPage:
  - "Which is better, ${brandName} or [competitor]?"
  - "What's the difference between ${brandName} and [competitor]?"
  - "Should I switch from [competitor] to ${brandName}?"`,

    casestudy: `
REQUIRED SCHEMA TYPES: Review, AggregateRating, Organization

Review: reviewBody (case study result summary), reviewRating, author (customer org), itemReviewed (software)
AggregateRating: ratingValue 4.5, reviewCount placeholder
Organization: customer company name + description`,

    faq: `
REQUIRED SCHEMA TYPES: FAQPage, WebPage

FAQPage: ALL questions from the page as Question + acceptedAnswer
  Minimum 6 Q&A pairs. Answers: 2-4 sentences, specific.`,

    cta: `
REQUIRED SCHEMA TYPES: WebPage, SoftwareApplication

WebPage: name, description, url, potentialAction: RegisterAction or RequestAction
SoftwareApplication: name, description, featureList (5 items), offers`,

    general: `
REQUIRED SCHEMA TYPES: WebPage, SoftwareApplication (if software product)
Generate 2-3 most relevant schema types based on page content.
Always include WebPage. Include SoftwareApplication with featureList if software.`,
  };

  return rules[pageType] || rules.general;
}

// ─────────────────────────────────────────
// GEMINI WITH RETRY
// ─────────────────────────────────────────
async function runGeminiWithRetry(prompt, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await runGemini(prompt, options);
    } catch (err) {
      lastError = err;
      const is503       = err?.message?.includes("503") || err?.status === 503;
      const isOverloaded = err?.message?.toLowerCase().includes("overload");
      if ((is503 || isOverloaded) && attempt < maxRetries) {
        const waitMs = attempt * 4000;
        console.warn(`   ⚠️  Gemini overloaded — retry ${attempt}/${maxRetries} in ${waitMs / 1000}s`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────
// NORMALIZE AI RESPONSE TO ARRAY
// ─────────────────────────────────────────
function normalizeToArray(input) {
  if (Array.isArray(input))                                        return input;
  if (input?.schemas && Array.isArray(input.schemas))             return input.schemas;
  if (input && typeof input === "object" && input["@type"])        return [input];
  if (input && typeof input === "object")
    return Object.values(input).filter((v) => v && typeof v === "object" && v["@type"]);
  return [];
}

// ─────────────────────────────────────────
// PROCESS ONE PAGE — generate + save schemas
// ─────────────────────────────────────────
async function processPage(page, { planId, brandName, domain, brandDescription, brandAudience, competitors }) {
  const pageType    = detectPageType(page.url);
  const schemaRules = getSchemaRules(pageType, brandName, competitors);

  console.log(`\n🔄 [${pageType.toUpperCase()}] ${page.url}`);

  const prompt = `
You are a schema.org expert specializing in AEO (Answer Engine Optimization).
Generate rich, detailed JSON-LD schema markup to help AI assistants like ChatGPT,
Gemini, and Perplexity understand and recommend this page.

═══════════════════════════════════════
BRAND CONTEXT
═══════════════════════════════════════
Company: ${brandName}
Domain: ${domain}
What they do: ${brandDescription}
Target audience: ${brandAudience}
${competitors.length > 0 ? `Key competitors: ${competitors.join(", ")}` : ""}

═══════════════════════════════════════
PAGE DETAILS
═══════════════════════════════════════
URL: ${page.url}
Page type: ${pageType}
Content summary: ${page.ai_summary}
${page.content_text ? `Additional context: ${page.content_text.slice(0, 500)}` : ""}

═══════════════════════════════════════
SCHEMA REQUIREMENTS FOR THIS PAGE TYPE
═══════════════════════════════════════
${schemaRules}

═══════════════════════════════════════
STRICT RULES
═══════════════════════════════════════
- Return ONLY valid JSON — no markdown, no explanation, no code blocks
- Every schema object MUST have "@context": "https://schema.org" and "@type"
- featureList must be SPECIFIC (e.g. "AI writing assistant" not just "writing")
- FAQPage answers must be 2-4 sentences, specific, mention features
- Do NOT use placeholder text like "[brand]" — use "${brandName}" directly
- sameAs URLs: "https://twitter.com/${brandName.toLowerCase().replace(/\s+/g, "")}"

Return this exact structure:
{
  "schemas": [
    { "@context": "https://schema.org", "@type": "...", "name": "..." }
  ]
}`.trim();

  let raw;
  try {
    raw = await runGeminiWithRetry(prompt, { maxTokens: 8192 });
  } catch (err) {
    console.error(`   ❌ Gemini failed after retries: ${err.message}`);
    return { url: page.url, inserted: 0, failed: true };
  }

  const parsed     = safeJsonParse(raw);
  const schemaList = normalizeToArray(parsed);

  if (!schemaList.length) {
    console.warn(`   ⚠️  No schemas parsed — skipping`);
    return { url: page.url, inserted: 0, failed: false };
  }

  const validSchemas = schemaList.filter((s) => s && typeof s === "object" && s["@type"]);
  console.log(`   📊 Valid schemas: ${validSchemas.length}/${schemaList.length}`);
  validSchemas.forEach((s) => console.log(`      → ${s["@type"]}`));

  if (!validSchemas.length) return { url: page.url, inserted: 0, failed: false };

  // Delete old schemas for this page
  await supabase.from("aeo_schemas").delete().eq("page_id", page.id);

  // Insert all valid schemas for this page
  let pageInserted = 0;
  for (const schema of validSchemas) {
    if (!schema["@context"]) schema["@context"] = "https://schema.org";

    const { error: insertErr } = await supabase
      .from("aeo_schemas")
      .insert({ plan_id: planId, page_id: page.id, schema_type: schema["@type"], schema_json: schema });

    if (insertErr) {
      console.error(`   ❌ Insert failed (${schema["@type"]}): ${insertErr.message}`);
    } else {
      pageInserted++;
      console.log(`   💾 Saved: ${schema["@type"]}`);
    }
  }

  console.log(`   ✅ ${pageInserted} schemas saved for ${page.url}`);
  return { url: page.url, inserted: pageInserted, failed: false };
}

// ─────────────────────────────────────────
// MAIN — SCHEMA JOB
// ─────────────────────────────────────────
export async function runSchemaJob(planId) {
  if (!planId) { console.warn("⚠️  runSchemaJob called without planId"); return; }

  console.log("\n🧩 [SchemaJob] Starting for plan:", planId);

  // Load plan context in parallel
  const [
    { data: plan },
    { data: competitorRows },
    { data: brandProfile },
  ] = await Promise.all([
    supabase.from("plans").select("name, website_url").eq("id", planId).single(),
    supabase.from("aeo_competitors").select("name").eq("plan_id", planId).eq("approved", true).limit(5),
    supabase.from("aeo_brand_profiles").select("description, audience, category").eq("plan_id", planId).maybeSingle(),
  ]);

  const brandName        = plan?.name        || "Unknown Brand";
  const domain           = plan?.website_url || "";
  const competitors      = (competitorRows || []).map((c) => c.name).filter(Boolean);
  const brandDescription = brandProfile?.description || `${brandName} is a software product`;
  const brandAudience    = brandProfile?.audience    || "businesses and teams";

  console.log(`📋 Brand: "${brandName}" | Competitors: ${competitors.join(", ") || "none"}`);

  // Load pages
  const { data: pages, error: pagesErr } = await supabase
    .from("aeo_pages")
    .select("id, url, ai_summary, content_text")
    .eq("plan_id", planId)
    .not("ai_summary", "is", null);

  if (pagesErr) { console.error("❌ Failed to fetch pages:", pagesErr.message); return; }
  if (!pages?.length) { console.warn("⚠️  No pages with summaries — run crawl first"); return; }

  console.log(`📄 Processing ${pages.length} pages:`);
  pages.forEach((p) => console.log(`   → ${p.url} (${p.ai_summary?.length || 0} chars)`));

  const ctx = { planId, brandName, domain, brandDescription, brandAudience, competitors };

  let totalInserted = 0;
  let totalPages    = 0;

  // ✅ Process pages in parallel batches
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch   = pages.slice(i, i + BATCH_SIZE);
    const batchNo = Math.floor(i / BATCH_SIZE) + 1;
    const total   = Math.ceil(pages.length / BATCH_SIZE);

    console.log(`\n📦 Batch [${batchNo}/${total}] — ${batch.length} pages in parallel`);

    const results = await Promise.allSettled(
      batch.map((page) => processPage(page, ctx))
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error(`❌ Page batch error:`, result.reason?.message);
      } else {
        const { inserted, failed } = result.value;
        if (!failed) { totalInserted += inserted; totalPages++; }
      }
    }

    // Brief pause between batches to respect Gemini rate limits
    if (i + BATCH_SIZE < pages.length) await sleep(300);
  }

  console.log(`\n✅ [SchemaJob] Complete`);
  console.log(`   Pages processed: ${totalPages}/${pages.length}`);
  console.log(`   Total schemas:   ${totalInserted}`);

  return { pagesProcessed: totalPages, schemasInserted: totalInserted };
}