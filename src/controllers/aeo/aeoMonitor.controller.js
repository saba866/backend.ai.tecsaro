import { runAeoMonitorJob } from "../../jobs/aeoMonitor.job.js";
import apiResponse from "../../utils/apiResponse.js";

export const startAeoMonitor = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return apiResponse(res, 400, "planId required");

    runAeoMonitorJob(planId); // fire & forget
    return apiResponse(res, 200, "AEO monitoring started");
  } catch (err) {
    console.error(err);
    return apiResponse(res, 500, "AEO monitoring failed");
  }
};
