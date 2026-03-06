import { supabase } from "../../config/supabase.js";
import { askAI } from "./index.js";

export const startMappingJob = async (planId) => {
  const { data: prompts } = await supabase
    .from("aeo_prompts")
    .select("id, prompt")
    .eq("plan_id", planId)
    .eq("status", "new");

  const { data: pages } = await supabase
    .from("aeo_pages")
    .select("id, content_text")
    .eq("plan_id", planId);

  if (!prompts?.length || !pages?.length) return;

  for (const prompt of prompts) {
    const aiPrompt = `
Match this question to the BEST page.

Question:
${prompt.prompt}

Pages:
${pages.map(p => `ID:${p.id}\n${p.content_text.slice(0, 1000)}`).join("\n\n")}

Return JSON:
{
  "page_id": string,
  "confidence": number
}
`;

    try {
      const result = await askAI(aiPrompt);
      const parsed = JSON.parse(result);

      await supabase.from("aeo_prompt_page_map").insert({
        prompt_id: prompt.id,
        page_id: parsed.page_id,
        confidence: parsed.confidence,
        is_primary: true,
      });

      await supabase
        .from("aeo_prompts")
        .update({ status: "mapped" })
        .eq("id", prompt.id);

    } catch (err) {
      console.error("Mapping failed:", err.message);
    }
  }
};
