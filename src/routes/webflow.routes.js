import express from "express";
import fetch from "node-fetch";
import { supabase } from "../config/supabase.js";

const router = express.Router();

router.get("/connect", (req, res) => {
  const redirectUri = `${process.env.API_URL}/webflow/callback`;
  res.redirect(
    `https://webflow.com/oauth/authorize?client_id=${process.env.WEBFLOW_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code`
  );
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;

  const tokenRes = await fetch("https://api.webflow.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.WEBFLOW_CLIENT_ID,
      client_secret: process.env.WEBFLOW_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  const data = await tokenRes.json();

  await supabase.from("integrations").insert({
    platform: "webflow",
    access_token: data.access_token,
    api_connected: true,
  });

  res.redirect(`${process.env.FRONTEND_URL}/integrations?success=webflow`);
});

export default router;
