import crypto from "crypto"

export default function verifyProxy(req, res, next) {
  const { signature, ...query } = req.query

  if (!signature) {
    return res.status(401).send("Missing signature")
  }

  const sortedQuery = Object.keys(query)
    .sort()
    .map(key => `${key}=${query[key]}`)
    .join("")

  const generatedSignature = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(sortedQuery)
    .digest("hex")

  const safeCompare = crypto.timingSafeEqual(
    Buffer.from(generatedSignature),
    Buffer.from(signature)
  )

  if (!safeCompare) {
    return res.status(401).send("Invalid proxy signature")
  }

  next()
}
