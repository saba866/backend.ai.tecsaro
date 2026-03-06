import { google } from "googleapis"
import { getValidAccessToken } from "./googleToken.service.js"

export const fetchGAData = async (userId, project) => {
  if (!project.ga_property_id) {
    throw new Error("GA property not selected for this project")
  }

  const token = await getValidAccessToken(userId)

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: token })

  const analytics = google.analyticsdata({ version: "v1beta", auth })

  const response = await analytics.properties.runReport({
    property: `properties/${project.ga_property_id}`,
    requestBody: {
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" }
      ]
    }
  })

  return response.data
}
