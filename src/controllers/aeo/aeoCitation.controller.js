
import { supabase }      from "../../config/supabase.js";
import apiResponse     from "../../utils/apiResponse.js"
import { extractDomain, isBrandInCitations } from "../../utils/citationParser.js"

// ─────────────────────────────────────────
// HELPER — verify plan belongs to user + is Pro
// ─────────────────────────────────────────
async function verifyProPlan(planId, userId) {
  const { data } = await supabase
    .from("plans")
    .select("tier")
    .eq("id", planId)
    .eq("user_id", userId)
    .single()
  return data?.tier === "pro"
}

// ─────────────────────────────────────────
// GET /aeo/citations/:planId
// Full citation summary — Pro only
//
// Response:
// {
//   citation_rate: 0.4,
//   total_runs:    30,        // total citation records
//   brand_cited:   12,        // runs where brand was a source
//   by_engine: {
//     chatgpt:    { total: 10, brand_cited: 4, rate: 0.4 },
//     gemini:     { total: 10, brand_cited: 3, rate: 0.3 },
//     perplexity: { total: 10, brand_cited: 5, rate: 0.5 },
//   },
//   top_sources: [
//     { domain: "semrush.com", count: 18, is_brand: false },
//     { domain: "tecsaro.com", count: 12, is_brand: true  },
//   ],
//   missing_sources: [
//     { domain: "g2.com", count: 14 },
//   ],
//   recent: [...],
// }
// ─────────────────────────────────────────
export const getCitations = async (req, res) => {
  const { planId } = req.params
  const userId     = req.user?.id

  if (!planId) return apiResponse(res, 400, "planId required")

  try {
    const isPro = await verifyProPlan(planId, userId)
    if (!isPro) {
      return apiResponse(res, 403, "AI Citation tracking is a Pro feature. Upgrade to access it.")
    }

    const { data: brand } = await supabase
      .from("aeo_brand_profile")
      .select("domain")
      .eq("plan_id", planId)
      .maybeSingle()

    const brandDomain = brand?.domain?.toLowerCase().replace(/^www\./, "") || null

    const { data: citations, error } = await supabase
      .from("aeo_citations")
      .select("id, prompt_text, engine, source_urls, brand_is_source, brand_position, created_at")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[getCitations] DB error:", error.message)
      return apiResponse(res, 500, "Failed to load citations")
    }

    if (!citations?.length) {
      return res.json({
        success: true,
        data: {
          citation_rate:   0,
          total_runs:      0,
          brand_cited:     0,
          by_engine:       {},
          top_sources:     [],
          missing_sources: [],
          recent:          [],
          message:         "No citation data yet. Run an AI audit to start tracking.",
        },
      })
    }

    const totalRuns  = citations.length
    const brandCited = citations.filter((c) => c.brand_is_source).length
    const citationRate = Math.round((brandCited / totalRuns) * 100) / 100

    // ── Per-engine breakdown ──
    const engines = ["chatgpt", "gemini", "perplexity"]
    const byEngine = {}
    for (const engine of engines) {
      const engineCitations = citations.filter((c) => c.engine === engine)
      const engineBrandCited = engineCitations.filter((c) => c.brand_is_source).length
      if (engineCitations.length > 0) {
        byEngine[engine] = {
          total:       engineCitations.length,
          brand_cited: engineBrandCited,
          rate:        Math.round((engineBrandCited / engineCitations.length) * 100) / 100,
        }
      }
    }

    // ── Build source frequency map ──
    const sourceMap = {}
    for (const citation of citations) {
      for (const url of (citation.source_urls || [])) {
        const domain = extractDomain(url)
        if (!domain || domain.length < 4) continue
        if (!sourceMap[domain]) {
          sourceMap[domain] = {
            domain,
            count:    0,
            is_brand: brandDomain
              ? domain.includes(brandDomain) || brandDomain.includes(domain)
              : false,
          }
        }
        sourceMap[domain].count++
      }
    }

    const allSources = Object.values(sourceMap).sort((a, b) => b.count - a.count)

    const topSources = allSources.slice(0, 10)

    // Sources cited often but brand is not one of them
    const missingSources = allSources
      .filter((s) => !s.is_brand && s.count >= 3)
      .slice(0, 5)

    // ── Recent 10 records ──
    const recent = citations.slice(0, 10).map((c) => ({
      id:              c.id,
      prompt:          c.prompt_text,
      engine:          c.engine,
      brand_is_source: c.brand_is_source,
      brand_position:  c.brand_position,
      source_count:    c.source_urls?.length || 0,
      sources:         (c.source_urls || []).slice(0, 5),
      created_at:      c.created_at,
    }))

    return res.json({
      success: true,
      data: {
        citation_rate:   citationRate,
        total_runs:      totalRuns,
        brand_cited:     brandCited,
        by_engine:       byEngine,
        top_sources:     topSources,
        missing_sources: missingSources,
        recent,
      },
    })

  } catch (err) {
    console.error("[getCitations] error:", err.message)
    return apiResponse(res, 500, "Internal server error")
  }
}

// ─────────────────────────────────────────
// GET /aeo/citations/:planId/sources
// Full source list — for sources table UI
// ─────────────────────────────────────────
export const getCitationSources = async (req, res) => {
  const { planId } = req.params
  const userId     = req.user?.id

  if (!planId) return apiResponse(res, 400, "planId required")

  try {
    const isPro = await verifyProPlan(planId, userId)
    if (!isPro) return apiResponse(res, 403, "AI Citation tracking is a Pro feature.")

    const { data: brand } = await supabase
      .from("aeo_brand_profile")
      .select("domain")
      .eq("plan_id", planId)
      .maybeSingle()

    const brandDomain = brand?.domain?.toLowerCase().replace(/^www\./, "") || null

    const { data: citations, error } = await supabase
      .from("aeo_citations")
      .select("source_urls, engine")
      .eq("plan_id", planId)

    if (error) return apiResponse(res, 500, "Failed to load citation sources")

    const sourceMap = {}
    for (const citation of (citations || [])) {
      for (const url of (citation.source_urls || [])) {
        const domain = extractDomain(url)
        if (!domain || domain.length < 4) continue
        if (!sourceMap[domain]) {
          sourceMap[domain] = {
            domain,
            count:    0,
            engines:  new Set(),
            urls:     new Set(),
            is_brand: brandDomain
              ? domain.includes(brandDomain) || brandDomain.includes(domain)
              : false,
          }
        }
        sourceMap[domain].count++
        sourceMap[domain].engines.add(citation.engine)
        sourceMap[domain].urls.add(url)
      }
    }

    const sources = Object.values(sourceMap)
      .map((s) => ({
        domain:   s.domain,
        count:    s.count,
        engines:  Array.from(s.engines),
        urls:     Array.from(s.urls).slice(0, 3),
        is_brand: s.is_brand,
      }))
      .sort((a, b) => b.count - a.count)

    return res.json({ success: true, data: sources })

  } catch (err) {
    console.error("[getCitationSources] error:", err.message)
    return apiResponse(res, 500, "Internal server error")
  }
}