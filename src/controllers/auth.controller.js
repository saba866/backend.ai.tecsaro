




import { supabase } from "../config/supabase.js";
import { oauth2Client } from "../config/google.js";

export const saveGoogleTokens = async (req, res) => {
  const userId = req.user.id;
  const { code } = req.body;

  const { tokens } = await oauth2Client.getToken(code);

  const { error } = await supabase.from("user_integrations").upsert({
    user_id: userId,
    provider: "google",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope
  });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
};
