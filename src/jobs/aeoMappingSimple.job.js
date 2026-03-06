import { supabase } from "../config/supabase.js";

/**
 * Simple keyword-based mapping (no embeddings required)
 */
export async function runSimpleMappingJob(planId) {
  console.log("🔗 Running simple prompt-page mapping for plan:", planId);

  // Get all prompts for this plan
  const { data: prompts, error: promptError } = await supabase
    .from("aeo_prompts")
    .select("id, prompt")
    .eq("plan_id", planId);

  if (promptError) {
    console.error("❌ Failed to load prompts:", promptError);
    throw promptError;
  }

  if (!prompts?.length) {
    console.log("⚠️ No prompts to map");
    return;
  }

  // Get all understood pages for this plan
  const { data: pages, error: pageError } = await supabase
    .from("aeo_pages")
    .select("id, url, content_text")
    .eq("plan_id", planId)
    .eq("status", "understood");

  if (pageError) {
    console.error("❌ Failed to load pages:", pageError);
    throw pageError;
  }

  if (!pages?.length) {
    console.log("⚠️ No pages to map to");
    return;
  }

  console.log(`📊 Mapping ${prompts.length} prompts to ${pages.length} pages...`);

  // Map each prompt to best matching page
  let mappedCount = 0;

  for (const prompt of prompts) {
    let bestMatch = { pageId: null, score: 0 };

    for (const page of pages) {
      const score = calculateRelevance(prompt.prompt, page.content_text);
      if (score > bestMatch.score) {
        bestMatch = { pageId: page.id, score };
      }
    }

    if (bestMatch.pageId && bestMatch.score > 0.1) { // Minimum relevance threshold
      const { error: insertError } = await supabase
        .from("aeo_prompt_page_map")
        .upsert({
          prompt_id: prompt.id,
          page_id: bestMatch.pageId,
          score: bestMatch.score,
          is_primary: true,
        }, {
          onConflict: "prompt_id,page_id"
        });

      if (insertError) {
        console.error(`❌ Failed to map prompt ${prompt.id}:`, insertError);
      } else {
        mappedCount++;
        console.log(`✅ Mapped (score: ${bestMatch.score.toFixed(2)}): "${prompt.prompt.substring(0, 50)}..."`);
      }
    } else {
      console.log(`⏭️ No good match for: "${prompt.prompt.substring(0, 50)}..."`);
    }
  }

  console.log(`✅ Mapping completed: ${mappedCount}/${prompts.length} prompts mapped`);
}

/**
 * Simple keyword relevance scoring
 */
function calculateRelevance(prompt, content) {
  if (!content || !prompt) return 0;

  const promptWords = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 3); // Only words > 3 chars

  const contentLower = content.toLowerCase();
  
  let matches = 0;
  let totalWeight = 0;

  for (const word of promptWords) {
    totalWeight++;
    if (contentLower.includes(word)) {
      matches++;
    }
  }

  return totalWeight > 0 ? matches / totalWeight : 0;
}