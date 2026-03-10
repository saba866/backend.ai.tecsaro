


// import { supabase } from "../../config/supabase.js";
// import { startCrawlJob } from "../../jobs/aeoCrawl.job.js";
// import apiResponse from "../../utils/apiResponse.js";

// export const startAeoOnboarding = async (req, res) => {
//   const { planId } = req.body;
//   if (!planId) return apiResponse(res, 400, "planId required");

//   // ✅ Guard — prevent duplicate pipeline runs
//   const { data: existingPlan } = await supabase
//     .from("plans")
//     .select("pipeline_status")
//     .eq("id", planId)
//     .single();

//   if (existingPlan?.pipeline_status !== "idle") {
//     return apiResponse(res, 200, "Pipeline already running");
//   }

//   // ✅ ONLY start crawl
//   await startCrawlJob(planId);

//   return apiResponse(res, 200, "AEO onboarding started");
// };


// // PATCH /api/aeo/onboarding-step
// export const updateOnboardingStep = async (req, res) => {
//   const { planId, step } = req.body;
//   const userId = req.user?.id;

//   if (!planId || step === undefined) return apiResponse(res, 400, "planId and step required");
//   if (step < 1 || step > 6) return apiResponse(res, 400, "Invalid step");

//   const { error } = await supabase
//     .from("plans")
//     .update({ onboarding_step: step })
//     .eq("id", planId)
//     .eq("user_id", userId);

//   if (error) return apiResponse(res, 500, "Failed to update step");

//   return apiResponse(res, 200, "Step saved", { step });
// };

// // GET /api/aeo/onboarding-status
// export const getOnboardingStatus = async (req, res) => {
//   const userId = req.user?.id;

//   // Get the user's most recent incomplete plan
//   const { data: plan, error } = await supabase
//     .from("plans")
//     .select("id, onboarding_step, pipeline_status, prompts_ready_for_review, prompts_approved")
//     .eq("user_id", userId)
//     .lt("onboarding_step", 6)          // not yet complete
//     .order("created_at", { ascending: false })
//     .limit(1)
//     .single();

//   if (error || !plan) return apiResponse(res, 200, "No incomplete onboarding", { onboarding_step: null });

//   return apiResponse(res, 200, "Onboarding status", {
//     planId: plan.id,
//     onboarding_step: plan.onboarding_step,
//     is_complete: plan.onboarding_step >= 6
//   });
// };



import { supabase } from "../../config/supabase.js";
import { startCrawlJob } from "../../jobs/aeoCrawl.job.js";
import apiResponse from "../../utils/apiResponse.js";

// POST /aeo/onboard/start
export const startAeoOnboarding = async (req, res) => {
  const { planId } = req.body;
  if (!planId) return apiResponse(res, 400, "planId required");

  // Guard — prevent duplicate pipeline runs
  const { data: existingPlan } = await supabase
    .from("plans")
    .select("pipeline_status")
    .eq("id", planId)
    .single();

  if (existingPlan?.pipeline_status !== "idle") {
    return apiResponse(res, 200, "Pipeline already running");
  }

  await startCrawlJob(planId);

  return apiResponse(res, 200, "AEO onboarding started");
};

// PATCH /aeo/onboarding-step
export const updateOnboardingStep = async (req, res) => {
  const { planId, step } = req.body;
  const userId = req.user?.id;

  // Auth guard — authMiddleware should always set req.user but be safe
  if (!userId) return apiResponse(res, 401, "Unauthorized");

  if (!planId || step === undefined) return apiResponse(res, 400, "planId and step required");
  if (step < 1 || step > 6)         return apiResponse(res, 400, "Invalid step (must be 1–6)");

  const { error } = await supabase
    .from("plans")
    .update({ onboarding_step: step })
    .eq("id", planId)
    .eq("user_id", userId);

  if (error) {
    console.error("[updateOnboardingStep] Supabase error:", error.message);
    return apiResponse(res, 500, "Failed to update step");
  }

  return apiResponse(res, 200, "Step saved", { step });
};

// GET /aeo/onboarding-status
export const getOnboardingStatus = async (req, res) => {
  const userId = req.user?.id;

  // Auth guard
  if (!userId) return apiResponse(res, 401, "Unauthorized");

  const { data: plan, error } = await supabase
    .from("plans")
    .select("id, onboarding_step, pipeline_status, prompts_ready_for_review, prompts_approved")
    .eq("user_id", userId)
    .lt("onboarding_step", 6)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !plan) {
    return apiResponse(res, 200, "No incomplete onboarding", { onboarding_step: null });
  }

  return apiResponse(res, 200, "Onboarding status", {
    planId:          plan.id,
    onboarding_step: plan.onboarding_step,
    is_complete:     plan.onboarding_step >= 6,
  });
};