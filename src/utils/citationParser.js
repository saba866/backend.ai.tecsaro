// ─────────────────────────────────────────
// src/utils/citationParser.js
//
// Shared citation utilities used by:
//   - services/aeo/perplexity.js
//   - jobs/aeoVisibility.job.js
//   - controllers/citationController.js
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// WRAP PROMPT WITH CITATION REQUEST
// Appends instruction to all 3 engines
// to list their sources after the answer
// ─────────────────────────────────────────
export function wrapWithCitationRequest(prompt) {
  return `${prompt}

After your answer, list the top 3-5 websites or sources that support your answer.
Format your sources exactly like this on a new line:
SOURCES: https://example.com, https://other.com, https://third.com`
}

// ─────────────────────────────────────────
// PARSE CITATIONS FROM ANSWER TEXT
// Splits answer text into { answer, citations }
// by finding the SOURCES: line
// ─────────────────────────────────────────
export function parseCitationsFromAnswer(rawText) {
  if (!rawText) return { answer: rawText, citations: [] }

  const lines    = rawText.split("\n")
  const srcIndex = lines.findIndex((l) => l.trim().toUpperCase().startsWith("SOURCES:"))

  if (srcIndex === -1) {
    return { answer: rawText.trim(), citations: [] }
  }

  // Everything before SOURCES: line is the answer
  const answer  = lines.slice(0, srcIndex).join("\n").trim()

  // Parse URLs from SOURCES: line
  const srcLine = lines[srcIndex].replace(/^SOURCES:\s*/i, "").trim()

  const citations = srcLine
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http") || u.includes("."))
    .map((u) => u.startsWith("http") ? u : `https://${u}`)
    .slice(0, 5)

  return { answer, citations }
}

// ─────────────────────────────────────────
// EXTRACT DOMAIN FROM URL
// Handles full URLs and bare domains
// ─────────────────────────────────────────
export function extractDomain(url) {
  if (!url) return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    // Bare domain fallback e.g. "example.com"
    return url.replace(/^www\./, "").split("/")[0].trim()
  }
}

// ─────────────────────────────────────────
// IS BRAND IN CITATIONS
// Checks if brand domain appears in any
// of the cited source URLs
// ─────────────────────────────────────────
export function isBrandInCitations(citations, brandDomain) {
  if (!brandDomain || !citations?.length) return false
  const domain = brandDomain.toLowerCase().replace(/^www\./, "")
  return citations.some((url) => {
    const citedDomain = extractDomain(url.toLowerCase())
    return citedDomain.includes(domain) || domain.includes(citedDomain)
  })
}