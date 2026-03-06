// import { startCrawlJob } from "../../jobs/aeoCrawl.job.js";
// import apiResponse from "../../utils/apiResponse.js";

// export const startAeoCrawl = async (req, res) => {
//   const { planId } = req.body;

//   if (!planId) {
//     return apiResponse(res, 400, "planId is required");
//   }

//   await startCrawlJob(planId);

//   return apiResponse(res, 200, "AEO crawl started");
// };


// import { startCrawlJob } from "../../jobs/aeoCrawl.job.js";
// import { supabase } from "../../config/supabase.js";
// import apiResponse from "../../utils/apiResponse.js";

// // ─────────────────────────────────────────
// // POST /api/aeo/crawl/start
// // Starts a crawl job for a plan.
// // Respects tier limits: starter=20, pro=40
// // Body: { planId }
// // ─────────────────────────────────────────
// export const startAeoCrawl = async (req, res) => {
//   const { planId } = req.body;

//   if (!planId) {
//     return apiResponse(res, 400, "planId is required");
//   }

//   try {
//     const job = await startCrawlJob(planId);
//     return apiResponse(res, 200, "AEO crawl started", {
//       jobId:  job.id,
//       status: job.status,
//     });
//   } catch (err) {
//     console.error("❌ startAeoCrawl error:", err.message);
//     return apiResponse(res, 500, "Failed to start crawl");
//   }
// };

// // ─────────────────────────────────────────
// // GET /api/aeo/crawl/status/:planId
// // Returns latest crawl job status + progress.
// // Frontend can poll this while crawl runs.
// // ─────────────────────────────────────────
// export const getCrawlStatus = async (req, res) => {
//   const { planId } = req.params;

//   if (!planId) {
//     return apiResponse(res, 400, "planId is required");
//   }

//   try {
//     const { data: job, error } = await supabase
//       .from("aeo_crawl_jobs")
//       .select("id, status, pages_found, pages_crawled, max_pages, tier, started_at, finished_at")
//       .eq("plan_id", planId)
//       .order("started_at", { ascending: false })
//       .limit(1)
//       .maybeSingle();

//     if (error) throw error;

//     if (!job) {
//       return apiResponse(res, 404, "No crawl job found for this plan");
//     }

//     // Also return page count from aeo_pages for accuracy
//     const { count: pageCount } = await supabase
//       .from("aeo_pages")
//       .select("*", { count: "exact", head: true })
//       .eq("plan_id", planId)
//       .eq("status", "crawled");

//     return apiResponse(res, 200, "Crawl status", {
//       ...job,
//       actual_pages_saved: pageCount || 0,
//       progress_percent: job.max_pages
//         ? Math.round(((job.pages_crawled || 0) / job.max_pages) * 100)
//         : 0,
//     });
//   } catch (err) {
//     console.error("❌ getCrawlStatus error:", err.message);
//     return apiResponse(res, 500, "Failed to load crawl status");
//   }
// };

// import { supabase }       from "../../config/supabase.js";
// import { startCrawlJob, getCrawlStatus } from "../../jobs/aeoCrawl.job.js";
// import apiResponse from "../../utils/apiResponse.js";

// // ─────────────────────────────────────────
// // POST /api/aeo/crawl
// // Starts crawl job — returns immediately
// // Frontend polls /crawl/:planId/status for progress
// // ─────────────────────────────────────────
// export const startCrawl = async (req, res) => {
//   try {
//     const { planId } = req.body;
//     if (!planId) return apiResponse(res, 400, "planId required");

//     const job = await startCrawlJob(planId);

//     return apiResponse(res, 200, "Crawl started", {
//       job_id:   job.id,
//       status:   job.status,
//       max_pages: job.max_pages,
//     });

//   } catch (err) {
//     console.error("❌ startCrawl error:", err.message);
//     return apiResponse(res, 500, err.message);
//   }
// };

// // ─────────────────────────────────────────
// // GET /api/aeo/crawl/:planId/status
// // Frontend polls this every 2 seconds
// // Returns progress + recent pages crawled
// // ─────────────────────────────────────────
// export const crawlStatus = async (req, res) => {
//   try {
//     const { planId } = req.params;
//     if (!planId) return apiResponse(res, 400, "planId required");

//     const status = await getCrawlStatus(planId);

//     return apiResponse(res, 200, "Crawl status", status);

//   } catch (err) {
//     console.error("❌ crawlStatus error:", err.message);
//     return apiResponse(res, 500, "Failed to load crawl status");
//   }
// };




import { supabase }                      from "../../config/supabase.js";
import { startCrawlJob, getCrawlStatus } from "../../jobs/aeoCrawl.job.js";
import apiResponse                       from "../../utils/apiResponse.js";

export const startAeoCrawl = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return apiResponse(res, 400, "planId is required");
    const job = await startCrawlJob(planId);
    return apiResponse(res, 200, "Crawl started", { job_id: job.id, status: job.status, max_pages: job.max_pages });
  } catch (err) {
    console.error("❌ startAeoCrawl error:", err.message);
    return apiResponse(res, 500, "Failed to start crawl");
  }
};

export const getAeoCrawlStatus = async (req, res) => {
  try {
    const { planId } = req.params;
    if (!planId) return apiResponse(res, 400, "planId is required");
    const status = await getCrawlStatus(planId);
    return apiResponse(res, 200, "Crawl status", status);
  } catch (err) {
    console.error("❌ getAeoCrawlStatus error:", err.message);
    return apiResponse(res, 500, "Failed to load crawl status");
  }
};