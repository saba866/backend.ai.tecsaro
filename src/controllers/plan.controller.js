


import { supabase } from "../config/supabase.js";

// ─────────────────────────────────────────
// TIER LIMITS
// ─────────────────────────────────────────
const PROJECT_LIMITS = {
  starter: 1,
  pro:     3,
  default: 1,
};

// ─────────────────────────────────────────
// CREATE PLAN
// ─────────────────────────────────────────
export const createPlan = async (req, res) => {
  try {
    const { name, website_url, country, language } = req.body;
    const userId = req.user.id;

    if (!name || !website_url) {
      return res.status(400).json({ error: "Name and website URL required" });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      return res.status(400).json({ error: "User profile not found" });
    }

    const tier        = profile.tier || "starter";
    const maxProjects = PROJECT_LIMITS[tier] || PROJECT_LIMITS.default;

    const { count: existingCount, error: countErr } = await supabase
      .from("plans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countErr) {
      return res.status(500).json({ error: "Failed to check plan count" });
    }

    if (existingCount >= maxProjects) {
      return res.status(403).json({
        error: `You've reached your project limit of ${maxProjects} on the ${tier} plan.`,
        limit_reached:   true,
        current_count:   existingCount,
        max_projects:    maxProjects,
        upgrade_message: tier === "starter"
          ? "Upgrade to Pro to track up to 3 projects."
          : "Contact us for enterprise plans with unlimited projects.",
      });
    }

    const { data, error } = await supabase
      .from("plans")
      .insert([{ name, website_url, country, language, user_id: userId, tier }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      plan:               data,
      projects_used:      existingCount + 1,
      projects_max:       maxProjects,
      projects_remaining: maxProjects - existingCount - 1,
    });

  } catch (err) {
    console.error("Create plan error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// GET ALL PLANS
// ─────────────────────────────────────────
export const getPlans = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .single();

    const tier        = profile?.tier || "starter";
    const maxProjects = PROJECT_LIMITS[tier] || PROJECT_LIMITS.default;

    // ── Select ALL columns that ProjectsPage.mapPlan() needs ──────────────
    const { data, error } = await supabase
      .from("plans")
      .select(`
        id, name, website_url, country, language, tier, created_at,
        pipeline_status,
        last_full_pipeline, last_daily_tracking, last_weekly_refresh,
        subscription_status,
        prompt_select_max, prompts_used_this_month,
        visibility_runs_this_month,
        onboarding_step,
        trial_ends_at
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      plans:              data,
      projects_used:      data.length,
      projects_max:       maxProjects,
      projects_remaining: maxProjects - data.length,
      tier,
    });

  } catch (err) {
    console.error("Get plans error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// GET SINGLE PLAN
// ─────────────────────────────────────────
export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("plans")
      .select(`
        id, name, website_url, country, language, created_at, tier,
        pipeline_status, last_full_pipeline, last_daily_tracking, last_weekly_refresh,
        subscription_status,
        prompt_select_max, prompts_used_this_month,
        visibility_runs_this_month, onboarding_step, trial_ends_at
      `)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error("Get plan error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────
// SAVE GA PROPERTY
// ─────────────────────────────────────────
export const saveGAProperty = async (req, res) => {
  try {
    const userId             = req.user.id;
    const { id }             = req.params;
    const { ga_property_id } = req.body;

    if (!ga_property_id) {
      return res.status(400).json({ error: "GA property id required" });
    }

    const { data, error } = await supabase
      .from("plans")
      .update({ ga_property_id })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, plan: data });

  } catch (err) {
    console.error("Save GA error:", err);
    res.status(500).json({ error: err.message });
  }
};