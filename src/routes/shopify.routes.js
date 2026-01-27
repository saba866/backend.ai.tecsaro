import express from "express"
import crypto from "crypto"
import fetch from "node-fetch"
import { shopifyConfig } from "../config/shopify.js"
import { supabase } from "../config/supabase.js"
import verifyProxy from "../middlewares/verifyProxy.js"
const router = express.Router()

// 1️⃣ Install route
router.get("/install", (req, res) => {
  const { shop } = req.query
  if (!shop) return res.status(400).send("Missing shop")

  const nonce = crypto.randomBytes(16).toString("hex")

  router.get(
  "/proxy/seo-score",
  verifyProxy,
  async (req, res) => {
    res.json({ score: 92 })
  }
)

  const redirect =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${shopifyConfig.apiKey}` +
    `&scope=${shopifyConfig.scopes}` +
    `&redirect_uri=${shopifyConfig.redirectUrl}` +
    `&state=${nonce}`

  res.redirect(redirect)
})

// 2️⃣ Callback route
router.get("/callback", async (req, res) => {
  const { shop, code } = req.query

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: shopifyConfig.apiKey,
      client_secret: shopifyConfig.secret,
      code
    })
  })

  const data = await tokenRes.json()

  await supabase.from("shopify_stores").upsert({
    shop,
    access_token: data.access_token
  })

  res.redirect(`${shopifyConfig.frontendUrl}/dashboard`)
})

// 3️⃣ Fetch products
router.get("/products/:shop", async (req, res) => {
  const { shop } = req.params

  const { data } = await supabase
    .from("shopify_stores")
    .select("access_token")
    .eq("shop", shop)
    .single()

  const products = await fetch(
    `https://${shop}/admin/api/${shopifyConfig.apiVersion}/products.json`,
    {
      headers: {
        "X-Shopify-Access-Token": data.access_token
      }
    }
  )

  res.json(await products.json())
})

export default router
