import { supabase } from "../../config/supabase.js";
import { askAI } from "./index.js";

const BRAND_DOMAIN = "tecsaro.com";

export async function checkVisibility(planId, promptId, promptText) {
  const aiPrompt = `
Answer the question below and list sources if available.

QUESTION:
${promptText}
`;

  const answer = await askAI(aiPrompt);
  if (!answer) return;

  const mentioned = answer.toLowerCase().includes(BRAND_DOMAIN);

  let position = null;
  let sourceUrl = null;

  if (mentioned) {
    position = answer
      .toLowerCase()
      .split(BRAND_DOMAIN)[0]
      .split("\n").length;

    sourceUrl = `https://${BRAND_DOMAIN}`;
  }

  // Get last visibility record
  const { data: last } = await supabase
    .from("aeo_visibility")
    .select("*")
    .eq("plan_id", planId)
    .eq("prompt_id", promptId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const changed =
    !last ||
    last.mentioned !== mentioned ||
    last.position !== position;

  if (!changed) return;

  await supabase.from("aeo_visibility").insert({
    plan_id: planId,
    prompt_id: promptId,
    engine: "chatgpt",
    mentioned,
    position,
    source_url: sourceUrl,
    snapshot: answer.slice(0, 3000),
  });

  console.log(
    mentioned
      ? `📈 Visibility improved for prompt`
      : `📉 Visibility dropped for prompt`
  );
}
