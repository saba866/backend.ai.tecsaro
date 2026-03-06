import { supabase } from "../config/supabase.js";

/**
 * Map prompts to pages using cosine similarity
 */
export async function runMappingJob(pages, prompts) {
  console.log("🔗 Mapping prompts to pages...");

  // 1️⃣ Filter pages with embeddings
  const pagesWithEmbeddings = pages.filter(
    p => Array.isArray(p.embedding) && p.embedding.length > 0
  );

  if (!pagesWithEmbeddings.length) {
    console.warn("⚠️ No page embeddings available for mapping");
    return;
  }

  // 2️⃣ Embed prompts (local embeddings)
  for (const prompt of prompts) {
    if (!prompt.embedding || !Array.isArray(prompt.embedding)) {
      console.warn(`⏭️ Skipping prompt (no embedding): ${prompt.prompt}`);
      continue;
    }

    let best = { score: -1, page_id: null };

    for (const page of pagesWithEmbeddings) {
      const score = cosine(prompt.embedding, page.embedding);
      if (score > best.score) {
        best = { score, page_id: page.id };
      }
    }

    if (!best.page_id) continue;

    await supabase.from("aeo_prompt_page_map").upsert({
      prompt_id: prompt.id,
      page_id: best.page_id,
      score: best.score,
      is_primary: true,
    });
  }

  console.log("✅ Mapping completed");
}

/**
 * Cosine similarity
 */
function cosine(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
