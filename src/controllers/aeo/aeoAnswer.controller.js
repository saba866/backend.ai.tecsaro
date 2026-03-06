import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";

export const generateAeoAnswers = async (req, res) => {
  const { planId } = req.body;
  if (!planId) return apiResponse(res, 400, "planId required");

  // ✅ ONLY return existing answers (no job trigger)
  const { data, error } = await supabase
    .from("aeo_answers")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });

  if (error) return apiResponse(res, 500, error.message);

  return apiResponse(res, 200, "AEO answers fetched", data);
};
