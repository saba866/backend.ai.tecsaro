




// ─────────────────────────────────────────
// aeoBrandProfile.job.js
// Auto-creates brand profile after crawl
// Respects tier limits:
//   starter → 1 profile across all plans
//   pro     → 3 profiles across all plans
// ─────────────────────────────────────────
import { supabase } from "../config/supabase.js";

const BRAND_PROFILE_LIMITS = {
  starter: 1,
  pro:     3,
  default: 1,
};

export async function ensureBrandProfile(planId) {

  // ── CHECK IF PROFILE ALREADY EXISTS FOR THIS PLAN ──
  const { data: existing } = await supabase
    .from("aeo_brand_profile")
    .select("plan_id")
    .eq("plan_id", planId)
    .maybeSingle();

  if (existing) {
    console.log("⏭️  Brand profile already exists for plan:", planId);
    return;
  }

  // ── LOAD PLAN + TIER ──
  const { data: plan } = await supabase
    .from("plans")
    .select("name, website_url, tier, user_id")
    .eq("id", planId)
    .maybeSingle();

  if (!plan) {
    console.warn("⚠️ No plan found for brand profile");
    return;
  }

  const tier        = plan.tier || "starter";
  const maxProfiles = BRAND_PROFILE_LIMITS[tier] || BRAND_PROFILE_LIMITS.default;

  // ── CHECK TIER LIMIT ACROSS ALL USER'S PLANS ──
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
    console.warn(`⚠️ Brand profile limit reached (${profileCount}/${maxProfiles}) for ${tier} plan — skipping`);
    return;
  }

  // ── BUILD BRAND NAME ──
  let brandName = "";
  let domain    = "";

  if (plan.name && plan.name.trim().length > 1) {
    brandName = plan.name.trim();
  } else if (plan.website_url) {
    brandName = plan.website_url
      .replace("https://", "")
      .replace("http://", "")
      .replace("www.", "")
      .split(".")[0];
  }

  // ── BUILD DOMAIN ──
  if (plan.website_url) {
    domain = plan.website_url
      .replace("https://", "")
      .replace("http://", "")
      .replace("www.", "")
      .split("/")[0]
      .toLowerCase();
  }

  // ── BUILD DESCRIPTION ──
  let description = "";

  // Try aeo_answers summaries first
  const { data: answers } = await supabase
    .from("aeo_answers")
    .select("summary")
    .eq("plan_id", planId)
    .not("summary", "is", null);

  if (answers?.length) {
    description = answers.map((a) => a.summary).join(" ");
  }

  // Try ai_summary from pages
  if (!description) {
    const { data: pages } = await supabase
      .from("aeo_pages")
      .select("ai_summary")
      .eq("plan_id", planId)
      .not("ai_summary", "is", null)
      .limit(5);

    if (pages?.length) {
      description = pages.map((p) => p.ai_summary).join(" ");
    }
  }

  // Fallback to raw content
  if (!description) {
    const { data: pages } = await supabase
      .from("aeo_pages")
      .select("content_text")
      .eq("plan_id", planId)
      .not("content_text", "is", null)
      .limit(3);

    if (pages?.length) {
      description = pages.map((p) => p.content_text).join(" ");
    }
  }

  description = description.replace(/\s+/g, " ").slice(0, 1200);

  if (description.length < 200) {
    console.warn("⚠️ Brand profile skipped: insufficient content");
    return;
  }

  // ── INSERT PROFILE ──
  const { error } = await supabase
    .from("aeo_brand_profile")
    .upsert({
      plan_id:    planId,
      brand_name: brandName.toLowerCase(),
      domain,
      description,
    });

  if (error) {
    console.error("❌ Brand profile insert failed:", error.message);
    return;
  }

  console.log("🧠 Brand profile CREATED:", {
    planId,
    brandName,
    domain,
    tier,
    profilesUsed: (profileCount || 0) + 1,
    profilesMax:  maxProfiles,
  });
}