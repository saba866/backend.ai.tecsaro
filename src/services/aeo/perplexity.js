


// ─────────────────────────────────────────
// PERPLEXITY SERVICE
// ─────────────────────────────────────────

import { wrapWithCitationRequest, parseCitationsFromAnswer } from "../../utils/citationParser.js"

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"

// ─────────────────────────────────────────
// ASK PERPLEXITY — plain text + citations
// Returns { answer, citations }
// Priority: use native data.citations if
// available, otherwise parse from text
// ─────────────────────────────────────────
export async function askPerplexity(prompt, { max_tokens = 400, temperature = 0.2, withCitations = false } = {}) {
  try {
    const finalPrompt = withCitations ? wrapWithCitationRequest(prompt) : prompt

    const response = await fetch(PERPLEXITY_API_URL, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:       "sonar",
        max_tokens,
        temperature,
        messages: [
          {
            role:    "system",
            content: "You are a helpful AI assistant. Answer clearly, mentioning relevant tools, platforms, and brands by name.",
          },
          {
            role:    "user",
            content: finalPrompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      console.error(`❌ [Perplexity] HTTP ${response.status}:`, errText)
      return { answer: null, citations: [] }
    }

    const data    = await response.json()
    const rawText = data.choices?.[0]?.message?.content || null

    if (!rawText) return { answer: null, citations: [] }

    // Perplexity natively returns citations array — use it if present
    if (Array.isArray(data.citations) && data.citations.length > 0) {
      return { answer: rawText, citations: data.citations }
    }

    // Fallback: parse SOURCES: from text if withCitations was requested
    if (withCitations) {
      return parseCitationsFromAnswer(rawText)
    }

    return { answer: rawText, citations: [] }

  } catch (err) {
    console.error("❌ [Perplexity] Request failed:", err.message)
    return { answer: null, citations: [] }
  }
}

// ─────────────────────────────────────────
// ASK PERPLEXITY JSON — JSON object mode
// ─────────────────────────────────────────
export async function askPerplexityJSON(prompt, { max_tokens = 4000 } = {}) {
  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:       "sonar",
        max_tokens,
        temperature: 0,
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
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      console.error(`❌ [Perplexity JSON] HTTP ${response.status}:`, errText)
      return null
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || null

  } catch (err) {
    console.error("❌ [Perplexity JSON] Request failed:", err.message)
    return null
  }
}

// ─────────────────────────────────────────
// ASK PERPLEXITY ARRAY
// ─────────────────────────────────────────
export async function askPerplexityArray(prompt, { max_tokens = 4000 } = {}) {
  const wrappedPrompt = `${prompt}

CRITICAL: You must return a JSON object with a single key "prompts" containing the array.
Example format: { "prompts": [ {...}, {...} ] }`

  const raw = await askPerplexityJSON(wrappedPrompt, { max_tokens })
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.prompts)) return parsed.prompts
    if (Array.isArray(parsed))          return parsed
  } catch {}

  return salvageJsonArray(raw)
}

// ─────────────────────────────────────────
// SALVAGE JSON ARRAY
// ─────────────────────────────────────────
export function salvageJsonArray(raw) {
  if (!raw) return null
  try {
    let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "")
    const start = cleaned.indexOf("[")
    if (start === -1) return null
    cleaned = cleaned.slice(start)
    const end = cleaned.lastIndexOf("]")
    if (end !== -1) cleaned = cleaned.slice(0, end + 1)
    const lastBrace = cleaned.lastIndexOf("}")
    if (lastBrace !== -1 && !cleaned.trim().endsWith("]")) {
      cleaned = cleaned.slice(0, lastBrace + 1) + "]"
    }
    const result = JSON.parse(cleaned)
    if (Array.isArray(result)) return result
  } catch { return null }
  return null
}