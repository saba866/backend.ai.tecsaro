import {
  startPromptDiscovery,
  approvePrompts,
  addManualPrompt,
  removePrompt,
  getPromptsForReview,
  getActivePrompts,
  getPromptSlotSummary,
  approveSuggestedPrompt,
  dismissSuggestedPrompt,
  isValidPrompt,
} from "../../services/aeo/aeoPrompt.service.js";
import { supabase } from "../../config/supabase.js";
import apiResponse from "../../utils/apiResponse.js";
import { runPipelinePhase2 } from "../../jobs/aeoPipeline.job.js";

// ─────────────────────────────────────────
// POST /api/aeo/prompts/discover
// ─────────────────────────────────────────
export const discoverPrompts = async (req, res) => {
  const { planId } = req.body;
  if (!planId) return apiResponse(res, 400, "planId required");

  startPromptDiscovery(planId).catch((err) => {
    console.error(`❌ Discovery failed for plan ${planId}:`, err.message);
  });

  return apiResponse(res, 200, "Prompt discovery started");
};

// ─────────────────────────────────────────
// GET /api/aeo/prompts/review?planId=xxx
// ─────────────────────────────────────────
export const getReviewPrompts = async (req, res) => {
  const { planId } = req.query;
  if (!planId) return apiResponse(res, 400, "planId required");

  try {
    const data = await getPromptsForReview(planId);
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("❌ getReviewPrompts error:", err.message);
    return apiResponse(res, 500, "Failed to load prompts");
  }
};

// ─────────────────────────────────────────
// POST /api/aeo/prompts/approve
// ─────────────────────────────────────────
export const approveSelectedPrompts = async (req, res) => {
  const { planId, selectedIds } = req.body;

  if (!planId) return apiResponse(res, 400, "planId required");
  if (!Array.isArray(selectedIds) || selectedIds.length === 0)
    return apiResponse(res, 400, "selectedIds required");

  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("id, tier, pipeline_status, prompt_select_max, prompt_select_min")
    .eq("id", planId)
    .single();

  if (planErr || !plan) return apiResponse(res, 404, "Plan not found");

  // ✅ Tier limits as fallback, plan column takes priority
  const tierLimits = { starter: 20, pro: 50 };
  const selectMax  = plan.prompt_select_max ?? tierLimits[plan.tier] ?? 20;
  const selectMin  = plan.prompt_select_min ?? 3;

  if (selectedIds.length < selectMin)
    return apiResponse(res, 400, `Select at least ${selectMin} prompts`);
  if (selectedIds.length > selectMax)
    return apiResponse(res, 400, `Maximum ${selectMax} prompts allowed on ${plan.tier} plan`);

  // Activate selected
  const { error: activateErr } = await supabase
    .from("aeo_prompts")
    .update({ status: "active", selected: true })
    .eq("plan_id", planId)
    .in("id", selectedIds);

  if (activateErr) {
    console.error("[approve] activate error:", activateErr);
    return apiResponse(res, 500, "Failed to activate prompts");
  }

  // Dismiss remaining pending_review
  const { error: dismissErr } = await supabase
    .from("aeo_prompts")
    .update({ status: "dismissed", selected: false })
    .eq("plan_id", planId)
    .eq("status", "pending_review")
    .not("id", "in", `(${selectedIds.map(id => `"${id}"`).join(",")})`);

  if (dismissErr) {
    console.error("[approve] dismiss error:", dismissErr); // non-fatal
  }

  // Update plan status
  await supabase
    .from("plans")
    .update({
      prompts_approved:    true,
      prompts_approved_at: new Date().toISOString(),
      pipeline_status:     "running",
    })
    .eq("id", planId);

  // Respond immediately
  res.json({
    success:   true,
    activated: selectedIds.length,
    message:   "Prompts approved — pipeline resuming",
  });

  // Trigger Phase 2 async
  setImmediate(() => runPipelinePhase2(planId).catch(console.error));
};
// ─────────────────────────────────────────
// POST /api/aeo/prompts/manual
// ─────────────────────────────────────────
export const addCustomPrompt = async (req, res) => {
  const { planId, prompt, intent } = req.body;

  if (!planId) return apiResponse(res, 400, "planId required");
  if (!prompt || typeof prompt !== "string" || !prompt.trim())
    return apiResponse(res, 400, "prompt text required");

  try {
    const result = await addManualPrompt(planId, prompt.trim(), intent);
    if (result.error) return apiResponse(res, result.limit_reached ? 403 : 400, result.error);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ addCustomPrompt error:", err.message);
    return apiResponse(res, 500, "Failed to add prompt");
  }
};

// ─────────────────────────────────────────
// DELETE /api/aeo/prompts/:promptId
// ─────────────────────────────────────────
export const deletePrompt = async (req, res) => {
  const { promptId } = req.params;
  const { planId }   = req.query;

  if (!planId)   return apiResponse(res, 400, "planId required");
  if (!promptId) return apiResponse(res, 400, "promptId required");

  try {
    const result = await removePrompt(planId, promptId);
    if (result.error) return apiResponse(res, 400, result.error);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ deletePrompt error:", err.message);
    return apiResponse(res, 500, "Failed to remove prompt");
  }
};

// ─────────────────────────────────────────
// GET /api/aeo/prompts/active?planId=xxx
// ─────────────────────────────────────────
export const getActive = async (req, res) => {
  const { planId } = req.query;
  if (!planId) return apiResponse(res, 400, "planId required");

  try {
    const prompts = await getActivePrompts(planId);
    return res.json({ success: true, prompts, total: prompts.length });
  } catch (err) {
    console.error("❌ getActive error:", err.message);
    return apiResponse(res, 500, "Failed to load active prompts");
  }
};

// ─────────────────────────────────────────
// GET /api/aeo/prompts/slots?planId=xxx
// ─────────────────────────────────────────
export const getSlotSummary = async (req, res) => {
  const { planId } = req.query;
  if (!planId) return apiResponse(res, 400, "planId required");

  try {
    const summary = await getPromptSlotSummary(planId);
    if (!summary) return apiResponse(res, 404, "Plan not found");
    return res.json({ success: true, ...summary });
  } catch (err) {
    console.error("❌ getSlotSummary error:", err.message);
    return apiResponse(res, 500, "Failed to load slot summary");
  }
};

// ─────────────────────────────────────────
// GET /api/aeo/prompts/suggested?planId=xxx
// ─────────────────────────────────────────
export const getSuggestedPrompts = async (req, res) => {
  const { planId } = req.query;
  if (!planId) return apiResponse(res, 400, "planId required");

  try {
    const { data: suggestions, error } = await supabase
      .from("aeo_prompts")
      .select("id, prompt, intent, suggestion_reason, created_at")
      .eq("plan_id", planId)
      .eq("status", "suggested")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const slotSummary = await getPromptSlotSummary(planId);

    return res.json({
      success:     true,
      suggestions: suggestions || [],
      total:       suggestions?.length || 0,
      slots:       slotSummary,
    });
  } catch (err) {
    console.error("❌ getSuggestedPrompts error:", err.message);
    return apiResponse(res, 500, "Failed to load suggestions");
  }
};

// ─────────────────────────────────────────
// POST /api/aeo/prompts/suggested/:promptId/approve
// ─────────────────────────────────────────
export const approveSuggestion = async (req, res) => {
  const { promptId } = req.params;
  const { planId }   = req.body;

  if (!planId)   return apiResponse(res, 400, "planId required");
  if (!promptId) return apiResponse(res, 400, "promptId required");

  try {
    const result = await approveSuggestedPrompt(planId, promptId);
    if (result.error) return apiResponse(res, result.limit_reached ? 403 : 400, result.error);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ approveSuggestion error:", err.message);
    return apiResponse(res, 500, "Failed to approve suggestion");
  }
};

// ─────────────────────────────────────────
// POST /api/aeo/prompts/suggested/:promptId/dismiss
// ─────────────────────────────────────────
export const dismissSuggestion = async (req, res) => {
  const { promptId } = req.params;
  const { planId }   = req.body;

  if (!planId)   return apiResponse(res, 400, "planId required");
  if (!promptId) return apiResponse(res, 400, "promptId required");

  try {
    const result = await dismissSuggestedPrompt(planId, promptId);
    if (result.error) return apiResponse(res, 400, result.error);
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ dismissSuggestion error:", err.message);
    return apiResponse(res, 500, "Failed to dismiss suggestion");
  }
};

// ─────────────────────────────────────────
// POST /api/aeo/prompts/validate
// ─────────────────────────────────────────
export const validatePrompt = async (req, res) => {
  const { planId, prompt } = req.body;

  if (!prompt || typeof prompt !== "string")
    return apiResponse(res, 400, "prompt text required");

  try {
    let brandName = "";
    if (planId) {
      const { data: plan } = await supabase
        .from("plans")
        .select("name")
        .eq("id", planId)
        .single();
      brandName = plan?.name?.toLowerCase() || "";
    }

    const valid = isValidPrompt(prompt.trim(), brandName);
    return res.json({
      success: true,
      valid,
      message: valid
        ? "Looks good!"
        : "Try a full question like: 'What are the best tools for team collaboration?'",
    });
  } catch (err) {
    console.error("❌ validatePrompt error:", err.message);
    return apiResponse(res, 500, "Validation failed");
  }
};

// ─────────────────────────────────────────
// GET /api/aeo/prompts?planId=xxx
// ─────────────────────────────────────────
export const getAeoPrompts = async (req, res) => {
  const { planId, status, limit = 50, offset = 0 } = req.query;

  if (!planId) return apiResponse(res, 400, "planId required");

  try {
    let query = supabase
      .from("aeo_prompts")
      .select("id, prompt, intent, source, status, keywords, industry, category, created_at")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) {
      const statuses = status.split(",").map((s) => s.trim());
      query = statuses.length === 1
        ? query.eq("status", statuses[0])
        : query.in("status", statuses);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({
      success: true,
      prompts: data || [],
      total:   data?.length || 0,
    });
  } catch (err) {
    console.error("❌ getAeoPrompts error:", err.message);
    return apiResponse(res, 500, "Failed to load prompts");
  }
};