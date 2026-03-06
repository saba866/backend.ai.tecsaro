// import { runGemini } from "../gemini.service.js";
// import { safeJsonParse } from "../../utils/safeJson.js";

// export async function generatePrompts(topics) {
//   if (!topics || topics.length === 0) return [];

//   const limitedTopics = topics.slice(0, 30); // limit input

//   const prompt = `
// Generate 5 high-quality user search prompts
// based on the following topics.

// Return ONLY valid JSON.
// Do not explain.
// Do not wrap in markdown.

// Format:
// [
//   { "prompt": "", "intent": "" }
// ]

// Topics:
// ${limitedTopics.join("\n")}
// `;

//   try {
//     const aiResponse = await runGemini(prompt, { temperature: 0.2 });

//     console.log("🧠 AI RAW RESPONSE:\n", aiResponse);

//     const parsed = safeJsonParse(aiResponse);

//     if (!Array.isArray(parsed)) {
//       console.log("Prompt parsing failed");
//       return [];
//     }

//     return parsed;

//   } catch (err) {
//     console.error("Prompt generation error:", err.message);
//     return [];
//   }
// }




import { runGemini } from "../gemini.service.js";
import { safeJsonParse } from "../../utils/safeJson.js";

export async function generatePrompts(topics, brandName = "") {
  if (!topics || topics.length === 0) return [];

  const limitedTopics = topics.slice(0, 30);

  const prompt = `
You are generating real user search questions.

IMPORTANT RULES:
- NEVER include any brand names
- NEVER include company names
- NEVER include product names
- Prompts must be neutral and market-focused
- Prompts must reflect how users search in AI engines

Generate 8 realistic search prompts users would ask.

Return ONLY valid JSON.
Do not explain.
Do not wrap in markdown.

Format:
[
  { "prompt": "", "intent": "" }
]

Topics:
${limitedTopics.join("\n")}
`;

  try {
    const aiResponse = await runGemini(prompt, { temperature: 0.3 });

    console.log("🧠 AI RAW RESPONSE:\n", aiResponse);

    let parsed = safeJsonParse(aiResponse);

    if (!Array.isArray(parsed)) return [];

    /* =============================
       FINAL SAFETY FILTER
       remove any prompt containing brand
    ============================== */

    const brandLower = brandName.toLowerCase();

    parsed = parsed.filter(p => {
      if (!p?.prompt) return false;
      const text = p.prompt.toLowerCase();

      // block brand words
      if (brandLower && text.includes(brandLower)) return false;

      // block domains accidentally included
      if (text.includes(".com") || text.includes(".ai")) return false;

      return true;
    });

    return parsed.slice(0, 5);

  } catch (err) {
    console.error("Prompt generation error:", err.message);
    return [];
  }
}