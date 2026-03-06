// import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// export async function runGemini(prompt, options = {}) {
//   const model = genAI.getGenerativeModel({
//     model: "gemini-2.5-flash" // use pro since you have credits
//   });

//   const result = await model.generateContent({
//     contents: [
//       {
//         role: "user",
//         parts: [{ text: prompt }]
//       }
//     ],
//     generationConfig: {
//       temperature: options.temperature ?? 0.2,
//       maxOutputTokens: 2048,  // IMPORTANT
//       responseMimeType: "application/json" // force JSON
//     }
//   });

//   return result.response.text();
// }




// import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// export async function runGemini(prompt, options = {}) {
//   const model = genAI.getGenerativeModel({
//     model: "gemini-2.5-pro"  // 👈 remove the leading whitespace/tab
//   });

//   const result = await model.generateContent({
//     contents: [{ role: "user", parts: [{ text: prompt }] }],
//     generationConfig: {
//       temperature: options.temperature ?? 0.2,
//       maxOutputTokens: options.maxTokens ?? 8192,  // 👈 was 2048
//       responseMimeType: "application/json"
//     }
//   });

//   return result.response.text();
// }


import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────
// MODEL STRATEGY
//
// primary   → gemini-2.0-flash  (fast, reliable, rarely 503s)
// fallback  → gemini-1.5-flash  (most stable for structured output)
// pro tier  → gemini-2.5-pro    (best quality, only when needed)
//
// Never use 2.5-pro as primary — too many 503s under load
// ─────────────────────────────────────────
const MODELS = {
  primary:  "gemini-2.5-flash",
  fallback: "gemini-2.5-flash",
  pro:      "gemini-2.5-pro",
};

// ─────────────────────────────────────────
// CLEAN RAW GEMINI OUTPUT
// Strips markdown fences, leading/trailing text
// Extracts first valid JSON object or array
// ─────────────────────────────────────────
function cleanGeminiOutput(raw) {
  if (!raw) return null;

  let cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  // Try parsing cleaned string directly
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {}

  // Extract first JSON object
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      JSON.parse(objMatch[0]);
      return objMatch[0];
    } catch {}
  }

  // Extract first JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      JSON.parse(arrMatch[0]);
      return arrMatch[0];
    } catch {}
  }

  // Last resort — try to fix truncated JSON by closing open brackets
  const salvaged = salvageTruncated(cleaned);
  if (salvaged) return salvaged;

  return null;
}

// ─────────────────────────────────────────
// SALVAGE TRUNCATED JSON
// Gemini sometimes cuts off mid-response
// This closes open brackets to make it parseable
// ─────────────────────────────────────────
function salvageTruncated(raw) {
  try {
    const stack = [];
    let inString = false;
    let escape   = false;

    for (const ch of raw) {
      if (escape)          { escape = false; continue; }
      if (ch === "\\")     { escape = true;  continue; }
      if (ch === '"')      { inString = !inString; continue; }
      if (inString)        continue;
      if (ch === "{" || ch === "[") stack.push(ch);
      if (ch === "}" || ch === "]") stack.pop();
    }

    // Close all unclosed brackets in reverse
    let fixed = raw.trimEnd();
    for (let i = stack.length - 1; i >= 0; i--) {
      fixed += stack[i] === "{" ? "}" : "]";
    }

    JSON.parse(fixed);
    return fixed;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// CALL SINGLE MODEL
// Returns cleaned JSON string or throws
// ─────────────────────────────────────────
async function callModel(modelName, prompt, options = {}) {
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature:      options.temperature      ?? 0.2,
      maxOutputTokens:  options.maxOutputTokens  ?? 8192,
      responseMimeType: "application/json",
    },
  });

  const raw = result.response.text();
  return cleanGeminiOutput(raw);
}

// ─────────────────────────────────────────
// SLEEP HELPER FOR RETRY DELAYS
// ─────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────
// MAIN EXPORT: runGemini
//
// Options:
//   temperature      → 0.0 - 1.0 (default 0.2)
//   maxOutputTokens  → max tokens (default 8192)
//   tier             → "starter" | "pro" (default "starter")
//   retries          → number of retries (default 2)
//   jsonOnly         → return parsed object instead of string (default false)
//
// Usage:
//   const raw    = await runGemini(prompt)
//   const parsed = await runGemini(prompt, { jsonOnly: true })
// ─────────────────────────────────────────
export async function runGemini(prompt, options = {}) {
  const {
    tier            = "starter",
    retries         = 2,
    jsonOnly        = false,
    temperature     = 0.2,
    maxOutputTokens = 8192,
  } = options;

  // Pro tier gets 2.5-pro as primary, others get 2.0-flash
  const primary  = tier === "pro" ? MODELS.pro     : MODELS.primary;
  const fallback =                                   MODELS.fallback;

  const modelQueue = primary === fallback
    ? [primary]
    : [primary, fallback];

  let lastError = null;

  for (const modelName of modelQueue) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = attempt * 1500; // 1.5s, 3s backoff
          console.log(`⏳ Retry ${attempt}/${retries} for ${modelName} (wait ${delay}ms)`);
          await sleep(delay);
        }

        const cleaned = await callModel(modelName, prompt, { temperature, maxOutputTokens });

        if (!cleaned) {
          throw new Error("Empty or unparseable response");
        }

        if (jsonOnly) {
          return JSON.parse(cleaned);
        }

        return cleaned;

      } catch (err) {
        lastError = err;

        const is503      = err.message?.includes("503");
        const isOverload = err.message?.includes("overloaded") || err.message?.includes("high demand");
        const isRetryable = is503 || isOverload;

        if (isRetryable) {
          console.warn(`⚠️  ${modelName} overloaded (attempt ${attempt + 1}) — ${err.message?.slice(0, 80)}`);
          // Continue to next retry
          continue;
        }

        // Non-retryable error — break to next model immediately
        console.warn(`⚠️  ${modelName} failed (non-retryable): ${err.message?.slice(0, 120)}`);
        break;
      }
    }

    // If primary failed, try fallback
    if (modelName !== fallback) {
      console.warn(`🔄 Switching from ${modelName} → ${fallback}`);
    }
  }

  // All models exhausted
  console.error(`❌ All Gemini models failed. Last error: ${lastError?.message}`);
  throw lastError || new Error("Gemini: all models failed");
}

// ─────────────────────────────────────────
// CONVENIENCE: runGeminiJSON
// Always returns parsed object — throws if fails
// ─────────────────────────────────────────
export async function runGeminiJSON(prompt, options = {}) {
  return runGemini(prompt, { ...options, jsonOnly: true });
}