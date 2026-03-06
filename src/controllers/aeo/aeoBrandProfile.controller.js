// import { supabase } from "../../config/supabase.js";
// import apiResponse from "../../utils/apiResponse.js";

// /**
//  * Create or update brand description for a plan
//  */
// // export const upsertBrandProfile = async (req, res) => {
// //   const { planId, description } = req.body;

// //   if (!planId || !description) {
// //     return apiResponse(res, 400, "planId and description required");
// //   }

// //   const { error } = await supabase
// //     .from("aeo_brand_profile")
// //     .upsert({
// //       plan_id: planId,
// //       description,
// //     });

// //   if (error) {
// //     console.error("❌ Brand profile upsert failed:", error);
// //     return apiResponse(res, 500, "Failed to save brand profile");
// //   }

// //   return apiResponse(res, 200, "Brand profile saved");
// // };



// export const upsertBrandProfile = async (req, res) => {
//   const { planId, description, brandName } = req.body;

//   if (!planId || !description || !brandName) {
//     return apiResponse(res, 400, "planId, brandName and description required");
//   }

//   const { error } = await supabase
//     .from("aeo_brand_profile")
//     .upsert({
//       plan_id: planId,
//       description,
//       brand_name: brandName.toLowerCase()
//     });

//   if (error) {
//     console.error("❌ Brand profile upsert failed:", error);
//     return apiResponse(res, 500, "Failed to save brand profile");
//   }

//   return apiResponse(res, 200, "Brand profile saved");
// };




// ─────────────────────────────────────────
// aeoBrandProfile.controller.js
// starter → 1 brand profile
// pro     → 3 brand profiles
// ─────────────────────────────────────────
import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";

const BRAND_PROFILE_LIMITS = {
  starter: 1,
  pro:     3,
  default: 1,
};

// ─────────────────────────────────────────
// UPSERT BRAND PROFILE
// Creates or updates brand profile for a plan
// Enforces tier limits before creating new ones
// ─────────────────────────────────────────
export const upsertBrandProfile = async (req, res) => {
  const { planId, description, brandName } = req.body;

  if (!planId || !description || !brandName) {
    return apiResponse(res, 400, "planId, brandName and description required");
  }

  // ── GET PLAN + USER TIER ──
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("tier, user_id")
    .eq("id", planId)
    .single();

  if (planErr || !plan) {
    return apiResponse(res, 404, "Plan not found");
  }

  const tier    = plan.tier || "starter";
  const maxProfiles = BRAND_PROFILE_LIMITS[tier] || BRAND_PROFILE_LIMITS.default;

  // ── CHECK IF PROFILE ALREADY EXISTS FOR THIS PLAN ──
  const { data: existingForPlan } = await supabase
    .from("aeo_brand_profile")
    .select("plan_id")
    .eq("plan_id", planId)
    .maybeSingle();

  // If already exists for this plan → allow update (upsert)
  if (!existingForPlan) {
    // ── COUNT BRAND PROFILES ACROSS ALL USER'S PLANS ──
    const { data: userPlans } = await supabase
      .from("plans")
      .select("id")
      .eq("user_id", plan.user_id);

    const planIds = (userPlans || []).map((p) => p.id);

    const { count: profileCount } = await supabase
      .from("aeo_brand_profile")
      .select("*", { count: "exact", head: true })
      .in("plan_id", planIds.length > 0 ? planIds : ["none"]);

    if ((profileCount || 0) >= maxProfiles) {
      return apiResponse(res, 403, {
        error:           `You've reached your brand profile limit of ${maxProfiles} on the ${tier} plan.`,
        limit_reached:   true,
        current_count:   profileCount,
        max_profiles:    maxProfiles,
        upgrade_message: tier === "starter"
          ? "Upgrade to Pro to manage up to 3 brand profiles."
          : "Contact us for enterprise plans.",
      });
    }
  }

  // ── SAVE PROFILE ──
  const { error } = await supabase
    .from("aeo_brand_profile")
    .upsert({
      plan_id:    planId,
      description,
      brand_name: brandName.toLowerCase(),
    });

  if (error) {
    console.error("❌ Brand profile upsert failed:", error);
    return apiResponse(res, 500, "Failed to save brand profile");
  }

  // ── RETURN SLOT INFO ──
  const { data: userPlans } = await supabase
    .from("plans")
    .select("id")
    .eq("user_id", plan.user_id);

  const planIds = (userPlans || []).map((p) => p.id);

  const { count: updatedCount } = await supabase
    .from("aeo_brand_profile")
    .select("*", { count: "exact", head: true })
    .in("plan_id", planIds.length > 0 ? planIds : ["none"]);

  return apiResponse(res, 200, {
    message:        "Brand profile saved",
    profiles_used:  updatedCount || 1,
    profiles_max:   maxProfiles,
    remaining:      maxProfiles - (updatedCount || 1),
    tier,
  });
};

// ─────────────────────────────────────────
// GET BRAND PROFILE FOR A PLAN
// ─────────────────────────────────────────
export const getBrandProfile = async (req, res) => {
  const { planId } = req.params;

  const { data, error } = await supabase
    .from("aeo_brand_profile")
    .select("plan_id, brand_name, domain, description, created_at")
    .eq("plan_id", planId)
    .maybeSingle();

  if (error) {
    return apiResponse(res, 500, "Failed to load brand profile");
  }

  if (!data) {
    return apiResponse(res, 404, "Brand profile not found");
  }

  return apiResponse(res, 200, data);
};

// ─────────────────────────────────────────
// GET BRAND PROFILE SLOT SUMMARY
// For dashboard to show usage
// ─────────────────────────────────────────
export const getBrandProfileSlots = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return apiResponse(res, 401, "Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .single();

  const tier        = profile?.tier || "starter";
  const maxProfiles = BRAND_PROFILE_LIMITS[tier] || BRAND_PROFILE_LIMITS.default;

  const { data: userPlans } = await supabase
    .from("plans")
    .select("id")
    .eq("user_id", userId);

  const planIds = (userPlans || []).map((p) => p.id);

  const { count } = await supabase
    .from("aeo_brand_profile")
    .select("*", { count: "exact", head: true })
    .in("plan_id", planIds.length > 0 ? planIds : ["none"]);

  return apiResponse(res, 200, {
    profiles_used: count || 0,
    profiles_max:  maxProfiles,
    remaining:     maxProfiles - (count || 0),
    tier,
  });
};