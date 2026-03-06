





import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../../config/supabase.js";
import axios from "axios";
import * as cheerio from "cheerio";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==================== CONFIGURATION ====================

const BLOCKED_DOMAINS = [
  // Social media
  "youtube.com", "reddit.com", "quora.com", "linkedin.com", 
  "facebook.com", "twitter.com", "x.com", "instagram.com",
  "tiktok.com", "pinterest.com", "snapchat.com",
  
  // Content platforms
  "medium.com", "blogspot.com", "wordpress.com", "substack.com",
  "ghost.io", "notion.site", "wix.com", "squarespace.com",
  
  // Directories & marketplaces
  "g2.com", "capterra.com", "producthunt.com", "crunchbase.com",
  "trustpilot.com", "yelp.com", "alternativeto.net", "getapp.com",
  "softwareadvice.com",
  
  // Publishers & News
  "wikipedia.org", "forbes.com", "techcrunch.com", "venturebeat.com",
  "theverge.com", "mashable.com", "wired.com", "cnet.com",
  
  // Educational & Government
  ".edu", ".gov", ".ac.uk",
  
  // Developer Tools & Communities
  "github.com", "gitlab.com", "stackoverflow.com", "stackexchange.com",
  "discord.com", "slack.com",
  
  // Generic services
  "amazon.com", "ebay.com", "etsy.com", "shopify.com"
];

const COMPETITOR_PROMPT = `You are a Principal SaaS Engineer and Competitive Intelligence Expert.

Your task is to determine whether a given domain represents a REAL, DIRECT COMPETITOR
to our product.

You must think like a senior product architect, not a marketer.

━━━━━━━━━━━━━━━━━━━━━━
BUSINESS A (Our Product)
━━━━━━━━━━━━━━━━━━━━━━
{{BRAND_DESCRIPTION}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS B (Candidate Domain)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{COMPETITOR_TEXT}}

━━━━━━━━━━━━━━━━━━━━━━
STRICT DEFINITION OF COMPETITOR
━━━━━━━━━━━━━━━━━━━━━━

A domain is a REAL competitor ONLY IF:

1. It represents a COMMERCIAL PRODUCT or SaaS
2. It solves the SAME CORE PROBLEM as Business A
3. It targets the SAME BUYER INTENT (not education, news, or content)
4. It is a BRAND, not a platform, marketplace, directory, or publisher
5. Users could realistically choose ONE over the OTHER

━━━━━━━━━━━━━━━━━━━━━━
AUTOMATIC DISQUALIFIERS
━━━━━━━━━━━━━━━━━━━━━━

Immediately mark competitor = false if Business B is ANY of the following:

- Blog, article site, media publisher
- SEO agency, marketing agency, or service provider
- AI tool with generic or unrelated use cases
- Marketplace, directory, comparison site
- Social network or community platform
- Educational, government, or research site
- Content explaining the problem instead of selling a solution
- Broad "all-in-one" tools with no overlap in core function

━━━━━━━━━━━━━━━━━━━━━━
EVALUATION RULES
━━━━━━━━━━━━━━━━━━━━━━

- Judge ONLY by product function and buyer intent
- Ignore traffic, popularity, funding, or brand size
- If similarity is partial, vague, or indirect → competitor = false
- If uncertain → competitor = false
- Be conservative. False negatives are acceptable. False positives are NOT.

━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT)
━━━━━━━━━━━━━━━━━━━━━━

Respond ONLY with valid JSON.
No explanations. No markdown. No extra text.

{
  "competitor": true | false,
  "confidence": number (0–100),
  "reason": "short technical justification"
}

━━━━━━━━━━━━━━━━━━━━━━
CONFIDENCE SCORING GUIDE
━━━━━━━━━━━━━━━━━━━━━━

90–100 → Nearly identical product purpose
70–89  → Strong overlap, same buyer decision
50–69  → Partial overlap but still substitutable
<50    → NOT a competitor`;

// ==================== HELPER FUNCTIONS ====================

/**
 * Normalize domain to consistent format
 */
function normalizeDomain(domain) {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .toLowerCase()
    .trim();
}

/**
 * Check if domain is in blocklist
 */
function isBlockedDomain(domain) {
  return BLOCKED_DOMAINS.some(blocked => domain.includes(blocked));
}

/**
 * Fetch homepage content from domain
 */
async function getDomainText(domain) {
  try {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    
    const res = await axios.get(url, {
      timeout: 8000,
      maxRedirects: 3,
      validateStatus: (status) => status < 400,
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
    });

    const $ = cheerio.load(res.data);
    
    // Remove noise elements
    $('script, style, nav, footer, header, iframe, noscript').remove();
    $('[class*="cookie"], [class*="banner"], [class*="popup"]').remove();

    // Extract meaningful content
    const contentSelectors = [
      'main',
      '[role="main"]', 
      '.content',
      '#content',
      'article',
      '.main-content',
      '#main-content'
    ];

    let text = '';
    for (const selector of contentSelectors) {
      const content = $(selector).text();
      if (content && content.length > text.length) {
        text = content;
      }
    }

    // Fallback to body if no main content found
    if (!text || text.length < 300) {
      text = $('body').text();
    }

    return text
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

  } catch (error) {
    console.warn(`⚠️ Failed to fetch ${domain}:`, error.message);
    return "";
  }
}

/**
 * Get cached judgment from database
 */
async function getCachedJudgment(domain, planId) {
  const { data, error } = await supabase
    .from("aeo_competitor_judgments")
    .select("is_competitor, confidence, reason, judged_at")
    .eq("domain", domain)
    .eq("plan_id", planId)
    .maybeSingle();
    
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error("Error fetching cached judgment:", error);
  }
  
  return data;
}

/**
 * Save judgment to database
 */
async function saveJudgment(domain, planId, isCompetitor, confidence, reason) {
  const { error } = await supabase
    .from("aeo_competitor_judgments")
    .upsert({
      domain,
      plan_id: planId,
      is_competitor: isCompetitor,
      confidence: confidence || 0,
      reason: reason || "",
      judged_at: new Date().toISOString()
    }, {
      onConflict: 'domain,plan_id'
    });

  if (error) {
    console.error("Error saving judgment:", error);
  }
}

/**
 * Call Gemini AI to judge competitor
 */
async function judgeWithAI(brandDescription, competitorText) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      temperature: 0.1, // More deterministic
      maxOutputTokens: 300,
    }
  });

  const prompt = COMPETITOR_PROMPT
    .replace('{{BRAND_DESCRIPTION}}', brandDescription)
    .replace('{{COMPETITOR_TEXT}}', competitorText);

  const result = await model.generateContent(prompt);
  
  const raw = result.response
    .text()
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(raw);
}

// ==================== MAIN FUNCTION ====================

/**
 * Determine if a domain is a real competitor
 * @param {string} domain - Domain to check (e.g., "example.com")
 * @param {string} planId - UUID of the AEO plan
 * @returns {Promise<boolean>} - True if real competitor
 */
export async function isRealCompetitor(domain, planId) {
  try {
    // ========== VALIDATION ==========
    if (!domain || !planId) {
      console.warn("⚠️ Missing domain or planId");
      return false;
    }

    // ========== NORMALIZE DOMAIN ==========
    const normalizedDomain = normalizeDomain(domain);

    if (!normalizedDomain || normalizedDomain.length < 4) {
      console.warn(`⚠️ Invalid domain: ${domain}`);
      return false;
    }

    // ========== CHECK BLOCKLIST ==========
    if (isBlockedDomain(normalizedDomain)) {
      console.log(`🚫 Blocked domain: ${normalizedDomain}`);
      return false;
    }

    // ========== CHECK CACHE ==========
    const cached = await getCachedJudgment(normalizedDomain, planId);
    
    if (cached) {
      const age = Math.round((Date.now() - new Date(cached.judged_at)) / 1000 / 60 / 60 / 24);
      console.log(`💾 Cache hit (${age}d old): ${normalizedDomain} → ${cached.is_competitor} (${cached.confidence}%)`);
      return cached.is_competitor;
    }

    // ========== LOAD BRAND PROFILE ==========
    const { data: brand, error: brandError } = await supabase
      .from("aeo_brand_profile")
      .select("description")
      .eq("plan_id", planId)
      .maybeSingle();

    if (brandError || !brand?.description) {
      console.error(`❌ Brand profile not found for plan ${planId}`);
      return false;
    }

    // ========== FETCH COMPETITOR CONTENT ==========
    const competitorText = await getDomainText(normalizedDomain);
    
    if (!competitorText || competitorText.length < 200) {
      console.warn(`⚠️ Insufficient content from ${normalizedDomain} (${competitorText?.length || 0} chars)`);
      await saveJudgment(normalizedDomain, planId, false, 0, "Insufficient content");
      return false;
    }

    // ========== AI JUDGMENT ==========
    let parsed;
    try {
      parsed = await judgeWithAI(brand.description, competitorText);
    } catch (aiError) {
      console.error(`❌ AI judgment failed for ${normalizedDomain}:`, aiError.message);
      return false;
    }

    // ========== VALIDATE AI RESPONSE ==========
    if (typeof parsed.competitor !== 'boolean' || 
        typeof parsed.confidence !== 'number') {
      console.error("❌ Invalid AI response structure:", parsed);
      return false;
    }

    // ========== APPLY THRESHOLD ==========
    const MIN_CONFIDENCE = 60;
    const isCompetitor = parsed.competitor === true && parsed.confidence >= MIN_CONFIDENCE;
    
    // ========== CACHE RESULT ==========
    await saveJudgment(
      normalizedDomain, 
      planId, 
      isCompetitor, 
      parsed.confidence,
      parsed.reason || ""
    );

    // ========== LOG RESULT ==========
    const emoji = isCompetitor ? "✅" : "❌";
    console.log(`${emoji} ${normalizedDomain}: ${isCompetitor} (${parsed.confidence}%) - ${parsed.reason}`);
    
    return isCompetitor;

  } catch (err) {
    console.error(`❌ Competitor judge error for ${domain}:`, err.message);
    return false;
  }
}

/**
 * Batch check multiple domains (for efficiency)
 * @param {string[]} domains - Array of domains to check
 * @param {string} planId - UUID of the AEO plan
 * @returns {Promise<Object>} - Map of domain → isCompetitor
 */
export async function batchCheckCompetitors(domains, planId) {
  const results = {};
  
  for (const domain of domains) {
    results[domain] = await isRealCompetitor(domain, planId);
  }
  
  return results;
}