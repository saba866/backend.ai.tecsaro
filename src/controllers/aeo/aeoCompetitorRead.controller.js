import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";
export const getCompetitors = async (req, res) => {
  const { planId } = req.params;

  const { data, error } = await supabase
    .from("aeo_competitor_domains")
    .select("domain, visibility")
    .eq("plan_id", planId)
    .order("visibility", { ascending: false });

  if (error) {
    return apiResponse(res, 500, "Failed to load competitors");
  }

  return apiResponse(res, 200, data ?? []);
};
