// import { google } from "googleapis"
// import { getValidAccessToken } from "../services/googleToken.service.js"

// export const listGAProperties = async (req, res) => {
//   const token = await getValidAccessToken(req.user.id)

//   const auth = new google.auth.OAuth2()
//   auth.setCredentials({ access_token: token })

//   const admin = google.analyticsadmin("v1alpha")
//   const { data } = await admin.accountSummaries.list()

//   const properties = []

//   data.accountSummaries?.forEach(acc => {
//     acc.propertySummaries?.forEach(p => {
//       properties.push({
//         propertyId: p.property.replace("properties/", ""),
//         displayName: p.displayName
//       })
//     })
//   })

//   res.json(properties)
// }





// import { google } from "googleapis"
// import { getValidAccessToken } from "../services/googleToken.service.js"

// export const listGAProperties = async (req, res) => {
//   try {
//     const token = await getValidAccessToken(req.user.id)

//     const auth = new google.auth.OAuth2()
//     auth.setCredentials({ access_token: token })

//     const analyticsAdmin = google.analyticsadmin({
//       version: "v1beta",
//       auth,
//     })

//     const response = await analyticsAdmin.accountSummaries.list()

//     const properties = []

//     response.data.accountSummaries?.forEach(account => {
//       account.propertySummaries?.forEach(p => {
//         properties.push({
//           propertyId: p.property.split("/")[1],
//           displayName: p.displayName,
//         })
//       })
//     })

//     res.json({ properties })
//   } catch (e) {
//     console.error("GA list error:", e)
//     res.status(500).json({ error: "Failed to fetch GA properties" })
//   }
// }





// import { google } from "googleapis"
// import { getValidAccessToken } from "../services/googleToken.service.js"

// export const listGAProperties = async (req, res) => {
//   try {
//     const accessToken = await getValidAccessToken(req.user.id)

//     const auth = new google.auth.OAuth2()
//     auth.setCredentials({ access_token: accessToken })

//     const analyticsAdmin = google.analyticsadmin({
//       version: "v1beta",
//       auth,
//     })

//     const response = await analyticsAdmin.accountSummaries.list()

//     const properties =
//       response.data.accountSummaries?.flatMap(acc =>
//         acc.propertySummaries?.map(p => ({
//           propertyId: p.property.replace("properties/", ""),
//           displayName: p.displayName,
//         }))
//       ) || []

//     res.json({ properties })
//   } catch (err) {
//     console.error("GA error:", err)
//     res.status(500).json({ error: err.message })
//   }
// }






import { google } from "googleapis"
import { getValidAccessToken } from "../services/googleToken.service.js"

export const listGAProperties = async (req, res) => {
  try {
    const token = await getValidAccessToken(req.user.id)

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token })

    const admin = google.analyticsadmin({
      version: "v1beta",
      auth,
    })

    const response = await admin.accountSummaries.list()

    const properties = []

    response.data.accountSummaries?.forEach(account => {
      account.propertySummaries?.forEach(p => {
        properties.push({
          propertyId: p.property.replace("properties/", ""),
          displayName: p.displayName,
        })
      })
    })

    res.json({ properties })
  } catch (err) {
    console.error("GA PROPERTY ERROR:", err)
    res.status(500).json({ error: err.message })
  }
}
