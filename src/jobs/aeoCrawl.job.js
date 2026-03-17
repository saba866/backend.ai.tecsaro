


import axios        from "axios";
import * as cheerio  from "cheerio";
import puppeteer from "puppeteer"
import { supabase }  from "../config/supabase.js";
import { cleanContent } from "../utils/aeoCleaner.js";
import { runPipelinePhase1 } from "./aeoPipeline.job.js";

const BATCH_SIZE      = 2;
const REQUEST_TIMEOUT = 10000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────
// GET PAGES LIMIT — live from pricing_plans
// billing_profiles.current_plan_slug → pricing_plans.pages_limit
// ─────────────────────────────────────────
async function getPagesLimit(planId) {
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("tier, user_id, website_url, name")
    .eq("id", planId)
    .single();

  if (planErr || !plan) throw new Error("Plan not found: " + planId);

  // billing_profiles is source of truth for current plan
  const { data: billing } = await supabase
    .from("billing_profiles")
    .select("current_plan_slug, subscription_status")
    .eq("user_id", plan.user_id)
    .maybeSingle();

  const isActive = !billing?.subscription_status ||
    ["active", "trial", "created"].includes(billing.subscription_status);

  const effectiveSlug = (isActive && billing?.current_plan_slug)
    ? billing.current_plan_slug
    : (plan.tier ?? "free");

  // Pull pages_limit live — no hardcoded map
  const { data: pricingPlan } = await supabase
    .from("pricing_plans")
    .select("pages_limit")
    .eq("slug", effectiveSlug)
    .eq("is_active", true)
    .maybeSingle();

  const maxPages = pricingPlan?.pages_limit ?? 5; // default to free limit if slug not found

  return {
    tier:       effectiveSlug,
    maxPages,
    websiteUrl: plan.website_url,
    planName:   plan.name,
  };
}

// ─────────────────────────────────────────
// URL PRIORITY
// ─────────────────────────────────────────
function getUrlPriority(url) {
  const path = url.toLowerCase();
  if (path.match(/\/$/) || path.split("/").length === 3)                      return 0;
  if (path.match(/\/(product|features?|platform|solutions?|capabilities)/))   return 1;
  if (path.match(/\/(pricing|plans?|subscription)/))                           return 2;
  if (path.match(/\/(about|company|team|story|mission)/))                      return 3;
  if (path.match(/\/(compare|vs|versus|alternative)/))                         return 4;
  if (path.match(/\/(customer|case-study|success|testimonial)/))               return 5;
  if (path.match(/\/(faq|help|support)/))                                      return 6;
  if (path.match(/\/(blog|post|article|news)/))                                return 7;
  return 8;
}

function shouldSkipUrl(url, baseUrl) {
  try {
    const parsed = new URL(url);
    const base   = new URL(baseUrl);
    if (parsed.hostname !== base.hostname) return true;
    const path = parsed.pathname.toLowerCase();
    if (path.match(/\.(pdf|png|jpg|jpeg|gif|svg|ico|css|js|xml|json|zip|woff|ttf|eot)$/)) return true;
    if (path.match(/\/(login|logout|signin|signup|register|auth|oauth|admin|dashboard|app|api|cdn)\//)) return true;
    if (parsed.hash && !parsed.pathname) return true;
    return false;
  } catch {
    return true;
  }
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash  = "";
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("ref");
    let normalized = parsed.toString();
    if (normalized.endsWith("/") && parsed.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}

function extractLinks($, baseUrl, currentUrl) {
  const links = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const absolute   = new URL(href, currentUrl).toString();
      const normalized = normalizeUrl(absolute);
      if (!shouldSkipUrl(normalized, baseUrl)) links.add(normalized);
    } catch {}
  });
  return [...links];
}

function extractMetadata($) {
  return {
    title:       $("title").first().text().trim()                       || null,
    description: $('meta[name="description"]').attr("content")?.trim() || null,
    h1:          $("h1").first().text().trim()                          || null,
    canonical:   $('link[rel="canonical"]').attr("href")?.trim()       || null,
  };
}

// ─────────────────────────────────────────
// FETCH PAGE
// ─────────────────────────────────────────
async function fetchPage(url) {
  let browser = null
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })

    const page = await browser.newPage()

    await page.setUserAgent("TecsaroBot/1.0 (+https://ai.tecsaro.com/bot)")
    await page.setDefaultNavigationTimeout(15000)

    const response = await page.goto(url, { waitUntil: "networkidle2" })

    if (!response) return null

    const status = response.status()
    if (status === 403 || status === 503 || status === 520 || status === 521 || status === 522) {
      console.log(`   🚫 Blocked: ${url} (HTTP ${status})`)
      return { blocked: true, url, status }
    }

    // Wait for main content to render
    await page.waitForSelector("body", { timeout: 5000 }).catch(() => {})

    // Extract everything from the fully rendered DOM
    const data = await page.evaluate(() => {
      // Title
      const title = document.title?.trim() || null

      // Meta description
      const metaDesc = document.querySelector('meta[name="description"]')?.content?.trim()
        || document.querySelector('meta[property="og:description"]')?.content?.trim()
        || null

      // H1
      const h1 = document.querySelector("h1")?.innerText?.trim() || null

      // Canonical
      const canonical = document.querySelector('link[rel="canonical"]')?.href?.trim() || null

      // Schema markup
      const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map(s => s.textContent).join(" ")

      // Word count — remove nav/header/footer first
      const cloned = document.body.cloneNode(true)
      cloned.querySelectorAll("nav, header, footer, script, style, noscript").forEach(el => el.remove())
      const bodyText = cloned.innerText?.replace(/\s+/g, " ").trim() || ""
      const wordCount = bodyText.split(" ").filter(Boolean).length

      // All links
      const links = [...document.querySelectorAll("a[href]")]
        .map(a => a.href)
        .filter(href => href && href.startsWith("http"))

      return { title, metaDesc, h1, canonical, schemas, bodyText, wordCount, links }
    })

    const contentText = data.bodyText.slice(0, 10000) // cap at 10k chars
    if (!contentText || contentText.length < 150) return null

    // Re-use existing link filtering logic
    const filteredLinks = data.links
      .map(l => { try { return normalizeUrl(l) } catch { return null } })
      .filter(l => l && !shouldSkipUrl(l, url))

    return {
      url,
      contentText,
      meta: {
        title:       data.title,
        description: data.metaDesc,
        h1:          data.h1,
        canonical:   data.canonical,
      },
      // Pass raw HTML-like string for schema detection in technicalAudit
      html: `<html><head><title>${data.title || ""}</title>
        ${data.canonical ? `<link rel="canonical" href="${data.canonical}">` : ""}
        ${data.schemas ? `<script type="application/ld+json">${data.schemas}</script>` : ""}
        <meta name="description" content="${data.metaDesc || ""}">
        </head><body><h1>${data.h1 || ""}</h1>${data.bodyText}</body></html>`,
      word_count: data.wordCount,
      links: filteredLinks,
    }

  } catch (err) {
    const status = err?.response?.status
    if (status === 403 || status === 503) {
      return { blocked: true, url, status }
    }
    console.log(`   ⚠️  Failed: ${url} (${err.code || err.message})`)
    return null
  } finally {
    if (browser) await browser.close()
  }
}

// ─────────────────────────────────────────
// SAVE BATCH
// ─────────────────────────────────────────
async function saveBatchAndUpdateProgress(jobId, planId, pages, crawledCount) {
  if (!pages.length) return

  await Promise.all(pages.map((page) =>
    supabase
      .from("aeo_pages")
      .upsert(
        {
          plan_id:      planId,
          url:          page.url,
          content_text: page.contentText,
          title:        page.meta.title,
          description:  page.meta.description,
          h1:           page.meta.h1,
          html:         page.html ?? null,        // ← add this
          word_count:   page.word_count ?? null,  // ← add this
          status:       "crawled",
          crawled_at:   new Date().toISOString(),
        },
        { onConflict: "plan_id,url" }
      )
  ))

  await supabase
    .from("aeo_crawl_jobs")
    .update({ pages_crawled: crawledCount, updated_at: new Date().toISOString() })
    .eq("id", jobId)

  console.log(`   💾 Saved batch | Total crawled: ${crawledCount}`)
}

// ─────────────────────────────────────────
// MARK CLOUDFLARE BLOCKED
// ─────────────────────────────────────────
async function markCloudflareBlocked(jobId, planId) {
  await supabase
    .from("aeo_crawl_jobs")
    .update({ status: "failed", error: "CLOUDFLARE_BLOCKED", finished_at: new Date().toISOString() })
    .eq("id", jobId);

  await supabase
    .from("aeo_pipeline_status")
    .update({ crawl_status: "failed", pipeline_phase: "failed", updated_at: new Date().toISOString() })
    .eq("plan_id", planId);

  await supabase
    .from("plans")
    .update({ pipeline_status: "failed" })
    .eq("id", planId);

  console.log("❌ Homepage blocked by Cloudflare — crawl failed");
}

// ─────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────
export async function startCrawlJob(planId) {
  // Check for existing job
  const { data: lastJob } = await supabase
    .from("aeo_crawl_jobs")
    .select("id, status, pages_crawled")
    .eq("plan_id", planId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastJob?.status === "running") {
    console.warn("⏭️  Crawl already running:", planId);
    return lastJob;
  }
  if (lastJob?.status === "completed") {
    console.warn("⏭️  Crawl already completed:", planId);
    return lastJob;
  }

  // ── Live limit from billing_profiles → pricing_plans ──
  const { tier, maxPages, websiteUrl, planName } = await getPagesLimit(planId);

  if (!websiteUrl) throw new Error("Plan missing website_url");

  console.log(`\n🕷️  [CrawlJob] Starting: "${planName}" | Plan: ${tier} | Max pages: ${maxPages}`);

  const { data: job, error: jobErr } = await supabase
    .from("aeo_crawl_jobs")
    .insert({
      plan_id:       planId,
      status:        "running",
      started_at:    new Date().toISOString(),
      max_pages:     maxPages,
      pages_crawled: 0,
      tier,
    })
    .select()
    .single();

  if (jobErr) throw jobErr;

  // Init pipeline status
  await supabase.from("aeo_pipeline_status").upsert({
    plan_id:           planId,
    crawl_status:      "running",
    understand_status: "pending",
    prompt_status:     "pending",
    mapping_status:    "pending",
    competitor_status: "pending",
    answer_status:     "pending",
    visibility_status: "pending",
    presence_status:   "pending",
    overall_status:    "pending",
    pipeline_phase:    "crawling",
    updated_at:        new Date().toISOString(),
  }, { onConflict: "plan_id" });

  await supabase
    .from("plans")
    .update({ pipeline_status: "crawling" })
    .eq("id", planId);

  // Run async — don't block HTTP response
  setTimeout(() => runCrawlJob(job.id, planId, websiteUrl, maxPages), 0);

  return job;
}

// ─────────────────────────────────────────
// MAIN CRAWLER
// ─────────────────────────────────────────
async function runCrawlJob(jobId, planId, websiteUrl, maxPages) {
  let baseUrl = websiteUrl.replace(/\/$/, "");
  if (!baseUrl.startsWith("http")) baseUrl = "https://" + baseUrl;

  const startUrl = normalizeUrl(baseUrl);
  const visited  = new Set();
  const failed   = new Set();
  let queue        = [{ url: startUrl, priority: 0 }];
  let crawledCount = 0;

  console.log(`\n🕷️  Crawling: ${baseUrl} | Limit: ${maxPages} | Batch: ${BATCH_SIZE}`);

  try {
    while (queue.length > 0 && crawledCount < maxPages) {
      queue.sort((a, b) => a.priority - b.priority);

      const remaining = maxPages - crawledCount;
      const batchSize = Math.min(BATCH_SIZE, remaining, queue.length);
      const batch     = [];

      while (batch.length < batchSize && queue.length > 0) {
        const item = queue.shift();
        if (!visited.has(item.url) && !failed.has(item.url)) {
          visited.add(item.url);
          batch.push(item.url);
        }
      }

      if (!batch.length) break;

      console.log(`\n📦 Batch [${crawledCount + 1}–${crawledCount + batch.length}/${maxPages}]:`);
      batch.forEach((url) => console.log(`   → ${url}`));

      const results      = await Promise.allSettled(batch.map(fetchPage));
      const successPages = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const url    = batch[i];

        if (result.status === "rejected" || !result.value) {
          failed.add(url);
          console.log(`   ❌ Skipped: ${url}`);
          continue;
        }

        const page = result.value;

        if (page.blocked) {
          console.log(`   🚫 Blocked by Cloudflare: ${url} (HTTP ${page.status})`);
          if (url === startUrl) {
            await markCloudflareBlocked(jobId, planId);
            return;
          }
          failed.add(url);
          continue;
        }

        successPages.push(page);
        console.log(`   ✅ ${page.contentText.length} chars | "${page.meta.title || "no title"}"`);

        if (crawledCount + successPages.length < maxPages) {
          for (const link of page.links) {
            if (!visited.has(link) && !failed.has(link)) {
              const alreadyQueued = queue.some((q) => q.url === link);
              if (!alreadyQueued) {
                queue.push({ url: link, priority: getUrlPriority(link) });
              }
            }
          }
        }
      }

      crawledCount += successPages.length;
      await saveBatchAndUpdateProgress(jobId, planId, successPages, crawledCount);
      console.log(`\n📊 Progress: ${crawledCount}/${maxPages} | Queue: ${queue.length} pending`);

      if (queue.length > 0 && crawledCount < maxPages) await sleep(500);
    }

    // ── Mark complete ──
    await supabase
      .from("aeo_crawl_jobs")
      .update({
        status:        "completed",
        pages_found:   visited.size,
        pages_crawled: crawledCount,
        finished_at:   new Date().toISOString(),
      })
      .eq("id", jobId);

    await supabase
      .from("aeo_pipeline_status")
      .update({ crawl_status: "completed", updated_at: new Date().toISOString() })
      .eq("plan_id", planId);

    console.log(`\n✅ [CrawlJob] Complete — ${crawledCount} pages`);

    await runPipelinePhase1(planId);

  } catch (err) {
    console.error("❌ [CrawlJob] Fatal error:", err.message);

    await supabase
      .from("aeo_crawl_jobs")
      .update({ status: "failed", error: err.message, finished_at: new Date().toISOString() })
      .eq("id", jobId);

    await supabase
      .from("aeo_pipeline_status")
      .update({ crawl_status: "failed", pipeline_phase: "failed", updated_at: new Date().toISOString() })
      .eq("plan_id", planId);
  }
}

// ─────────────────────────────────────────
// GET CRAWL STATUS
// ─────────────────────────────────────────
export async function getCrawlStatus(planId) {
  const { data: job } = await supabase
    .from("aeo_crawl_jobs")
    .select("id, status, error, pages_crawled, max_pages, started_at, finished_at, tier")
    .eq("plan_id", planId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!job) return { status: "not_started", pages_crawled: 0, max_pages: 5 };

  // Cloudflare block — return helpful message to frontend
  if (job.status === "failed" && job.error === "CLOUDFLARE_BLOCKED") {
    return {
      status:        "failed",
      errorType:     "CLOUDFLARE_BLOCKED",
      message:       "Your website's Cloudflare is blocking TecsaroBot",
      fix:           "Go to Cloudflare → Security → WAF → Custom Rules → Add: User-Agent contains 'TecsaroBot' → Allow",
      helpLink:      "https://ai.tecsaro.com/help",
      pages_crawled: 0,
      max_pages:     job.max_pages || 5,
    };
  }

  const { data: pages } = await supabase
    .from("aeo_pages")
    .select("url, title, crawled_at")
    .eq("plan_id", planId)
    .order("crawled_at", { ascending: false })
    .limit(job.pages_crawled || 0);

  return {
    status:        job.status,
    pages_crawled: job.pages_crawled || 0,
    max_pages:     job.max_pages     || 5,
    progress_pct:  Math.round(((job.pages_crawled || 0) / (job.max_pages || 5)) * 100),
    started_at:    job.started_at,
    finished_at:   job.finished_at,
    tier:          job.tier,
    recent_pages:  pages || [],
    milestones:    job.max_pages <= 10 ? [2, 5, 8, 10] : [5, 10, 15, 20],
  };
}