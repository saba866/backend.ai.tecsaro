// import { supabase } from "../config/supabase.js"
// import { detectPlatform } from "../services/platformDetector.js"

// /**
//  * Create new project
//  */
// export const createProject = async (req, res) => {
//   try {
//     const { name, website_url, country, language, goal } = req.body
//     const userId = req.user.id

//     if (!name || !website_url) {
//       return res.status(400).json({ error: "Name and domain are required" })
//     }

//     // detect platform (shopify, wordpress, webflow, custom, etc)
//     const platform = await detectPlatform(domain)

//     const { data, error } = await supabase
//       .from("projects")
//       .insert([
//         {
//           name,
//           website_url,
//           country,
//           language,
//           goal,
//           platform,
//           user_id: userId,
//         },
//       ])
//       .select()
//       .single()

//     if (error) throw error

//     res.status(201).json({
//       project: data,
//       next: "confirm",
//     })
//   } catch (err) {
//     console.error("Create project error:", err)
//     res.status(500).json({ error: err.message })
//   }
// }

// /**
//  * Get all projects of logged-in user
//  */
// export const getProjects = async (req, res) => {
//   try {
//     const userId = req.user.id

//     const { data, error } = await supabase
//       .from("projects")
//       .select("*")
//       .eq("user_id", userId)
//       .order("created_at", { ascending: false })

//     if (error) throw error

//     res.json(data)
//   } catch (err) {
//     console.error("Get projects error:", err)
//     res.status(500).json({ error: err.message })
//   }
// }






import { supabase } from "../config/supabase.js"
import { detectPlatform } from "../services/platformDetector.js"

export const createProject = async (req, res) => {
  try {
    const { name, website_url, country, language, goal } = req.body
    const userId = req.user.id

    if (!name || !website_url) {
      return res.status(400).json({ error: "Name and domain required" })
    }

    const { data, error } = await supabase
      .from("projects")
      .insert([{
        name,
        website_url,
        country,
        language,
        goal,
        status: "draft",
        user_id: userId
      }])
      .select()
      .single()

    if (error) throw error

    detectPlatform(website_url).then(async (platform) => {
      await supabase
        .from("projects")
        .update({ platform, status: "detected" })
        .eq("id", data.id)
    })

    res.status(201).json({
      project: data,
      next: "detect"
    })

  } catch (err) {
    console.error("Create project error:", err)
    res.status(500).json({ error: err.message })
  }
}

export const getProjects = async (req, res) => {
  try {
    const userId = req.user.id

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error("Get projects error:", err)
    res.status(500).json({ error: err.message })
  }
}
