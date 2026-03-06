

import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";

export const getAeoOverview = async (req, res) => {
  try {
    const { planId } = req.query;
    if (!planId) return apiResponse(res, 400, "planId required");

    const [
      { data: pages },
      { data: prompts },
      { data: alerts },
      { data: visibilityRows },
    ] = await Promise.all([
      supabase.from("aeo_pages").select("id").eq("plan_id", planId),
      supabase.from("aeo_prompts").select("id,status").eq("plan_id", planId),
      supabase.from("aeo_alerts").select("id").eq("plan_id", planId),
      supabase
        .from("aeo_visibility")
        .select("score")
        .eq("plan_id", planId),
    ]);

    const safePages = pages ?? [];
    const safePrompts = prompts ?? [];
    const safeAlerts = alerts ?? [];
    const safeVisibility = visibilityRows ?? [];

    const won = safePrompts.filter(p => p.status === "won").length;
    const lost = safePrompts.filter(p => p.status === "lost").length;

    const visibility =
      safeVisibility.length > 0
        ? Math.round(
            safeVisibility.reduce((sum, r) => sum + (r.score ?? 0), 0) /
              safeVisibility.length
          )
        : 0;

    return apiResponse(res, 200, {
      visibility,
      won,
      lost,
      pages: safePages.length,
      alerts: safeAlerts.length,
    });
  } catch (err) {
    console.error("AEO overview failed:", err);
    return apiResponse(res, 500, "Failed to load AEO overview");
  }
};
