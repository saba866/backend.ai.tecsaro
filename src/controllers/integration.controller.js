import { supabase } from "../config/supabase.js";

/* GET ALL */
export const getIntegrations = async (req, res) => {
  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", req.user.id);

  res.json(data);
};

/* SAVE API */
export const saveApiIntegration = async (req, res) => {
  const { projectId, platform, siteUrl, accessToken, refreshToken } = req.body;

  await supabase.from("integrations").upsert({
    user_id: req.user.id,
    project_id: projectId,
    platform,
    site_url: siteUrl,
    access_token: accessToken,
    refresh_token: refreshToken,
    api_connected: true,
  });

  res.json({ success: true });
};

/* VERIFY SCRIPT */
export const verifyScript = async (req, res) => {
  const { projectId } = req.body;

  await supabase
    .from("integrations")
    .update({ script_connected: true })
    .eq("project_id", projectId);

  res.json({ success: true });
};

/* DISCONNECT */
export const disconnectIntegration = async (req, res) => {
  await supabase.from("integrations").delete().eq("id", req.params.id);
  res.json({ success: true });
};
