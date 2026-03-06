import { supabase } from "../../config/supabase.js";
import { runUnderstandingJob } from "../../jobs/aeoUnderstand.job.js";

export const startUnderstandingJob = async (planId) => {
  const { data: pages, error } = await supabase
    .from("aeo_pages")
    .select("id, url, content_text")
    .eq("plan_id", planId)
    .eq("status", "crawled");

  if (error) throw error;
  if (!pages?.length) {
    console.log("ℹ️ No crawled pages found for understanding");
    return;
  }

  console.log("🧠 Starting understanding job for", pages.length, "pages");

  // async non-blocking job
  setTimeout(() => runUnderstandingJob(pages), 0);
};
