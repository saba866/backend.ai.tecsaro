

//these is production based 

import { supabase } from "../config/supabase.js"

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return res.status(401).json({ error: "Missing auth header" })
    }

    const token = authHeader.replace("Bearer ", "")

    const { data, error } = await supabase.auth.getUser(token)

    if (error) {
      console.error("Auth error:", error.message)
      return res.status(401).json({ error: "Invalid token" })
    }

    req.user = data.user
    next()
  } catch (err) {
    console.error("Auth middleware crash:", err)
    res.status(500).json({ error: "Auth middleware failed" })
  }
}



// import { supabase } from "../config/supabase.js"

// export const authMiddleware = async (req, res, next) => {
//   try {
//     // 1️⃣ Try Authorization header first (Postman, mobile apps)
//     let token = null

//     const authHeader = req.headers.authorization
//     if (authHeader?.startsWith("Bearer ")) {
//       token = authHeader.replace("Bearer ", "")
//     }

//     // 2️⃣ Fallback: try cookies (browser)
//     if (!token && req.cookies) {
//       token =
//         req.cookies["sb-access-token"] ||
//         req.cookies["supabase-auth-token"] ||
//         null
//     }

//     if (!token) {
//       return res.status(401).json({ error: "Missing auth token" })
//     }

//     // 3️⃣ Validate token
//     const { data, error } = await supabase.auth.getUser(token)

//     if (error || !data?.user) {
//       return res.status(401).json({ error: "Invalid session" })
//     }

//     req.user = data.user
//     next()
//   } catch (err) {
//     console.error("Auth middleware error:", err)
//     res.status(401).json({ error: "Unauthorized" })
//   }
// }




// import { createClient } from "@supabase/supabase-js"

// const supabaseAuth = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_ROLE_KEY
// )

// export const authMiddleware = async (req, res, next) => {
//   try {
//     // Let Supabase read cookies directly
//     const { data, error } = await supabaseAuth.auth.getUser()

//     if (error || !data?.user) {
//       return res.status(401).json({ error: "Invalid session" })
//     }

//     req.user = data.user
//     next()
//   } catch (err) {
//     console.error("Auth error:", err)
//     res.status(401).json({ error: "Unauthorized" })
//   }
// }
