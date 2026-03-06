import { supabase } from "../../config/supabase.js";

export const getAeoPrompts = async (req, res) => {
  const { planId } = req.query;

  const { data } = await supabase
    .from("aeo_prompts")
    .select("id,prompt,status")
    .eq("plan_id", planId)
    .limit(10);

  res.json(data || []);
};
