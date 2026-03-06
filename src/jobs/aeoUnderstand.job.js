// import { supabase } from "../config/supabase.js";

// /**
//  * Understanding Job
//  * - Uses ONLY existing columns
//  * - No embeddings
//  * - No AI calls
//  */
// export async function runUnderstandingJob(planId) {
//   console.log("🧠 Understanding job started:", planId);

//   const { data: pages, error } = await supabase
//     .from("aeo_pages")
//     .select("id, content_text, status")
//     .eq("plan_id", planId)
//     .eq("status", "crawled");

//   if (error) {
//     console.error("❌ Failed to fetch crawled pages:", error.message);
//     throw error;
//   }

//   if (!pages || pages.length === 0) {
//     console.log("✅ No crawled pages found");
//     return;
//   }

//   let understood = 0;
//   let skipped = 0;

//   for (const page of pages) {
//     const text = page.content_text?.trim();

//     if (!text || text.length < 200) {
//       await supabase
//         .from("aeo_pages")
//         .update({ status: "skipped" })
//         .eq("id", page.id);

//       skipped++;
//       continue;
//     }

//     await supabase
//       .from("aeo_pages")
//       .update({ status: "understood" })
//       .eq("id", page.id);

//     understood++;
//   }

//   console.log(
//     `🧠 Understanding completed: ${understood} understood, ${skipped} skipped`
//   );
// }




import { supabase } from "../config/supabase.js";
import { runGemini } from "../services/gemini.service.js";
import { safeJsonParse } from "../utils/safeJson.js";

export async function runUnderstandingJob(planId) {
  console.log("🧠 Understanding job started:", planId);

  const { data: pages, error } = await supabase
    .from("aeo_pages")
    .select("id, url, content_text, status")
    .eq("plan_id", planId)
    .eq("status", "crawled");

  if (error) {
    console.error("❌ Failed to fetch crawled pages:", error.message);
    throw error;
  }

  if (!pages?.length) {
    console.log("✅ No crawled pages found");
    return;
  }

  let understood = 0;
  let skipped = 0;

  for (const page of pages) {
    const text = page.content_text?.trim();

    if (!text || text.length < 200) {
      await supabase
        .from("aeo_pages")
        .update({ status: "skipped" })
        .eq("id", page.id);
      skipped++;
      continue;
    }

    try {
      // ✅ Generate AI summary
      const prompt = `
You are an AI SEO analyst. Analyze this webpage content and return a concise summary.

PAGE URL: ${page.url}
PAGE CONTENT:
${text.slice(0, 3000)}

Return ONLY JSON:
{
  "summary": "2-3 sentence summary of what this page is about and its key value propositions",
  "topics": ["topic1", "topic2", "topic3"],
  "key_features": ["feature1", "feature2"]
}
      `.trim();

      const raw = await runGemini(prompt);
      const parsed = safeJsonParse(raw);

      const ai_summary = parsed?.summary || text.slice(0, 500);

      // ✅ Save summary + mark understood
      await supabase
        .from("aeo_pages")
        .update({
          status: "understood",
          ai_summary: ai_summary
        })
        .eq("id", page.id);

      understood++;
      console.log(`✅ Understood: ${page.url}`);

    } catch (err) {
      console.error(`❌ Failed to understand ${page.url}:`, err.message);

      // Still mark as understood with raw text fallback
      await supabase
        .from("aeo_pages")
        .update({
          status: "understood",
          ai_summary: text.slice(0, 500)
        })
        .eq("id", page.id);

      understood++;
    }
  }

  console.log(`🧠 Understanding completed: ${understood} understood, ${skipped} skipped`);
}