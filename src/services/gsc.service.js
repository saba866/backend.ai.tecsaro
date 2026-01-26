// import { google } from "googleapis";

// export const getGSCData = async (accessToken, siteUrl) => {
//   const auth = new google.auth.OAuth2();
//   auth.setCredentials({ access_token: accessToken });

//   const webmasters = google.webmasters({ version: "v3", auth });

//   const res = await webmasters.searchanalytics.query({
//     siteUrl,
//     requestBody: {
//       startDate: "2024-01-01",
//       endDate: new Date().toISOString().split("T")[0],
//       dimensions: ["query"],
//       rowLimit: 10,
//     },
//   });

//   return res.data.rows || [];
// };




export const fetchGSC = async (webmasters, siteUrl, dimensions) => {
  const today = new Date().toISOString().split("T")[0];

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: "2024-1-1",
      endDate: today,
      dimensions,
      rowLimit: 1000,
    },
  });

  return res.data.rows || [];
};
