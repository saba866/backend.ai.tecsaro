// import { supabase } from "../config/supabase.js";
// import apiResponse from "../utils/apiResponse.js";

// // ─────────────────────────────────────────────────────────────────
// // GET /profile
// // Called by DashboardSidebar to get user name, email, plan tier.
// // The sidebar reads: json?.data ?? json
// // ─────────────────────────────────────────────────────────────────
// export const getProfile = async (req, res) => {
//   const userId = req.user?.id;
//   const email  = req.user?.email;

//   if (!userId) return apiResponse(res, 401, "Unauthorized");

//   try {
//     const { data, error } = await supabase
//       .from("profiles")
//       .select("id, name, email, plan, plan_tier, avatar_url, created_at")
//       .eq("id", userId)
//       .maybeSingle();

//     if (error) {
//       console.error("[getProfile] DB error:", error.message);
//       return apiResponse(res, 500, "Failed to load profile");
//     }

//     // Profile row may not exist yet — return sensible defaults from JWT
//     if (!data) {
//       return res.status(200).json({
//         success: true,
//         data: {
//           id:         userId,
//           name:       req.user?.user_metadata?.full_name ?? req.user?.user_metadata?.name ?? "",
//           email:      email ?? "",
//           plan:       "starter",
//           plan_tier:  "starter",
//           avatar_url: null,
//         },
//       });
//     }

//     // email may be in auth table only — fill it in if missing from profiles row
//     return res.status(200).json({
//       success: true,
//       data: { ...data, email: data.email ?? email ?? "" },
//     });
//   } catch (err) {
//     console.error("[getProfile] error:", err);
//     return apiResponse(res, 500, "Internal server error");
//   }
// };

// // ─────────────────────────────────────────────────────────────────
// // PATCH /profile
// // Update name or avatar_url from settings page.
// // Body: { name?, avatar_url? }
// // ─────────────────────────────────────────────────────────────────
// export const updateProfile = async (req, res) => {
//   const userId = req.user?.id;
//   if (!userId) return apiResponse(res, 401, "Unauthorized");

//   const ALLOWED = ["name", "avatar_url"];
//   const updates = {};
//   for (const key of ALLOWED) {
//     if (req.body[key] !== undefined) updates[key] = req.body[key];
//   }

//   if (!Object.keys(updates).length) {
//     return apiResponse(res, 400, "No valid fields provided");
//   }

//   try {
//     // Upsert — creates row if it doesn't exist yet
//     const { data, error } = await supabase
//       .from("profiles")
//       .upsert({ id: userId, ...updates }, { onConflict: "id" })
//       .select("id, name, email, plan, plan_tier, avatar_url")
//       .single();

//     if (error) {
//       console.error("[updateProfile] DB error:", error.message);
//       return apiResponse(res, 500, "Failed to update profile");
//     }

//     return res.status(200).json({ success: true, data });
//   } catch (err) {
//     console.error("[updateProfile] error:", err);
//     return apiResponse(res, 500, "Internal server error");
//   }
// };








import { supabase } from "../config/supabase.js";
import apiResponse from "../utils/apiResponse.js";

// ─────────────────────────────────────────────────────────────────
// SCHEMA (actual columns in public.profiles):
//   id         uuid  PK  → auth.users.id
//   name       text
//   email      text  unique
//   avatar     text  ← generated initial e.g. "S"
//   tier       text  default 'starter'
//   created_at timestamptz
//   updated_at timestamptz
// ─────────────────────────────────────────────────────────────────

// Derives a single-letter avatar from name or email
// ✅ Replace with this
function generateAvatar(name, email) {
  const trimmed = (name ?? "").trim();

  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  }

  return (email ?? "").trim().charAt(0).toUpperCase() || "?";
}
// ─────────────────────────────────────────────────────────────────
// POST /profile/sync
// Called immediately after signup/login to ensure a profiles row exists.
// Creates one if missing, updates name/email/avatar if they changed.
// Safe to call multiple times (upsert).
//
// Frontend calls this right after supabaseBrowser.auth.signUp() succeeds.
export const syncProfile = async (req, res) => {
  const userId = req.user?.id;
  const email  = req.user?.email;
  const meta   = req.user?.user_metadata ?? {};

  console.log("[syncProfile] userId:", userId);
  console.log("[syncProfile] email:", email);
  console.log("[syncProfile] body:", JSON.stringify(req.body));
  console.log("[syncProfile] meta:", JSON.stringify(meta));

  const name   = (req.body?.name ?? meta.name ?? meta.full_name ?? "").trim();
  const avatar = generateAvatar(name, email);

  console.log("[syncProfile] name:", name);
  console.log("[syncProfile] avatar:", avatar);

  // ... rest of function

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id:         userId,
          name:       name || null,
          email:      email || null,
          avatar,
          tier:       "starter",           // default — upgraded via billing webhook
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:        "id",
          ignoreDuplicates:  false,        // always update name/email/avatar if changed
        }
      )
      .select("id, name, email, avatar, tier, created_at, updated_at")
      .single();

    if (error) {
      console.error("[syncProfile] DB error:", error.message);
      return apiResponse(res, 500, "Failed to sync profile");
    }

    console.log(`✅ Profile synced: user=${userId} avatar=${avatar}`);

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[syncProfile] error:", err);
    return apiResponse(res, 500, "Internal server error");
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /profile
// Called by DashboardSidebar on mount.
// Returns the profiles row. If somehow missing, creates it from JWT.
// ─────────────────────────────────────────────────────────────────
export const getProfile = async (req, res) => {
  const userId = req.user?.id;
  const email  = req.user?.email;
  const meta   = req.user?.user_metadata ?? {};

  if (!userId) return apiResponse(res, 401, "Unauthorized");

  try {
    let { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, avatar, tier, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[getProfile] DB error:", error.message);
      return apiResponse(res, 500, "Failed to load profile");
    }

    // Profile row missing (e.g. user signed up before sync endpoint existed)
    // Auto-create it so the sidebar never shows blank
    if (!data) {
      const name   = (meta.name ?? meta.full_name ?? "").trim();
      const avatar = generateAvatar(name, email);

      const { data: created, error: createErr } = await supabase
        .from("profiles")
        .upsert(
          { id: userId, name: name || null, email: email || null, avatar, tier: "starter" },
          { onConflict: "id" }
        )
        .select("id, name, email, avatar, tier, created_at, updated_at")
        .single();

      if (createErr) {
        console.error("[getProfile] auto-create failed:", createErr.message);
        // Return sensible defaults from JWT so sidebar still renders
        return res.status(200).json({
          success: true,
          data: { id: userId, name: name || null, email: email || null, avatar, tier: "starter" },
        });
      }

      data = created;
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[getProfile] error:", err);
    return apiResponse(res, 500, "Internal server error");
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /profile
// Update name (and auto-regenerate avatar initial) from settings page.
// Body: { name }
// ─────────────────────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
  const userId = req.user?.id;
  const email  = req.user?.email;

  if (!userId) return apiResponse(res, 401, "Unauthorized");

  const { name } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return apiResponse(res, 400, "name is required");
  }

  const trimmedName = name.trim();
  const avatar      = generateAvatar(trimmedName, email);

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        { id: userId, name: trimmedName, avatar, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      )
      .select("id, name, email, avatar, tier")
      .single();

    if (error) {
      console.error("[updateProfile] DB error:", error.message);
      return apiResponse(res, 500, "Failed to update profile");
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[updateProfile] error:", err);
    return apiResponse(res, 500, "Internal server error");
  }
};