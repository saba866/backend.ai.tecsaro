
import { oauth2Client } from "../config/google.js"
import { supabase } from "../config/supabase.js"

/**
 * STEP 1: Generate Google OAuth URL
 */
export const googleConnect = async (req, res) => {
  try {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent", // 🔥 FORCE refresh token
      scope: [
        // ✅ Search Console
        "https://www.googleapis.com/auth/webmasters.readonly",

        // ✅ Google Analytics (GA4)
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/analytics.edit",
        "https://www.googleapis.com/auth/analytics.manage.users.readonly",
      ],
      state: req.user.id,
    })

    res.json({ url })
  } catch (err) {
    console.error("Google connect error:", err)
    res.status(500).json({ error: "Google connect failed" })
  }
}

/**
 * STEP 2: OAuth callback
 */
export const googleCallback = async (req, res) => {
  try {
    const { code, state: userId } = req.query

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      throw new Error("No access token returned from Google")
    }

    await supabase.from("user_integrations").upsert({
      user_id: userId,
      provider: "google",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null, // 🔥 IMPORTANT
      expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000),
      scope: tokens.scope,
    })

    res.redirect(
      `${process.env.FRONTEND_URL}/dashboard/apps-integrations`
    )
  } catch (err) {
    console.error("Google callback error:", err)
    res.status(500).json({ error: "Google auth failed" })
  }
}

/**
 * STEP 3: Get a valid Google access token (auto refresh)
 */
export const getValidAccessToken = async (userId) => {
  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single()

  if (error || !data) {
    throw new Error("Google not connected")
  }

  // 🔐 If token still valid
  if (new Date(data.expires_at) > new Date()) {
    return data.access_token
  }

  // 🔁 Refresh token required
  if (!data.refresh_token) {
    throw new Error("Google refresh token missing — reconnect required")
  }

  oauth2Client.setCredentials({
    refresh_token: data.refresh_token,
  })

  const { credentials } = await oauth2Client.refreshToken(
    data.refresh_token
  )

  await supabase
    .from("user_integrations")
    .update({
      access_token: credentials.access_token,
      expires_at: new Date(credentials.expiry_date),
    })
    .eq("id", data.id)

  return credentials.access_token
}
