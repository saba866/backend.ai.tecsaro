// import { runSchemaJob } from "../../jobs/aeoSchema.job.js";

// export async function startSchemaJob(planId) {
//   if (!planId) throw new Error("planId is required");

//   // fire-and-forget
//   setTimeout(() => {
//     runSchemaJob(planId).catch(err =>
//       console.error("❌ Schema job failed:", err.message)
//     );
//   }, 0);

//   return { status: "started" };
// }


// import { runSchemaJob } from "../../jobs/aeoSchema.job.js";

// export async function startSchemaJob(planId) {
//   if (!planId) throw new Error("planId is required");

//   console.log("🧩 Starting schema job for plan:", planId);
//   await runSchemaJob(planId);
//   return { status: "completed" };
// }




// ─────────────────────────────────────────
// aeoSchema.service.js
// ─────────────────────────────────────────
import { supabase } from "../../config/supabase.js";
import { runSchemaJob } from "../../jobs/aeoSchema.job.js";

export async function startSchemaJob(planId) {
  if (!planId) throw new Error("planId is required");
  console.log("🧩 Starting schema job for plan:", planId);
  const result = await runSchemaJob(planId);
  return result || { status: "completed" };
}

// Get all schemas for a plan grouped by page
export async function getSchemasByPlan(planId) {
  const { data, error } = await supabase
    .from("aeo_schemas")
    .select(`
      id,
      schema_type,
      schema_json,
      created_at,
      page_id,
      aeo_pages!aeo_schemas_page_id_fkey (
        id,
        url
      )
    `)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ getSchemasByPlan failed:", error.message);
    return [];
  }

  // Group by page URL
  const grouped = {};
  for (const row of data || []) {
    const url = row.aeo_pages?.url || "unknown";
    if (!grouped[url]) grouped[url] = { url, page_id: row.page_id, schemas: [] };
    grouped[url].schemas.push({
      id:          row.id,
      schema_type: row.schema_type,
      schema_json: row.schema_json,
      created_at:  row.created_at,
    });
  }

  return Object.values(grouped);
}
