



import { google } from "googleapis";
import { getValidAccessToken } from "./googleToken.service.js";

export const fetchGSC = async (userId, siteUrl, dimensions) => {
  const accessToken = await getValidAccessToken(userId);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const webmasters = google.webmasters({ version: "v3", auth });

  const today = new Date().toISOString().split("T")[0];

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: "2024-01-01",
      endDate: today,
      dimensions,
      rowLimit: 1000
    }
  });

  return res.data.rows || [];
};
