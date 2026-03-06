import { supabase } from "../config/supabase.js"
import { oauth2Client } from "../config/google.js"

export const getValidAccessToken = async (userId) => {
  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single()

  if (error || !data) throw new Error("Google not connected")

  oauth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })

  // refresh token if expired
  if (new Date(data.expires_at) < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken()

    await supabase
      .from("user_integrations")
      .update({
        access_token: credentials.access_token,
        expires_at: new Date(Date.now() + credentials.expiry_date),
      })
      .eq("id", data.id)

    return credentials.access_token
  }

  return data.access_token
}
