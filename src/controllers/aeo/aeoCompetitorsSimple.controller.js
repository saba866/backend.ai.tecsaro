import { supabase } from "../../config/supabase.js";
import { runCompetitorDiscovery } from "../../jobs/aeoCompetitorDiscovery.job.js";
import { buildCompetitorSummary } from "../../jobs/aeoCompetitorSummary.job.js";
import apiResponse from "../../utils/apiResponse.js";

export const startCompetitorDiscovery = async (req, res) => {
  const { planId } = req.body;
  if (!planId) return apiResponse(res, 400, "planId required");

  // fire & forget
  setTimeout(() => {
    runCompetitorDiscovery(planId)
      .then(() => buildCompetitorSummary(planId))
      .catch(err => console.error("❌ Competitor discovery failed:", err));
  }, 0);

  return apiResponse(res, 200, "Competitor discovery started");
};

export const getCompetitorsSimple = async (req, res) => {
  const { planId } = req.query;
  if (!planId) return apiResponse(res, 400, "planId required");

  // Table: aeo_competitors (NOT aeo_competitor_domains)
  // Columns used:
  //   id, name, domain, confidence_score, approved, status, classification, source
  //
  // approved = true  → user has confirmed this competitor (tracked)
  // approved = false → suggested, waiting for user review
  // status = "ignored" → user dismissed it
  const { data, error } = await supabase
    .from("aeo_competitors")
    .select("id, name, domain, confidence_score, approved, status, classification, source")
    .eq("plan_id", planId)
    .neq("status", "ignored")              // exclude dismissed competitors
    .order("confidence_score", { ascending: false });

  if (error) {
    console.error("Competitor fetch failed:", error);
    return apiResponse(res, 500, "Failed to load competitors");
  }

  const rows = data ?? [];

  // Tracked = approved by user
  const competitors = rows
    .filter(c => c.approved === true)
    .map(c => ({
      id:               c.id,
      name:             c.name || domainToName(c.domain),
      domain:           c.domain,
      confidence_score: typeof c.confidence_score === "number" ? c.confidence_score : 0,
      status:           "tracked",
      classification:   c.classification ?? "direct",
      source:           c.source ?? "ai",
    }));

  // Suggested = not yet approved, not ignored
  const suggestions = rows
    .filter(c => c.approved !== true)
    .map(c => ({
      id:               c.id,
      name:             c.name || domainToName(c.domain),
      domain:           c.domain,
      confidence_score: typeof c.confidence_score === "number" ? c.confidence_score : 0,
      status:           "suggested",
      classification:   c.classification ?? "direct",
      source:           c.source ?? "ai",
    }));

  return apiResponse(res, 200, "Competitors loaded", { competitors, suggestions });
};

// ── Approve a competitor (user clicks "Add" in dashboard) ─────────────────
export const approveCompetitor = async (req, res) => {
  const { id }    = req.params;
  const { planId } = req.body;
  if (!id || !planId) return apiResponse(res, 400, "id and planId required");

  const { error } = await supabase
    .from("aeo_competitors")
    .update({ approved: true, status: "active" })
    .eq("id", id)
    .eq("plan_id", planId);

  if (error) {
    console.error("Approve competitor failed:", error);
    return apiResponse(res, 500, "Failed to approve competitor");
  }

  return apiResponse(res, 200, "Competitor approved");
};

// ── Ignore a competitor (user clicks "Dismiss") ───────────────────────────
export const ignoreCompetitor = async (req, res) => {
  const { id }    = req.params;
  const { planId } = req.body;
  if (!id || !planId) return apiResponse(res, 400, "id and planId required");

  const { error } = await supabase
    .from("aeo_competitors")
    .update({ status: "ignored", ignored_at: new Date().toISOString() })
    .eq("id", id)
    .eq("plan_id", planId);

  if (error) {
    console.error("Ignore competitor failed:", error);
    return apiResponse(res, 500, "Failed to ignore competitor");
  }

  return apiResponse(res, 200, "Competitor ignored");
};

// ── Helpers ────────────────────────────────────────────────────────────────
function domainToName(domain = "") {
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase()) || domain;
}