// import { supabase } from "../config/supabase.js";


// // 🥇 Get pricing plans
// export const getPricingPlans = async (req, res) => {
//   const { data, error } = await supabase
//     .from("pricing_plans")
//     .select(`
//       id,name,slug,
//       price_monthly,price_yearly,
//       brands_limit,prompts_limit,
//       competitors_limit,pages_limit,
//       manual_runs_limit,trial_days
//     `)
//     .eq("is_active", true)
//     .order("price_monthly");

//   if (error) return res.status(500).json({ error });
//   res.json(data);
// };


// // 🥈 Create project with starter plan
// export const createProject = async (req, res) => {
//   const userId = req.user?.id; // from auth middleware
//   const { name, website_url } = req.body;

//   const { data: starter } = await supabase
//     .from("pricing_plans")
//     .select("id,trial_days")
//     .eq("slug", "starter")
//     .single();

//   if (!starter)
//     return res.status(400).json({ error: "Starter plan missing" });

//   const trialEnds = new Date();
//   trialEnds.setDate(trialEnds.getDate() + starter.trial_days);

//   const { data, error } = await supabase
//     .from("plans")
//     .insert({
//       user_id: userId,
//       name,
//       website_url,
//       pricing_plan_id: starter.id,
//       trial_ends_at: trialEnds,
//       subscription_status: "trial"
//     })
//     .select()
//     .single();

//   if (error) return res.status(500).json({ error });
//   res.json(data);
// };


// // 🥉 Get project plan + limits
// export const getProjectPlan = async (req, res) => {
//   const projectId = req.params.id;

//   const { data, error } = await supabase
//     .from("plans")
//     .select(`
//       id,
//       subscription_status,
//       trial_ends_at,
//       pricing_plans (
//         id,name,slug,
//         manual_runs_limit,
//         prompts_limit,
//         pages_limit,
//         competitors_limit
//       )
//     `)
//     .eq("id", projectId)
//     .single();

//   if (error) return res.status(404).json({ error });
//   res.json(data);
// };


// // 🏆 Change plan (after Razorpay success)
// export const changeProjectPlan = async (req, res) => {
//   const { projectId, newPlanId } = req.body;

//   const { error } = await supabase
//     .from("plans")
//     .update({
//       pricing_plan_id: newPlanId,
//       subscription_status: "active"
//     })
//     .eq("id", projectId);

//   if (error) return res.status(500).json({ error });
//   res.json({ success: true });
// };




import { supabase } from "../config/supabase.js"

// ─────────────────────────────────────────────────────────────────
// GET /pricing — returns all active plans (free, starter, pro)
// ─────────────────────────────────────────────────────────────────
export const getPricingPlans = async (req, res) => {
  const { data, error } = await supabase
    .from("pricing_plans")
    .select(`
      id, name, slug,
      price_monthly, price_yearly,
      price_monthly_display, price_yearly_display,
      price_yearly_monthly,
      brands_limit, prompts_limit, prompts_generate,
      prompts_select_max, prompts_select_min,
      competitors_limit, pages_limit,
      manual_runs_limit, engines,
     is_popular
    `)
    .eq("is_active", true)
    .order("price_monthly")

  if (error) return res.status(500).json({ error: error.message })
  res.json({ data })
}

// ─────────────────────────────────────────────────────────────────
// POST /project/create — create project, assign free plan by default
// ─────────────────────────────────────────────────────────────────
export const createProject = async (req, res) => {
  const userId = req.user?.id
  const { name, website_url } = req.body

  // Default to free plan — no trial, no charge
  const { data: freePlan } = await supabase
    .from("pricing_plans")
    .select("id,  slug")
    .eq("slug", "free")
    .single()

  if (!freePlan) return res.status(400).json({ error: "Free plan not found in pricing_plans" })

  const { data, error } = await supabase
    .from("plans")
    .insert({
      user_id:             userId,
      name,
      website_url,
      pricing_plan_id:     freePlan.id,
      tier:                "free",
      subscription_status: "active",   // free = always active
          
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ data })
}

// ─────────────────────────────────────────────────────────────────
// GET /project/:id/plan — get project plan + limits
// ─────────────────────────────────────────────────────────────────
export const getProjectPlan = async (req, res) => {
  const projectId = req.params.id

  const { data, error } = await supabase
    .from("plans")
    .select(`
      id,
      tier,
      subscription_status,
      pricing_plans (
        id, name, slug,
        manual_runs_limit,
        prompts_limit, prompts_generate,
        prompts_select_max, prompts_select_min,
        pages_limit,
        competitors_limit,
        engines,
        
      )
    `)
    .eq("id", projectId)
    .single()

  if (error) return res.status(404).json({ error: error.message })
  res.json({ data })
}

// ─────────────────────────────────────────────────────────────────
// POST /project/change-plan — upgrade/downgrade after Razorpay success
// ─────────────────────────────────────────────────────────────────
export const changeProjectPlan = async (req, res) => {
  const { projectId, newPlanId, newSlug } = req.body

  const { error } = await supabase
    .from("plans")
    .update({
      pricing_plan_id:     newPlanId,
      tier:                newSlug ?? null,
      subscription_status: "active",
    })
    .eq("id", projectId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
}