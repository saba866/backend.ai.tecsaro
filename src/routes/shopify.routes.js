import express from "express"
import crypto from "crypto"
import fetch from "node-fetch"
import { shopifyConfig } from "../config/shopify.js"
import { supabase } from "../config/supabase.js"
import verifyProxy from "../middlewares/verifyProxy.js"

const router = express.Router()

// ==========================
// 1️⃣ INSTALL ROUTE (FIXED)
// ==========================
router.get("/install", (req, res) => {
  const { shop } = req.query

  // validate shop
  if (!shop || !shop.endsWith(".myshopify.com")) {
    return res.status(400).send("Invalid shop domain")
  }

  const state = crypto.randomBytes(16).toString("hex")

  const redirectUri = encodeURIComponent(shopifyConfig.redirectUrl)
  const scopes = encodeURIComponent(shopifyConfig.scopes)

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${shopifyConfig.apiKey}` +
    `&scope=${scopes}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}`

  console.log("🔗 Shopify install URL:", installUrl)

  res.redirect(installUrl)
})

// ==========================
// 2️⃣ CALLBACK ROUTE
// ==========================
router.get("/callback", async (req, res) => {
  const { shop, code } = req.query

  if (!shop || !code) {
    return res.status(400).send("Missing shop or code")
  }

  const tokenRes = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: shopifyConfig.apiKey,
        client_secret: shopifyConfig.secret,
        code,
      }),
    }
  )

  const data = await tokenRes.json()

  if (!data.access_token) {
    console.error("❌ Token error:", data)
    return res.status(500).json(data)
  }

  await supabase.from("shopify_stores").upsert({
    shop,
    access_token: data.access_token,
  })

  res.redirect(`${shopifyConfig.frontendUrl}/dashboard`)
})

// ==========================
// 3️⃣ FETCH PRODUCTS
// ==========================
router.get("/products/:shop", async (req, res) => {
  const { shop } = req.params

  const { data, error } = await supabase
    .from("shopify_stores")
    .select("access_token")
    .eq("shop", shop)
    .single()

  if (error || !data) {
    return res.status(404).json({ error: "Store not connected" })
  }

  const products = await fetch(
    `https://${shop}/admin/api/${shopifyConfig.apiVersion}/products.json`,
    {
      headers: {
        "X-Shopify-Access-Token": data.access_token,
      },
    }
  )

  res.json(await products.json())
})

// ==========================
// 4️⃣ APP PROXY ROUTE
// ==========================
router.get("/proxy/seo-score", verifyProxy, async (req, res) => {
  res.json({ score: 92 })
})

export default router
