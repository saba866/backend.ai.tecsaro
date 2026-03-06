import { supabase } from "../../config/supabase.js";
import { generateGapSuggestion } from "./aeoGapSuggestion.service.js";

export async function startGapJob(planId) {
  console.log("🕳️ Running answer gap detection for plan:", planId);

  // 1️⃣ Load prompts
  const { data: prompts, error: promptsError } = await supabase
    .from("aeo_prompts")
    .select("id, prompt")
    .eq("plan_id", planId);

  // ✅ CHECK FOR ERRORS
  if (promptsError) {
    console.error("❌ Failed to load prompts:", promptsError);
    throw promptsError;
  }

  if (!prompts?.length) {
    console.log("ℹ️ No prompts found");
    return;
  }

  console.log(`📊 Found ${prompts.length} prompts`);

  // 2️⃣ Load answered prompts
  const { data: answeredPrompts, error: answersError } = await supabase
    .from("aeo_answers")
    .select("prompt_id")
    .eq("plan_id", planId)
    .not("prompt_id", "is", null); // ✅ Filter nulls explicitly

  // ✅ CHECK FOR ERRORS
  if (answersError) {
    console.error("❌ Failed to load answers:", answersError);
    throw answersError;
  }

  const answeredPromptIds = new Set(
    (answeredPrompts || [])
      .filter(a => a.prompt_id) // ✅ Double filter nulls
      .map(a => String(a.prompt_id)) // ✅ Normalize to string
  );

  console.log(`📊 Found ${answeredPromptIds.size} answered prompts`);

  // ✅ BATCH COLLECT GAPS FIRST (don't insert in loop)
  const gapsToInsert = [];

  for (const p of prompts) {
    const promptIdStr = String(p.id);
    const covered = answeredPromptIds.has(promptIdStr);
    const missing = !covered;

    console.log(`🔍 Prompt ${promptIdStr}: ${missing ? 'MISSING' : 'COVERED'}`);

    // 4️⃣ Check for existing gap record
    const { data: existingGap, error: gapCheckError } = await supabase
      .from("aeo_answer_gaps")
      .select("id")
      .eq("plan_id", planId)
      .eq("prompt_id", p.id)
      .maybeSingle();

    // ✅ CHECK FOR ERRORS
    if (gapCheckError) {
      console.error(`❌ Error checking gap for prompt ${p.id}:`, gapCheckError);
      continue; // Skip this prompt but continue processing
    }

    // ✅ CORRECT NULL CHECK
    if (existingGap !== null) {
      console.log(`⏭️ Gap already exists for prompt ${p.id}`);
      continue;
    }

    // 5️⃣ Generate suggestion
    let suggestion = "Covered by existing content";

    if (missing) {
      try {
        suggestion = await generateGapSuggestion(p.prompt);
        console.log(`💡 Generated suggestion for: ${p.prompt.substring(0, 50)}...`);
      } catch (err) {
        console.error(`⚠️ Failed to generate suggestion:`, err.message);
        suggestion = "Create a dedicated page or section clearly answering this question.";
      }
    }

    // ✅ COLLECT FOR BATCH INSERT
    gapsToInsert.push({
      plan_id: planId,
      prompt_id: p.id,
      missing,
      suggestion,
    });
  }

  // 6️⃣ BATCH INSERT (more efficient + easier to debug)
  if (gapsToInsert.length === 0) {
    console.log("ℹ️ No new gaps to insert");
    return;
  }

  console.log(`📝 Attempting to insert ${gapsToInsert.length} gap records...`);

  const { data: insertedGaps, error: insertError } = await supabase
    .from("aeo_answer_gaps")
    .insert(gapsToInsert)
    .select(); // ✅ Return inserted rows for verification

  if (insertError) {
    console.error("❌ FAILED TO INSERT GAPS:", insertError);
    console.error("Attempted payload:", JSON.stringify(gapsToInsert, null, 2));
    throw insertError;
  }

  console.log(`✅ Answer gap detection completed (${insertedGaps?.length || 0} gaps inserted)`);
  
  // ✅ VERIFICATION
  if (insertedGaps?.length !== gapsToInsert.length) {
    console.warn(`⚠️ WARNING: Attempted ${gapsToInsert.length} inserts but only ${insertedGaps?.length} succeeded`);
  }

  return {
    totalPrompts: prompts.length,
    answeredPrompts: answeredPromptIds.size,
    gapsInserted: insertedGaps?.length || 0,
  };
}