

// import axios   from "axios";
// import * as cheerio from "cheerio";
// import { supabase }    from "../config/supabase.js";
// import { cleanContent } from "../utils/aeoCleaner.js";
// import { runUnderstandingJob } from "./aeoUnderstand.job.js";
// import { startPromptDiscovery } from "../services/aeo/aeoPrompt.service.js";

// // ─────────────────────────────────────────
// // TIER LIMITS
// // ─────────────────────────────────────────
// const PAGE_LIMITS = {
//   starter: 10,
//   pro:     20,
//   default: 10,
// };

// // ─────────────────────────────────────────
// // CONCURRENT BATCH SIZE
// // Crawl 5 pages at a time in parallel
// // After each batch → save to DB → frontend sees update
// // ─────────────────────────────────────────
// const BATCH_SIZE     = 5;
// const REQUEST_TIMEOUT = 10000; // 10s per page
// const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// // ─────────────────────────────────────────
// // URL PRIORITY
// // ─────────────────────────────────────────
// function getUrlPriority(url) {
//   const path = url.toLowerCase();
//   if (path.match(/\/$/) || path.split("/").length === 3)                      return 0;
//   if (path.match(/\/(product|features?|platform|solutions?|capabilities)/))   return 1;
//   if (path.match(/\/(pricing|plans?|subscription)/))                           return 2;
//   if (path.match(/\/(about|company|team|story|mission)/))                      return 3;
//   if (path.match(/\/(compare|vs|versus|alternative)/))                         return 4;
//   if (path.match(/\/(customer|case-study|success|testimonial)/))               return 5;
//   if (path.match(/\/(faq|help|support)/))                                      return 6;
//   if (path.match(/\/(blog|post|article|news)/))                                return 7;
//   return 8;
// }

// function shouldSkipUrl(url, baseUrl) {
//   try {
//     const parsed = new URL(url);
//     const base   = new URL(baseUrl);
//     if (parsed.hostname !== base.hostname) return true;
//     const path = parsed.pathname.toLowerCase();
//     if (path.match(/\.(pdf|png|jpg|jpeg|gif|svg|ico|css|js|xml|json|zip|woff|ttf|eot)$/)) return true;
//     if (path.match(/\/(login|logout|signin|signup|register|auth|oauth|admin|dashboard|app|api|cdn)\//)) return true;
//     if (parsed.hash && !parsed.pathname) return true;
//     return false;
//   } catch {
//     return true;
//   }
// }

// function normalizeUrl(url) {
//   try {
//     const parsed = new URL(url);
//     parsed.hash  = "";
//     parsed.searchParams.delete("utm_source");
//     parsed.searchParams.delete("utm_medium");
//     parsed.searchParams.delete("utm_campaign");
//     parsed.searchParams.delete("ref");
//     let normalized = parsed.toString();
//     if (normalized.endsWith("/") && parsed.pathname !== "/") {
//       normalized = normalized.slice(0, -1);
//     }
//     return normalized;
//   } catch {
//     return url;
//   }
// }

// function extractLinks($, baseUrl, currentUrl) {
//   const links = new Set();
//   $("a[href]").each((_, el) => {
//     const href = $(el).attr("href");
//     if (!href) return;
//     try {
//       const absolute   = new URL(href, currentUrl).toString();
//       const normalized = normalizeUrl(absolute);
//       if (!shouldSkipUrl(normalized, baseUrl)) links.add(normalized);
//     } catch {}
//   });
//   return [...links];
// }

// function extractMetadata($) {
//   return {
//     title:       $("title").first().text().trim()                        || null,
//     description: $('meta[name="description"]').attr("content")?.trim()  || null,
//     h1:          $("h1").first().text().trim()                           || null,
//     canonical:   $('link[rel="canonical"]').attr("href")?.trim()        || null,
//   };
// }

// // ─────────────────────────────────────────
// // FETCH + PARSE SINGLE PAGE
// // Returns null if page should be skipped
// // ─────────────────────────────────────────
// async function fetchPage(url) {
//   try {
//     const response = await axios.get(url, {
//       timeout:      REQUEST_TIMEOUT,
//       maxRedirects: 5,
//       headers: {
//         "User-Agent":      "Mozilla/5.0 (compatible; TecSaroBot/1.0)",
//         "Accept":          "text/html,application/xhtml+xml",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const contentType = response.headers["content-type"] || "";
//     if (!contentType.includes("text/html")) return null;

//     const $ = cheerio.load(response.data);

//     $("nav, header, footer, script, style, noscript, [role='navigation'], .nav, .header, .footer, .cookie, .banner").remove();

//     const rawText     = $("main, article, .content, #content, body").first().text() || $("body").text();
//     const contentText = cleanContent(rawText);

//     if (!contentText || contentText.length < 150) return null;

//     const meta  = extractMetadata($);
//     const links = extractLinks($, url, url);

//     return { url, contentText, meta, links };

//   } catch (err) {
//     console.log(`   ⚠️  Failed: ${url} (${err.code || err.message})`);
//     return null;
//   }
// }

// // ─────────────────────────────────────────
// // SAVE BATCH TO DB + UPDATE PROGRESS
// // Called after every 5 pages crawled
// // Frontend polls /crawl/:planId/status to see progress
// // ─────────────────────────────────────────
// async function saveBatchAndUpdateProgress(jobId, planId, pages, crawledCount) {
//   if (!pages.length) return;

//   // Save all pages in parallel
//   await Promise.all(pages.map((page) =>
//     supabase
//       .from("aeo_pages")
//       .upsert(
//         {
//           plan_id:      planId,
//           url:          page.url,
//           content_text: page.contentText,
//           title:        page.meta.title,
//           description:  page.meta.description,
//           h1:           page.meta.h1,
//           status:       "crawled",
//           crawled_at:   new Date().toISOString(),
//         },
//         { onConflict: "plan_id,url" }
//       )
//   ));

//   // Update job progress — frontend polls this
//   await supabase
//     .from("aeo_crawl_jobs")
//     .update({
//       pages_crawled: crawledCount,
//       updated_at:    new Date().toISOString(),
//     })
//     .eq("id", jobId);

//   console.log(`   💾 Saved batch | Total crawled: ${crawledCount}`);
// }

// // ─────────────────────────────────────────
// // ENTRY POINT — SAFE & IDEMPOTENT
// // ─────────────────────────────────────────
// export async function startCrawlJob(planId) {
//   // ── CHECK EXISTING JOB ──
//   const { data: lastJob } = await supabase
//     .from("aeo_crawl_jobs")
//     .select("id, status, pages_crawled")
//     .eq("plan_id", planId)
//     .order("started_at", { ascending: false })
//     .limit(1)
//     .maybeSingle();

//   if (lastJob?.status === "running") {
//     console.warn("⏭️  Crawl already running:", planId);
//     return lastJob;
//   }

//   if (lastJob?.status === "completed") {
//     console.warn("⏭️  Crawl already completed:", planId);
//     return lastJob;
//   }

//   // ── LOAD PLAN ──
//   const { data: plan, error: planErr } = await supabase
//     .from("plans")
//     .select("website_url, tier, name")
//     .eq("id", planId)
//     .single();

//   if (planErr || !plan?.website_url) {
//     throw new Error("Plan not found or missing website_url");
//   }

//   const tier     = plan.tier || "starter";
//   const maxPages = PAGE_LIMITS[tier] || PAGE_LIMITS.default;

//   console.log(`\n🕷️  [CrawlJob] Starting: "${plan.name}"`);
//   console.log(`   Tier: ${tier} | Max pages: ${maxPages}`);

//   // ── CREATE JOB RECORD ──
//   const { data: job, error: jobErr } = await supabase
//     .from("aeo_crawl_jobs")
//     .insert({
//       plan_id:       planId,
//       status:        "running",
//       started_at:    new Date().toISOString(),
//       max_pages:     maxPages,
//       pages_crawled: 0,
//       tier,
//     })
//     .select()
//     .single();

//   if (jobErr) throw jobErr;

//   // ── INIT PIPELINE STATUS ──
//   await supabase.from("aeo_pipeline_status").upsert({
//     plan_id:           planId,
//     crawl_status:      "running",
//     understand_status: "pending",
//     prompt_status:     "pending",
//     updated_at:        new Date().toISOString(),
//   });

//   // ── RUN ASYNC — don't block HTTP response ──
//   setTimeout(() => runCrawlJob(job.id, planId, plan.website_url, maxPages), 0);

//   return job;
// }

// // ─────────────────────────────────────────
// // MAIN CRAWLER — concurrent batches of 5
// // ─────────────────────────────────────────
// async function runCrawlJob(jobId, planId, websiteUrl, maxPages) {
//   let baseUrl = websiteUrl.replace(/\/$/, "");
//   if (!baseUrl.startsWith("http")) baseUrl = "https://" + baseUrl;

//   const startUrl = normalizeUrl(baseUrl);
//   const visited  = new Set();
//   const failed   = new Set();

//   // Priority queue
//   let queue        = [{ url: startUrl, priority: 0 }];
//   let crawledCount = 0;

//   console.log(`\n🕷️  Crawling: ${baseUrl} | Limit: ${maxPages} | Batch: ${BATCH_SIZE}`);

//   try {
//     while (queue.length > 0 && crawledCount < maxPages) {
//       // Sort by priority — best pages first
//       queue.sort((a, b) => a.priority - b.priority);

//       // Take next batch (up to BATCH_SIZE, but don't exceed maxPages)
//       const remaining  = maxPages - crawledCount;
//       const batchSize  = Math.min(BATCH_SIZE, remaining, queue.length);
//       const batch      = [];

//       while (batch.length < batchSize && queue.length > 0) {
//         const item = queue.shift();
//         if (!visited.has(item.url) && !failed.has(item.url)) {
//           visited.add(item.url);
//           batch.push(item.url);
//         }
//       }

//       if (!batch.length) break;

//       console.log(`\n📦 Batch [${crawledCount + 1}–${crawledCount + batch.length}/${maxPages}]:`);
//       batch.forEach((url) => console.log(`   → ${url}`));

//       // ── FETCH BATCH IN PARALLEL ──
//       const results = await Promise.allSettled(batch.map(fetchPage));

//       const successPages = [];

//       for (let i = 0; i < results.length; i++) {
//         const result = results[i];
//         const url    = batch[i];

//         if (result.status === "rejected" || !result.value) {
//           failed.add(url);
//           console.log(`   ❌ Skipped: ${url}`);
//           continue;
//         }

//         const page = result.value;
//         successPages.push(page);

//         console.log(`   ✅ ${page.contentText.length} chars | "${page.meta.title || "no title"}"`);

//         // ── DISCOVER NEW LINKS ──
//         if (crawledCount + successPages.length < maxPages) {
//           for (const link of page.links) {
//             if (!visited.has(link) && !failed.has(link)) {
//               const alreadyQueued = queue.some((q) => q.url === link);
//               if (!alreadyQueued) {
//                 queue.push({ url: link, priority: getUrlPriority(link) });
//               }
//             }
//           }
//         }
//       }

//       // ── SAVE BATCH + UPDATE PROGRESS ──
//       // Frontend sees progress update after every 5 pages
//       crawledCount += successPages.length;
//       await saveBatchAndUpdateProgress(jobId, planId, successPages, crawledCount);

//       console.log(`\n📊 Progress: ${crawledCount}/${maxPages} | Queue: ${queue.length} pending`);

//       // Small delay between batches to be respectful
//       if (queue.length > 0 && crawledCount < maxPages) {
//         await sleep(500);
//       }
//     }

//     // ── MARK COMPLETE ──
//     await supabase
//       .from("aeo_crawl_jobs")
//       .update({
//         status:        "completed",
//         pages_found:   visited.size,
//         pages_crawled: crawledCount,
//         finished_at:   new Date().toISOString(),
//       })
//       .eq("id", jobId);

//     await supabase
//       .from("aeo_pipeline_status")
//       .update({
//         crawl_status: "completed",
//         updated_at:   new Date().toISOString(),
//       })
//       .eq("plan_id", planId);

//     console.log(`\n✅ [CrawlJob] Complete`);
//     console.log(`   Crawled: ${crawledCount} pages`);
//     console.log(`   Queue:   ${visited.size} URLs discovered`);

//     // ── TRIGGER NEXT STEPS ──
//     // Understanding runs first, then pauses for prompt review
//     await runUnderstandingJob(planId);
//     await startPromptDiscovery(planId);
//     // Pipeline STOPS here — waits for user to approve prompts

//   } catch (err) {
//     console.error("❌ [CrawlJob] Fatal error:", err.message);

//     await supabase
//       .from("aeo_crawl_jobs")
//       .update({
//         status:      "failed",
//         error:       err.message,
//         finished_at: new Date().toISOString(),
//       })
//       .eq("id", jobId);

//     await supabase
//       .from("aeo_pipeline_status")
//       .update({
//         crawl_status: "failed",
//         updated_at:   new Date().toISOString(),
//       })
//       .eq("plan_id", planId);
//   }
// }

// // ─────────────────────────────────────────
// // GET CRAWL STATUS — for frontend polling
// // ─────────────────────────────────────────
// export async function getCrawlStatus(planId) {
//   const { data: job } = await supabase
//     .from("aeo_crawl_jobs")
//     .select("id, status, pages_crawled, max_pages, started_at, finished_at, tier")
//     .eq("plan_id", planId)
//     .order("started_at", { ascending: false })
//     .limit(1)
//     .maybeSingle();

//   if (!job) return { status: "not_started", pages_crawled: 0, max_pages: 20 };

//   const { data: pages } = await supabase
//     .from("aeo_pages")
//     .select("url, title, crawled_at")
//     .eq("plan_id", planId)
//     .order("crawled_at", { ascending: false })
//     .limit(job.pages_crawled || 0);

//   return {
//     status:        job.status,
//     pages_crawled: job.pages_crawled || 0,
//     max_pages:     job.max_pages     || 20,
//     progress_pct:  Math.round(((job.pages_crawled || 0) / (job.max_pages || 20)) * 100),
//     started_at:    job.started_at,
//     finished_at:   job.finished_at,
//     tier:          job.tier,
//     recent_pages:  pages || [],
//     // Milestone labels for frontend progress bar
//     milestones:    getMilestones(job.max_pages || 20),
//   };
// }

// // ─────────────────────────────────────────
// // MILESTONES — tells frontend what to show
// // Starter: [5, 10, 15, 20]
// // Pro:     [5, 10, 20, 30, 40]
// // ─────────────────────────────────────────
// function getMilestones(maxPages) {
//   if (maxPages <= 20) return [5, 10, 15, 20];
//   return [5, 10, 20, 30, 40];
// }


import axios   from "axios";
import * as cheerio from "cheerio";
import { supabase }    from "../config/supabase.js";
import { cleanContent } from "../utils/aeoCleaner.js";
import { runPipelinePhase1 } from "./aeoPipeline.job.js"; // ← CHANGED

// ─────────────────────────────────────────
// TIER LIMITS
// ─────────────────────────────────────────
const PAGE_LIMITS = {
  starter: 10,
  pro:     20,
  default: 10,
};

const BATCH_SIZE      = 5;
const REQUEST_TIMEOUT = 10000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    title:       $("title").first().text().trim()                        || null,
    description: $('meta[name="description"]').attr("content")?.trim()  || null,
    h1:          $("h1").first().text().trim()                           || null,
    canonical:   $('link[rel="canonical"]').attr("href")?.trim()        || null,
  };
}

async function fetchPage(url) {
  try {
    const response = await axios.get(url, {
      timeout:      REQUEST_TIMEOUT,
      maxRedirects: 5,
      headers: {
        "User-Agent":      "Mozilla/5.0 (compatible; TecSaroBot/1.0)",
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const contentType = response.headers["content-type"] || "";
    if (!contentType.includes("text/html")) return null;

    const $ = cheerio.load(response.data);
    $("nav, header, footer, script, style, noscript, [role='navigation'], .nav, .header, .footer, .cookie, .banner").remove();

    const rawText     = $("main, article, .content, #content, body").first().text() || $("body").text();
    const contentText = cleanContent(rawText);

    if (!contentText || contentText.length < 150) return null;

    const meta  = extractMetadata($);
    const links = extractLinks($, url, url);

    return { url, contentText, meta, links };
  } catch (err) {
    console.log(`   ⚠️  Failed: ${url} (${err.code || err.message})`);
    return null;
  }
}

async function saveBatchAndUpdateProgress(jobId, planId, pages, crawledCount) {
  if (!pages.length) return;

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
          status:       "crawled",
          crawled_at:   new Date().toISOString(),
        },
        { onConflict: "plan_id,url" }
      )
  ));

  await supabase
    .from("aeo_crawl_jobs")
    .update({ pages_crawled: crawledCount, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  console.log(`   💾 Saved batch | Total crawled: ${crawledCount}`);
}

// ─────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────
export async function startCrawlJob(planId) {
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

  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("website_url, tier, name")
    .eq("id", planId)
    .single();

  if (planErr || !plan?.website_url) throw new Error("Plan not found or missing website_url");

  const tier     = plan.tier || "starter";
  const maxPages = PAGE_LIMITS[tier] || PAGE_LIMITS.default;

  console.log(`\n🕷️  [CrawlJob] Starting: "${plan.name}" | Tier: ${tier} | Max: ${maxPages}`);

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

  // Init pipeline status row
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

  // Also set plan.pipeline_status so Step3 polling works
  await supabase
    .from("plans")
    .update({ pipeline_status: "crawling" })
    .eq("id", planId);

  // Run async — don't block HTTP response
  setTimeout(() => runCrawlJob(job.id, planId, plan.website_url, maxPages), 0);

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

    // ── Mark crawl complete ──
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

    // ── CHANGED: delegate to Phase 1 (understand → prompt discovery → pause) ──
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
    .select("id, status, pages_crawled, max_pages, started_at, finished_at, tier")
    .eq("plan_id", planId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!job) return { status: "not_started", pages_crawled: 0, max_pages: 20 };

  const { data: pages } = await supabase
    .from("aeo_pages")
    .select("url, title, crawled_at")
    .eq("plan_id", planId)
    .order("crawled_at", { ascending: false })
    .limit(job.pages_crawled || 0);

  return {
    status:        job.status,
    pages_crawled: job.pages_crawled || 0,
    max_pages:     job.max_pages     || 20,
    progress_pct:  Math.round(((job.pages_crawled || 0) / (job.max_pages || 20)) * 100),
    started_at:    job.started_at,
    finished_at:   job.finished_at,
    tier:          job.tier,
    recent_pages:  pages || [],
    milestones:    job.max_pages <= 20 ? [5, 10, 15, 20] : [5, 10, 20, 30, 40],
  };
}