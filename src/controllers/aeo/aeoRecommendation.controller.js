
import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";

export const getRecommendations = async (req, res) => {
  try {
    const planId = req.query.planId;
    if (!planId) return apiResponse(res, 400, "planId required");

    const { data, error } = await supabase
      .from("aeo_recommendations")
      .select("id, prompt, type, pattern, priority, summary, message, actions, expected_impact, estimated_weeks, top_competitor, rec_source, competitor_count, created_at")
      .eq("plan_id", planId)
      .eq("status", "active")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const high   = data?.filter(r => r.priority === "high")   ?? [];
    const medium = data?.filter(r => r.priority === "medium") ?? [];
    const low    = data?.filter(r => r.priority === "low")    ?? [];

    return res.json({
      success: true,
      data: {
        recommendations: data ?? [],
        total:  data?.length ?? 0,
        high:   high.length,
        medium: medium.length,
        low:    low.length,
      },
    });
  } catch (err) {
    console.error("getRecommendations error:", err.message);
    return apiResponse(res, 500, "Failed to load recommendations");
  }
};