import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";

// create / update alert
export const saveAeoAlert = async (req, res) => {
  const { planId, threshold } = req.body;

  if (!planId || threshold === undefined) {
    return apiResponse(res, 400, "planId and threshold required");
  }

  await supabase.from("aeo_alerts").upsert({
    plan_id: planId,
    alert_type: "score_drop",
    threshold,
    enabled: true
  });

  return apiResponse(res, 200, "Alert saved");
};

// list alert events
export const getAeoAlertEvents = async (req, res) => {
  const { planId } = req.params;

  const { data } = await supabase
    .from("aeo_alert_events")
    .select("*")
    .eq("plan_id", planId)
    .order("triggered_at", { ascending: false });

  return apiResponse(res, 200, "Alert events", data);
};
