// import { supabase } from "../../config/supabase.js";
// import apiResponse from "../../utils/apiResponse.js";

// export const getAnswerGaps = async (req, res) => {
//   try {
//     const { planId } = req.params;

//     if (!planId) {
//       return apiResponse(res, 400, "planId required");
//     }

//     const { data, error } = await supabase
//       .from("aeo_answer_gaps")
//       .select(`
//         id,
//         missing,
//         suggestion,
//         prompt_id,
//         aeo_prompts:prompt_id (
//           id,
//           prompt
//         )
//       `)
//       .eq("plan_id", planId);

//     if (error) {
//       console.error("❌ Failed to fetch answer gaps:", error);
//       return apiResponse(res, 500, "Failed to load answer gaps");
//     }

//     // 🔥 IMPORTANT: always return ARRAY in data
//     return apiResponse(res, 200, "Answer gaps loaded", data || []);
//   } catch (err) {
//     console.error("❌ getAnswerGaps crashed:", err);
//     return apiResponse(res, 500, "Failed to load answer gaps");
//   }
// };




// import { supabase } from "../../config/supabase.js";
// import apiResponse from "../../utils/apiResponse.js";

// export const getAnswerGaps = async (req, res) => {
//   try {
//     const { planId } = req.params;

//     if (!planId) {
//       return apiResponse(res, 400, "planId required");
//     }

//     console.log(`📊 Fetching gaps for plan: ${planId}`);

//     const { data, error } = await supabase
//       .from("aeo_answer_gaps")
//       .select(`
//         id,
//         missing,
//         suggestion,
//         prompt_id,
//         created_at,
//         aeo_prompts!aeo_answer_gaps_prompt_id_fkey (
//           id,
//           prompt
//         )
//       `)
//       .eq("plan_id", planId)
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error("❌ Failed to fetch answer gaps:", error);
//       return apiResponse(res, 500, "Failed to load answer gaps");
//     }

//     console.log(`✅ Found ${data?.length || 0} gaps for plan ${planId}`);
    
//     // Log first gap for debugging
//     if (data && data.length > 0) {
//       console.log("Sample gap:", JSON.stringify(data[0], null, 2));
//     }

//     return apiResponse(res, 200, "Answer gaps loaded", data || []);
    
//   } catch (err) {
//     console.error("❌ getAnswerGaps crashed:", err);
//     return apiResponse(res, 500, "Failed to load answer gaps");
//   }
// };



// ─────────────────────────────────────────
// aeoGapRead.controller.js
// GET endpoints for reading gap data
// ─────────────────────────────────────────
import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";

// ─────────────────────────────────────────
// GET /api/aeo/gaps/:planId
// Returns all gaps for a plan, shaped for
// the dashboard UI with pattern + priority.
// ─────────────────────────────────────────
export const getAnswerGaps = async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId) {
      return apiResponse(res, 400, "planId required");
    }

    const { data: gaps, error } = await supabase
      .from("aeo_gaps")
      .select(`
        id,
        prompt,
        prompt_id,
        brand_mentioned,
        brand_mention_rate,
        win_rate,
        brand_position,
        competitor_positions,
        gap_reasons,
        suggestion,
        engines_checked,
        created_at
      `)
      .eq("plan_id", planId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Failed to fetch gaps:", error.message);
      return apiResponse(res, 500, "Failed to load gaps");
    }

    // Shape each gap with derived fields for UI
    const shaped = (gaps || []).map((gap) => {
      const reasons     = Array.isArray(gap.gap_reasons) ? gap.gap_reasons : [];
      const competitors = Array.isArray(gap.competitor_positions) ? gap.competitor_positions : [];

      // Derive pattern for UI display
      const brandMissing  = reasons.includes("brand_not_mentioned");
      const compDominates = reasons.includes("competitor_dominates") || reasons.includes("competitor_present");
      const brandWinning  = reasons.includes("brand_winning");

      let pattern = "missed";
      if (!brandMissing && !compDominates) pattern = "winning";
      else if (!brandMissing && compDominates) pattern = "competing";
      else if (brandMissing && compDominates) pattern = "losing";

      // Derive priority
      let priority = "medium";
      if (pattern === "missed") priority = "high";
      if (pattern === "losing") priority = competitors.length >= 2 ? "high" : "medium";
      if (pattern === "winning") priority = "low";

      return {
        ...gap,
        pattern,
        priority,
        top_competitor:   competitors[0]?.name || null,
        competitor_count: competitors.length,
      };
    });

    // Sort: high priority first, then by created_at
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    shaped.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Build summary counts for dashboard header
    const summary = {
      total:           shaped.length,
      high_priority:   shaped.filter((g) => g.priority === "high").length,
      medium_priority: shaped.filter((g) => g.priority === "medium").length,
      low_priority:    shaped.filter((g) => g.priority === "low").length,
      missed:          shaped.filter((g) => g.pattern === "missed").length,
      losing:          shaped.filter((g) => g.pattern === "losing").length,
      competing:       shaped.filter((g) => g.pattern === "competing").length,
      winning:         shaped.filter((g) => g.pattern === "winning").length,
    };

    return res.json({
      success: true,
      gaps:    shaped,
      summary,
    });

  } catch (err) {
    console.error("❌ getAnswerGaps crashed:", err.message);
    return apiResponse(res, 500, "Failed to load gaps");
  }
};

// ─────────────────────────────────────────
// GET /api/aeo/gaps/:planId/:gapId
// Returns single gap with full recommendation
// detail if available.
// ─────────────────────────────────────────
export const getGapDetail = async (req, res) => {
  try {
    const { planId, gapId } = req.params;

    if (!planId || !gapId) {
      return apiResponse(res, 400, "planId and gapId required");
    }

    const { data: gap, error: gapErr } = await supabase
      .from("aeo_gaps")
      .select("*")
      .eq("id", gapId)
      .eq("plan_id", planId)
      .single();

    if (gapErr || !gap) {
      return apiResponse(res, 404, "Gap not found");
    }

    // Load associated recommendation if exists
    const { data: recommendation } = await supabase
      .from("aeo_recommendations")
      .select("*")
      .eq("gap_id", gapId)
      .eq("plan_id", planId)
      .maybeSingle();

    return res.json({
      success: true,
      gap,
      recommendation: recommendation || null,
    });

  } catch (err) {
    console.error("❌ getGapDetail crashed:", err.message);
    return apiResponse(res, 500, "Failed to load gap detail");
  }
};
