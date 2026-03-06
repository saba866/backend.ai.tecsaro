


// ─────────────────────────────────────────
// aeoSchema.controller.js
// ─────────────────────────────────────────
import { startSchemaJob, getSchemasByPlan } from "../../services/aeo/aeoSchema.service.js";
import apiResponse from "../../utils/apiResponse.js";
import { supabase } from "../../config/supabase.js";

// POST /api/aeo/schema/generate
// Body: { planId }
export const generateSchemas = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return apiResponse(res, 400, "planId required");

    // Fire and forget — schema gen can take 30-60s for many pages
    startSchemaJob(planId).catch((err) => {
      console.error(`❌ Schema job failed for plan ${planId}:`, err.message);
    });

    return apiResponse(res, 200, "Schema generation started");
  } catch (err) {
    console.error("❌ generateSchemas error:", err.message);
    return apiResponse(res, 500, "Schema generation failed");
  }
};

// ─────────────────────────────────────────
// GET /api/aeo/schema/:planId
// Returns all schemas grouped by page
// ─────────────────────────────────────────
export const getSchemas = async (req, res) => {
  try {
    const { planId } = req.params;
    if (!planId) return apiResponse(res, 400, "planId required");

    // Load all schemas with their page info
    const { data: schemas, error } = await supabase
      .from("aeo_schemas")
      .select(`
        id,
        schema_type,
        schema_json,
        created_at,
        page_id,
        aeo_pages (
          id,
          url,
          title,
          status
        )
      `)
      .eq("plan_id", planId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!schemas?.length) {
      return res.json({ success: true, pages: [], total: 0 });
    }

    // Group by page
    const pageMap = new Map();

    for (const schema of schemas) {
      const page   = schema.aeo_pages;
      const pageId = schema.page_id;

      if (!pageMap.has(pageId)) {
        pageMap.set(pageId, {
          page_id:  pageId,
          url:      page?.url   ?? "",
          title:    page?.title ?? "Untitled",
          status:   page?.status ?? "ok",
          schemas:  [],
        });
      }

      pageMap.get(pageId).schemas.push({
        id:          schema.id,
        schema_type: schema.schema_type,
        schema_json: schema.schema_json,
        created_at:  schema.created_at,
      });
    }

    const grouped = Array.from(pageMap.values());

    // Compute stats
    const totalSchemas  = schemas.length;
    const totalPages    = grouped.length;
    const failedPages   = grouped.filter(p => p.status === "error" || p.status === "failed").length;
    const coveredPages  = totalPages - failedPages;

    // Collect unique schema types
    const schemaTypes   = [...new Set(schemas.map(s => s.schema_type).filter(Boolean))];

    return res.json({
      success:      true,
      pages:        grouped,
      total:        totalSchemas,
      total_pages:  totalPages,
      covered:      coveredPages,
      failed:       failedPages,
      schema_types: schemaTypes,
      coverage_pct: totalPages > 0 ? Math.round((coveredPages / totalPages) * 100) : 0,
    });
  } catch (err) {
    console.error("❌ getSchemas error:", err.message);
    return apiResponse(res, 500, "Failed to load schemas");
  }
};