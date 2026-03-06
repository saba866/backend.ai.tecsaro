// import { askAI } from "./index.js";

// export async function generateGapSuggestion(prompt) {
//   const aiPrompt = `
// You are an AEO content strategist.

// A competitor answers this question but the site does not.

// Question:
// "${prompt}"

// Return a short actionable suggestion explaining
// what content should be created to answer this.

// Return ONLY plain text.
// `;

//   return await askAI(aiPrompt);
// }




import { askAI } from "./index.js";
import { safeJsonParse } from "../../utils/aiJson.js";

// ─────────────────────────────────────────
// GENERATE GAP SUGGESTION
// Called per-gap during gap analysis.
// Returns structured suggestion with specific
// content actions, not just a vague message.
// ─────────────────────────────────────────
export async function generateGapSuggestion(prompt, context = {}) {
  const {
    brandName     = "your brand",
    topCompetitor = null,
    pattern       = "missed",   // missed | losing | competing | winning
    industry      = null,
  } = context;

  const competitor = topCompetitor || "competitors";

  const patternContext = {
    missed:    `No brand is winning this query — it's an open opportunity.`,
    losing:    `${competitor} is winning this query. Your brand is not appearing.`,
    competing: `Your brand appears but ranks below ${competitor}.`,
    winning:   `Your brand is winning this query — reinforce and expand.`,
  };

  const aiPrompt = `
You are an AEO (Answer Engine Optimization) content strategist.

A brand needs to improve their visibility for this AI search query:
"${prompt}"

SITUATION: ${patternContext[pattern] || patternContext.missed}
${industry ? `INDUSTRY: ${industry}` : ""}

Write one specific, actionable content suggestion explaining:
1. What type of content to create (page, blog post, comparison, FAQ, case study)
2. The exact page title or content angle to use
3. What to include (specific sections, word count, schema type)

RULES:
- Be specific — exact titles, exact schema types, exact word counts
- Do NOT say "create content" without saying what content exactly
- Do NOT mention the brand name — say "your brand"
- Keep under 80 words
- Plain text only, no bullet points, no markdown

Return ONLY the suggestion text.
`;

  try {
    const result = await askAI(aiPrompt, { max_tokens: 150 });
    return result?.trim() || fallbackSuggestion(prompt, pattern, competitor);
  } catch (err) {
    console.warn("⚠️  generateGapSuggestion AI failed:", err.message);
    return fallbackSuggestion(prompt, pattern, competitor);
  }
}

// ─────────────────────────────────────────
// GENERATE BULK SUGGESTIONS FOR MULTIPLE GAPS
// More efficient than calling one-by-one.
// Batches up to 5 gaps in a single AI call.
// ─────────────────────────────────────────
export async function generateBulkGapSuggestions(gaps, brandName = "your brand") {
  if (!gaps?.length) return {};

  // Batch into groups of 5
  const BATCH_SIZE = 5;
  const results = {};

  for (let i = 0; i < gaps.length; i += BATCH_SIZE) {
    const batch = gaps.slice(i, i + BATCH_SIZE);

    const gapList = batch
      .map((g, idx) => {
        const competitors = Array.isArray(g.competitor_positions)
          ? g.competitor_positions.map((c) => c.name).join(", ")
          : "none";
        const reasons = Array.isArray(g.gap_reasons) ? g.gap_reasons.join(", ") : "unknown";
        return `${idx + 1}. Query: "${g.prompt}" | Competitors winning: ${competitors} | Reasons: ${reasons}`;
      })
      .join("\n");

    const aiPrompt = `
You are an AEO content strategist helping "${brandName}" improve AI search visibility.

For each query below, write one specific, actionable content suggestion (max 60 words each).
Be specific — exact page titles, schema types, word counts.
Do NOT use the brand name — say "your brand".
Plain text only per suggestion.

QUERIES:
${gapList}

Return ONLY valid JSON — an object mapping query number to suggestion string:
{
  "1": "suggestion text for query 1",
  "2": "suggestion text for query 2"
}
`;

    try {
      const raw = await askAI(aiPrompt, { max_tokens: 600 });
      const parsed = safeJsonParse(raw);

      if (parsed && typeof parsed === "object") {
        batch.forEach((gap, idx) => {
          const suggestion = parsed[String(idx + 1)];
          if (suggestion && typeof suggestion === "string") {
            results[gap.id] = suggestion.trim();
          } else {
            results[gap.id] = fallbackSuggestion(gap.prompt, "missed", "competitors");
          }
        });
      } else {
        // Fallback all in batch
        batch.forEach((gap) => {
          results[gap.id] = fallbackSuggestion(gap.prompt, "missed", "competitors");
        });
      }
    } catch (err) {
      console.warn(`⚠️  Bulk suggestion batch ${i / BATCH_SIZE + 1} failed:`, err.message);
      batch.forEach((gap) => {
        results[gap.id] = fallbackSuggestion(gap.prompt, "missed", "competitors");
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────
// FALLBACK SUGGESTION
// Used when AI call fails.
// Still more specific than the old generic message.
// ─────────────────────────────────────────
function fallbackSuggestion(prompt, pattern, competitor) {
  const map = {
    missed: `Create a dedicated page directly answering "${prompt}" — minimum 800 words, include your brand in the first paragraph, add schema markup for your product category, and submit to relevant directories for this use case.`,
    losing: `Create a comparison page "Your Brand vs ${competitor}" targeting "${prompt}" — minimum 1000 words with a clear verdict. Also add your brand's core topic to your homepage H1 to strengthen the category signal for AI engines.`,
    competing: `Strengthen authority for "${prompt}" by adding customer testimonials for this use case to your homepage, getting mentioned in 5 relevant comparison articles, and sharpening your positioning to claim a specific niche angle.`,
    winning: `Keep content fresh for "${prompt}" — update quarterly, add FAQ schema answering common questions for this use case, and expand to adjacent query variations by adding audience or use-case specificity.`,
  };
  return map[pattern] || map.missed;
}