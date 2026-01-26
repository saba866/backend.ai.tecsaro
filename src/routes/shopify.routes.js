import express from "express";
import fetch from "node-fetch";
import { supabase } from "../config/supabase.js";

const router = express.Router();

router.get("/connect", (req, res) => {
  const { shop } = req.query;
  const redirectUri = `${process.env.API_URL}/shopify/callback`;

  const url = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=read_products,write_products,read_content,write_content&redirect_uri=${redirectUri}`;

  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { shop, code } = req.query;

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  const data = await tokenRes.json();

  await supabase.from("integrations").insert({
    platform: "shopify",
    site_url: shop,
    access_token: data.access_token,
    api_connected: true,
  });

  res.redirect(`${process.env.FRONTEND_URL}/integrations?success=shopify`);
});

export default router;
