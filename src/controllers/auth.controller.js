import { supabase } from "../config/supabase.js";

export const saveGoogleTokens = async (req, res) => {
  const userId = req.user.id;
  const { providerToken, refreshToken } = req.body;

  if (!providerToken) {
    return res.status(400).json({ error: "No provider token" });
  }

  const { error } = await supabase.from("user_integrations").upsert({
    user_id: userId,
    provider: "google",
    access_token: providerToken,
    refresh_token: refreshToken,
  });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
};
