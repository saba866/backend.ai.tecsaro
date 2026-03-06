import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────
// ASK OPENAI — JSON object mode
// Returns raw JSON string
// ─────────────────────────────────────────


export async function askOpenAI(prompt, { max_tokens = 4000 } = {}) {
  const response = await openai.chat.completions.create({
    model:           "gpt-4o",
    max_tokens,
    response_format: { type: "json_object" },
    temperature:     0.8,
    messages: [
      {
        role:    "system",
        content: "You are a helpful assistant. You must respond with ONLY a valid JSON object. No markdown, no code fences, no explanation. Start your response with { and end with }.",
      },
      {
        role:    "user",
        content: prompt,
      },
    ],
  });

  return response.choices[0]?.message?.content || null;
}

// ─────────────────────────────────────────
// ASK OPENAI ARRAY — wraps in { prompts: [] }
// OpenAI json_object mode requires object root
// Unwraps and returns the array
// ─────────────────────────────────────────
export async function askOpenAIArray(prompt, { max_tokens = 4000 } = {}) {
  const wrappedPrompt = `${prompt}

CRITICAL: You must return a JSON object with a single key "prompts" containing the array.
Example format: { "prompts": [ {...}, {...} ] }`;

  const raw = await askOpenAI(wrappedPrompt, { max_tokens });
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.prompts)) return parsed.prompts;
    if (Array.isArray(parsed))          return parsed;
  } catch {
    // fall through to salvage
  }

  return salvageJsonArray(raw);
}

// ─────────────────────────────────────────
// SALVAGE JSON ARRAY
// Strips fences, finds array boundaries,
// fixes truncated output
// ─────────────────────────────────────────
export function salvageJsonArray(raw) {
  if (!raw) return null;

  try {
    let cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "");

    const start = cleaned.indexOf("[");
    if (start === -1) return null;
    cleaned = cleaned.slice(start);

    const end = cleaned.lastIndexOf("]");
    if (end !== -1) cleaned = cleaned.slice(0, end + 1);

    // Fix truncated — trim to last complete object
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1 && !cleaned.trim().endsWith("]")) {
      cleaned = cleaned.slice(0, lastBrace + 1) + "]";
    }

    const result = JSON.parse(cleaned);
    if (Array.isArray(result)) return result;
  } catch {
    return null;
  }

  return null;
}