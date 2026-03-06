import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";

export const getAeoStatus = async (req, res) => {
  const { planId } = req.query;
  if (!planId) return apiResponse(res, 400, "planId required");

  const { data, error } = await supabase
    .from("aeo_pipeline_status")
    .select("*")
    .eq("plan_id", planId)
    .single();

  if (error) return apiResponse(res, 500, error.message);

  return apiResponse(res, 200, "AEO status", data);
};
