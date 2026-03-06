// import { runGemini } from "./gemini.js";

// export async function askAI(prompt) {
//   const result = await runGemini(prompt);
//   if (!result) return null;
//   return typeof result === "string" ? result : JSON.stringify(result);
// }


import { runGemini } from "./gemini.js";

// ─────────────────────────────────────────
// DEFAULT AI — GEMINI
// Used for: crawl understanding, mapping,
// answer generation, score, score explain
//
// For visibility tracking → use askOpenAI + askPerplexity directly
// For prompt generation   → use askOpenAI directly
// ─────────────────────────────────────────
export async function askAI(prompt, options = {}) {
  const result = await runGemini(prompt, options);
  if (!result) return null;
  return typeof result === "string" ? result : JSON.stringify(result);
}