




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