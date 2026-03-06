import { startMappingJob } from "../../services/aeo/aeoMapping.service.js";
import apiResponse from "../../utils/apiResponse.js";

export const mapPromptsToPages = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return apiResponse(res, 400, "planId required");

    await startMappingJob(planId);
    return apiResponse(res, 200, "Prompt mapping started");
  } catch (err) {
    console.error(err);
    return apiResponse(res, 500, "Failed to start prompt mapping");
  }
};
