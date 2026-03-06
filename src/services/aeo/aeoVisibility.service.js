import { runVisibilityJob } from "../../jobs/aeoVisibility.job.js";

export async function startVisibilityJob(planId) {
  if (!planId) {
    throw new Error("planId is required");
  }

  console.log("🔭 Starting visibility service...");
  await runVisibilityJob(planId);
}