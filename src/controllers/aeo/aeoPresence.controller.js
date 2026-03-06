// import { supabase } from "../../config/supabase.js";
// import apiResponse from "../../utils/apiResponse.js";
// import { calculatePresenceMetrics } from "../../services/aeo/aeoPresence.service.js";

// export const getAeoPresence = async (req, res) => {
//   const { planId } = req.query;   // ✅ FIXED

//   console.log("📡 Presence controller hit, planId:", planId);

//   if (!planId) {
//     return apiResponse(res, 400, "planId is required");
//   }

//   const { data: answers, error } = await supabase
//     .from("aeo_answers")
//     .select("brand_mentioned, competitors")
//     .eq("plan_id", planId);

//   if (error) {
//     console.error("❌ Presence DB error:", error.message);
//     return apiResponse(res, 500, error.message);
//   }

//   console.log("🧠 Presence answers fetched:", answers?.length || 0);

//   const metrics = calculatePresenceMetrics(answers);

//   console.log("📊 Presence metrics:", metrics);

//   return apiResponse(res, 200, "Presence metrics", metrics);
// };



import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";
import { calculatePresenceMetrics } from "../../services/aeo/aeoPresence.service.js";

export const getAeoPresence = async (req, res) => {
  const { planId } = req.query;

  console.log("📡 Presence controller hit, planId:", planId);

  if (!planId) {
    return apiResponse(res, 400, "planId is required");
  }

  // ✅ READ FROM NEW TRACKING TABLE
  const { data: mentions, error } = await supabase
    .from("aeo_mention_results")
    .select("answer_id, entity_name, entity_type, mentioned")
    .eq("plan_id", planId);

  if (error) {
    console.error("❌ Presence DB error:", error.message);
    return apiResponse(res, 500, error.message);
  }

  console.log("🧠 Mention rows fetched:", mentions?.length || 0);

  const metrics = calculatePresenceMetrics(mentions || []);

  console.log("📊 Presence metrics:", metrics);

  return apiResponse(res, 200, "Presence metrics", metrics);
};