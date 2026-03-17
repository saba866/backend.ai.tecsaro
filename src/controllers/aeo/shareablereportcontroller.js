import { supabase }  from "../../config/supabase.js"
import apiResponse   from "../../utils/apiResponse.js"
import crypto        from "crypto"

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ai.tecsaro.com"

// ─────────────────────────────────────────
// GENERATE random URL-safe token
// ─────────────────────────────────────────
function generateToken() {
  return crypto.randomBytes(16).toString("hex")
}

// ─────────────────────────────────────────
// POST /reports/share
// Generate or return existing shareable link
// ─────────────────────────────────────────
export const generateShareableReport = async (req, res) => {
  const userId = req.user?.id
  const { planId, label } = req.body

  if (!planId) return apiResponse(res, 400, "planId required")

  try {
    // Verify plan belongs to user
    const { data: plan } = await supabase
      .from("plans")
      .select("id, name")
      .eq("id", planId)
      .eq("user_id", userId)
      .single()

    if (!plan) return apiResponse(res, 404, "Plan not found")

    // Check if active report already exists
    const { data: existing } = await supabase
      .from("shareable_reports")
      .select("id, token, is_active")
      .eq("plan_id", planId)
      .eq("is_active", true)
      .maybeSingle()

    if (existing) {
      return res.json({
        success: true,
        data: {
          token:      existing.token,
          url:        `${APP_URL}/report/${existing.token}`,
          is_new:     false,
        },
      })
    }

    // Create new token
    const token = generateToken()

    const { data, error } = await supabase
      .from("shareable_reports")
      .insert({ plan_id: planId, token, label: label ?? null })
      .select("id, token")
      .single()

    if (error) {
      console.error("[generateShareableReport] DB error:", error.message)
      return apiResponse(res, 500, "Failed to generate report link")
    }

    return res.json({
      success: true,
      data: {
        token:  data.token,
        url:    `${APP_URL}/report/${data.token}`,
        is_new: true,
      },
    })

  } catch (err) {
    console.error("[generateShareableReport] error:", err.message)
    return apiResponse(res, 500, "Internal server error")
  }
}

// ─────────────────────────────────────────
// GET /reports/share/:planId
// Get current share status for a plan
// ─────────────────────────────────────────
export const getShareStatus = async (req, res) => {
  const userId  = req.user?.id
  const { planId } = req.params

  if (!planId) return apiResponse(res, 400, "planId required")

  try {
    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("id", planId)
      .eq("user_id", userId)
      .single()

    if (!plan) return apiResponse(res, 404, "Plan not found")

    const { data } = await supabase
      .from("shareable_reports")
      .select("id, token, is_active, views, created_at, last_viewed, label")
      .eq("plan_id", planId)
      .eq("is_active", true)
      .maybeSingle()

    if (!data) {
      return res.json({ success: true, data: null })
    }

    return res.json({
      success: true,
      data: {
        token:       data.token,
        url:         `${APP_URL}/report/${data.token}`,
        is_active:   data.is_active,
        views:       data.views,
        label:       data.label,
        created_at:  data.created_at,
        last_viewed: data.last_viewed,
      },
    })

  } catch (err) {
    console.error("[getShareStatus] error:", err.message)
    return apiResponse(res, 500, "Internal server error")
  }
}

// ─────────────────────────────────────────
// DELETE /reports/share/:planId
// Revoke shareable link
// ─────────────────────────────────────────
export const revokeShareableReport = async (req, res) => {
  const userId     = req.user?.id
  const { planId } = req.params

  if (!planId) return apiResponse(res, 400, "planId required")

  try {
    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("id", planId)
      .eq("user_id", userId)
      .single()

    if (!plan) return apiResponse(res, 404, "Plan not found")

    await supabase
      .from("shareable_reports")
      .update({ is_active: false })
      .eq("plan_id", planId)
      .eq("is_active", true)

    return res.json({ success: true, message: "Report link revoked" })

  } catch (err) {
    console.error("[revokeShareableReport] error:", err.message)
    return apiResponse(res, 500, "Internal server error")
  }
}

// ─────────────────────────────────────────
// GET /report/public/:token
// Public endpoint — no auth required
// Returns report data for the token
// ─────────────────────────────────────────
export const getPublicReport = async (req, res) => {
  const { token } = req.params

  if (!token) return apiResponse(res, 400, "Token required")

  try {
    // Find report by token
    const { data: report } = await supabase
      .from("shareable_reports")
      .select("id, plan_id, is_active, label")
      .eq("token", token)
      .maybeSingle()

    if (!report)           return apiResponse(res, 404, "Report not found")
    if (!report.is_active) return apiResponse(res, 410, "This report link has been revoked")

    const planId = report.plan_id

    // ── Increment view counter ──
   const { data: currentReport } = await supabase
  .from("shareable_reports")
  .select("views")
  .eq("id", report.id)
  .single()

await supabase
  .from("shareable_reports")
  .update({
    views:       (currentReport?.views ?? 0) + 1,
    last_viewed: new Date().toISOString(),
  })
  .eq("id", report.id)
    // ── Fetch all report data in parallel ──
    const [
      { data: plan        },
      { data: brand       },
      { data: score       },
      { data: competitors },
      { data: mentions    },
      { data: explanation },
    ] = await Promise.all([
      supabase.from("plans").select("name, website_url, tier").eq("id", planId).single(),
      supabase.from("aeo_brand_profile").select("brand_name, domain").eq("plan_id", planId).maybeSingle(),
      supabase.from("aeo_scores").select("score, breakdown, created_at").eq("plan_id", planId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("aeo_competitors").select("name, domain").eq("plan_id", planId).eq("status", "active").eq("approved", true).limit(10),
      supabase.from("aeo_mention_results").select("entity_name, entity_type, mentioned, position, engine").eq("plan_id", planId).eq("mentioned", true).order("created_at", { ascending: false }).limit(50),
      supabase.from("aeo_score_explanations").select("headline, explanation, recommendations, what_is_working, improvements, top_issues").eq("plan_id", planId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ])

    // ── Build response ──
    const breakdown    = score?.breakdown ?? {}
    const wins         = breakdown.wins         ?? 0
    const losses       = breakdown.losses       ?? 0
    const shared       = breakdown.shared       ?? 0
    const missed       = breakdown.missed       ?? 0
    const presenceRate = breakdown.brandPresenceRate ?? 0

    // Top competitors from mention results
   const competitorMentions = {}
    for (const m of (mentions || [])) {
      if (m.entity_type === "competitor") {
        competitorMentions[m.entity_name] = (competitorMentions[m.entity_name] || 0) + 1
      }
    }
    const topCompetitors = Object.entries(competitorMentions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    return res.json({
      success: true,
      data: {
        report_label:  report.label,
        brand_name:    brand?.brand_name ?? plan?.name ?? "Brand",
        domain:        brand?.domain     ?? plan?.website_url ?? "",
        tier:          plan?.tier        ?? "starter",
        generated_at:  new Date().toISOString(),

        score: {
          value:         score?.score      ?? 0,
          date:          score?.created_at ?? null,
          wins,
          losses,
          shared,
          missed,
          presence_rate: Math.round(presenceRate * 100),
        },

        explanation: explanation
          ? {
              headline:        explanation.headline,
              summary:         explanation.explanation,
              what_is_working: explanation.what_is_working,
              improvements:    explanation.improvements,
              top_issues:      explanation.top_issues,
              recommendations: explanation.recommendations,
            }
          : null,

        top_competitors: topCompetitors,

        competitors: (competitors || []).map((c) => ({
          name:   c.name,
          domain: c.domain,
        })),
      },
    })

  } catch (err) {
    console.error("[getPublicReport] error:", err.message)
    return apiResponse(res, 500, "Internal server error")
  }
}