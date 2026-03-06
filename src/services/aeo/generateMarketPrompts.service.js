import { runGemini } from "../gemini.service.js";
import { safeJsonParse } from "../../utils/safeJson.js";

export async function generateMarketPrompts(industry = "AI SEO") {

  const prompt = `
You are generating real-world user search questions.

Generate 10 neutral search prompts users might ask
about the industry: ${industry}

Rules:
- Do NOT include any brand names
- Do NOT include company names
- Focus on user problems and solutions
- Focus on tools, comparisons, strategies

Return ONLY JSON.

Format:
[
  { "prompt": "", "intent": "" }
]
`;

  try {
    const raw = await runGemini(prompt, { temperature: 0.4 });
    const parsed = safeJsonParse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed;

  } catch (err) {
    console.error("Market prompt generation failed:", err.message);
    return [];
  }
}