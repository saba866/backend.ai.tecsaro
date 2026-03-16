import { supabase }  from "../../config/supabase.js"
import apiResponse   from "../../utils/apiResponse.js"


// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function hasSchema(html) {
  if (!html) return false
  return html.includes('application/ld+json') || html.includes('itemtype=')
}

function hasCanonical(html) {
  if (!html) return false
  return html.includes('rel="canonical"') || html.includes("rel='canonical'")
}

function countImages(html) {
  if (!html) return { total: 0, missingAlt: 0 }
  const imgMatches  = html.match(/<img[^>]*>/gi) || []
  const missingAlt  = imgMatches.filter(tag => !tag.includes('alt=') || tag.includes('alt=""') || tag.includes("alt=''")).length
  return { total: imgMatches.length, missingAlt }
}

function auditPage(page) {
  const issues = []
  const imgs   = countImages(page.html)

  // ── Critical issues ──
  if (!page.title?.trim()) {
    issues.push({ type: "missing_title", severity: "critical", message: "Missing page title", fix: "Add a descriptive <title> tag. AI engines use this to understand your page topic." })
  } else if (page.title.length < 30) {
    issues.push({ type: "short_title", severity: "warning", message: `Title too short (${page.title.length} chars)`, fix: "Expand title to 50–60 characters for better AI and SEO visibility." })
  } else if (page.title.length > 70) {
    issues.push({ type: "long_title", severity: "warning", message: `Title too long (${page.title.length} chars)`, fix: "Keep title under 70 characters to avoid truncation." })
  }

  if (!page.meta_description?.trim() && !page.description?.trim()) {
    issues.push({ type: "missing_meta_description", severity: "critical", message: "Missing meta description", fix: "Add a meta description (120–160 chars). AI engines use this to understand page context." })
  } else {
    const desc = page.meta_description || page.description || ""
    if (desc.length < 50) {
      issues.push({ type: "short_meta_description", severity: "warning", message: `Meta description too short (${desc.length} chars)`, fix: "Expand to 120–160 characters with relevant keywords." })
    }
  }

  if (!page.h1?.trim()) {
    issues.push({ type: "missing_h1", severity: "critical", message: "Missing H1 heading", fix: "Add an H1 tag that clearly states the page topic. Critical for AI engine understanding." })
  }

  if (!hasSchema(page.html)) {
    issues.push({ type: "missing_schema", severity: "critical", message: "Missing structured data (schema markup)", fix: "Add JSON-LD schema markup. AI engines rely on this to understand your brand and content." })
  }

  // ── Warnings ──
  if (!hasCanonical(page.html)) {
    issues.push({ type: "missing_canonical", severity: "warning", message: "Missing canonical tag", fix: "Add <link rel='canonical'> to prevent duplicate content issues." })
  }

  if (imgs.missingAlt > 0) {
    issues.push({ type: "missing_alt_text", severity: "warning", message: `${imgs.missingAlt} image${imgs.missingAlt > 1 ? "s" : ""} missing alt text`, fix: "Add descriptive alt text to all images. AI engines use this for context." })
  }

  const wordCount = page.word_count ?? 0
  if (wordCount < 100 && wordCount > 0) {
    issues.push({ type: "thin_content", severity: "critical", message: `Very thin content (${wordCount} words)`, fix: "Add more content. Pages under 100 words are rarely cited by AI engines." })
  } else if (wordCount < 300 && wordCount > 0) {
    issues.push({ type: "low_word_count", severity: "warning", message: `Low word count (${wordCount} words)`, fix: "Expand to 300+ words. AI engines prefer comprehensive content." })
  }

  // ── Info ──
  if (page.ai_improvements && Array.isArray(page.ai_improvements) && page.ai_improvements.length > 0) {
    issues.push({ type: "ai_improvements_available", severity: "info", message: `${page.ai_improvements.length} AI improvement suggestion${page.ai_improvements.length > 1 ? "s" : ""} available`, fix: "Review AI-generated content suggestions for this page." })
  }

  return issues
}

function scoreIssues(issues) {
  let deductions = 0
  for (const issue of issues) {
    if (issue.severity === "critical") deductions += 20
    if (issue.severity === "warning")  deductions += 8
    if (issue.severity === "info")     deductions += 0
  }
  return Math.max(0, 100 - deductions)
}

// ─────────────────────────────────────────
// GET /aeo/technical-audit/:planId
// Returns full technical audit for all pages
// ─────────────────────────────────────────
export const getTechnicalAudit = async (req, res) => {
  const { planId } = req.params
  const userId     = req.user?.id

  if (!planId) return apiResponse(res, 400, "planId required")

  try {
    // Verify plan belongs to user
    const { data: plan } = await supabase
      .from("plans")
      .select("id, tier, name")
      .eq("id", planId)
      .eq("user_id", userId)
      .single()

    if (!plan) return apiResponse(res, 404, "Plan not found")

    // Fetch all crawled pages for this plan
    const { data: pages, error } = await supabase
      .from("aeo_pages")
      .select("id, url, title, meta_description, description, h1, html, word_count, ai_improvements, crawled_at")
      .eq("plan_id", planId)
      .eq("status", "crawled")
      .order("crawled_at", { ascending: false })

    if (error) {
      console.error("[getTechnicalAudit] DB error:", error.message)
      return apiResponse(res, 500, "Failed to load pages")
    }

    if (!pages?.length) {
      return res.json({
        success: true,
        data: {
          total_pages:    0,
          health_score:   0,
          critical_count: 0,
          warning_count:  0,
          pages:          [],
          summary:        [],
          message:        "No crawled pages found. Run the pipeline to crawl your website.",
        },
      })
    }

    // ── Audit each page ──
    const auditedPages = pages.map(page => {
      const issues     = auditPage(page)
      const pageScore  = scoreIssues(issues)
      const criticals  = issues.filter(i => i.severity === "critical").length
      const warnings   = issues.filter(i => i.severity === "warning").length

      return {
        id:          page.id,
        url:         page.url,
        title:       page.title || null,
        h1:          page.h1    || null,
        word_count:  page.word_count ?? 0,
        score:       pageScore,
        issues,
        critical_count: criticals,
        warning_count:  warnings,
        status:      criticals > 0 ? "critical" : warnings > 0 ? "warning" : "healthy",
        crawled_at:  page.crawled_at,
      }
    })

    // ── Overall stats ──
    const totalPages    = auditedPages.length
    const healthScore   = Math.round(auditedPages.reduce((sum, p) => sum + p.score, 0) / totalPages)
    const criticalCount = auditedPages.reduce((sum, p) => sum + p.critical_count, 0)
    const warningCount  = auditedPages.reduce((sum, p) => sum + p.warning_count, 0)

    // ── Issue summary (most common issues) ──
    const issueFreq = {}
    for (const page of auditedPages) {
      for (const issue of page.issues) {
        if (!issueFreq[issue.type]) {
          issueFreq[issue.type] = { ...issue, count: 0 }
        }
        issueFreq[issue.type].count++
      }
    }

    const summary = Object.values(issueFreq)
      .sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 }
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity]
        }
        return b.count - a.count
      })
      .slice(0, 10)
      .map(i => ({
        type:     i.type,
        severity: i.severity,
        message:  i.message,
        fix:      i.fix,
        count:    i.count,
        pct:      Math.round((i.count / totalPages) * 100),
      }))

    // For free plan — limit pages returned, show teaser
    const isFree         = plan.tier === "free"
    const returnedPages  = isFree ? auditedPages.slice(0, 3) : auditedPages

    return res.json({
      success: true,
      data: {
        total_pages:    totalPages,
        health_score:   healthScore,
        critical_count: criticalCount,
        warning_count:  warningCount,
        pages:          returnedPages,
        summary,
        is_limited:     isFree && totalPages > 3,
        tier:           plan.tier,
      },
    })

  } catch (err) {
    console.error("[getTechnicalAudit] error:", err.message)
    return apiResponse(res, 500, "Internal server error")
  }
}