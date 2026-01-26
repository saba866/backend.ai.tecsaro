// import { supabase } from "../config/supabase.js";
// import { google } from "googleapis";

// export const getOverviewData = async (req, res) => {
//   try {
//     const { projectId } = req.params;
//     const userId = req.user.id;

//     /* =========================
//        1. GET PROJECT
//     ========================= */
//     const { data: project } = await supabase
//       .from("projects")
//       .select("*")
//       .eq("id", projectId)
//       .eq("user_id", userId)
//       .single();

//     if (!project) {
//       return res.status(404).json({ error: "Project not found" });
//     }

//     /* =========================
//        2. GET GOOGLE TOKEN
//     ========================= */
//     const { data: integration } = await supabase
//       .from("user_integrations")
//       .select("*")
//       .eq("user_id", userId)
//       .eq("provider", "google")
//       .single();

//     if (!integration) {
//       return res.status(400).json({ error: "Google not connected" });
//     }

//     /* =========================
//        3. GOOGLE AUTH
//     ========================= */
//     const auth = new google.auth.OAuth2();
//     auth.setCredentials({
//       access_token: integration.access_token,
//     });

//     const webmasters = google.webmasters({
//       version: "v3",
//       auth,
//     });

//     /* =========================
//        4. PREPARE SITE URL
//     ========================= */
//     const domain = project.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

//     const urlProperty = `https://${domain}/`;
//     const domainProperty = `sc-domain:${domain}`;

//     const today = new Date().toISOString().split("T")[0];

//     /* =========================
//        5. TRY BOTH PROPERTY TYPES
//     ========================= */
//     let rows = [];

//     try {
//       const resUrl = await webmasters.searchanalytics.query({
//         siteUrl: urlProperty,
//         requestBody: {
//           startDate: "2024-01-01",
//           endDate: today,
//           dimensions: ["query"],
//           rowLimit: 5,
//         },
//       });
//       rows = resUrl.data.rows || [];
//     } catch (err) {
//       console.warn("URL property failed, trying domain property");

//       const resDomain = await webmasters.searchanalytics.query({
//         siteUrl: domainProperty,
//         requestBody: {
//           startDate: "2024-01-01",
//           endDate: today,
//           dimensions: ["query"],
//           rowLimit: 5,
//         },
//       });

//       rows = resDomain.data.rows || [];
//     }

//     /* =========================
//        6. METRICS
//     ========================= */
//     const totalClicks = rows.reduce((a, b) => a + b.clicks, 0);
//     const totalImpressions = rows.reduce((a, b) => a + b.impressions, 0);

//     const ctr =
//       totalImpressions > 0
//         ? ((totalClicks / totalImpressions) * 100).toFixed(2)
//         : 0;

//     const position =
//       rows.length > 0
//         ? (
//             rows.reduce((a, b) => a + b.position, 0) / rows.length
//           ).toFixed(2)
//         : 0;

//     /* =========================
//        7. RESPONSE
//     ========================= */
//     res.json({
//       project,
//       metrics: {
//         clicks: totalClicks,
//         impressions: totalImpressions,
//         ctr,
//         position,
//       },
//       topQueries: rows,
//     });
//   } catch (error) {
//     console.error("OVERVIEW ERROR:", error.errors || error.message);
//     res.status(500).json({ error: "Overview fetch failed" });
//   }
// };






import { supabase } from "../config/supabase.js";
import { google } from "googleapis";

const fetchGSC = async (webmasters, siteUrl, dimensions) => {
  const today = new Date().toISOString().split("T")[0];
  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: "2024-01-01",
      endDate: today,
      dimensions,
      rowLimit: 100,
    },
  });
  return res.data.rows || [];
};

export const getOverviewData = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Project
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (!project) return res.status(404).json({ error: "Project not found" });

    // Google token
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "google")
      .single();

    if (!integration) return res.status(400).json({ error: "Google not connected" });

    // Auth
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: integration.access_token });
    const webmasters = google.webmasters({ version: "v3", auth });

    // Site URL
    const domain = project.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const siteUrl = `sc-domain:${domain}`;

    // Fetch all sections
    const [
      keywords,
      pages,
      geo,
      devices,
      appearance,
      performance
    ] = await Promise.all([
      fetchGSC(webmasters, siteUrl, ["query"]),
      fetchGSC(webmasters, siteUrl, ["page"]),
      fetchGSC(webmasters, siteUrl, ["country"]),
      fetchGSC(webmasters, siteUrl, ["device"]),
      fetchGSC(webmasters, siteUrl, ["searchAppearance"]),
      fetchGSC(webmasters, siteUrl, ["date"]),
    ]);

    // Summary
    const clicks = keywords.reduce((a, b) => a + b.clicks, 0);
    const impressions = keywords.reduce((a, b) => a + b.impressions, 0);

    const summary = {
      clicks,
      impressions,
      ctr: impressions ? ((clicks / impressions) * 100).toFixed(2) : 0,
      position:
        keywords.length > 0
          ? (
              keywords.reduce((a, b) => a + b.position, 0) / keywords.length
            ).toFixed(2)
          : 0,
    };

    // Indexing & sitemaps
    const indexing = await webmasters.sites.get({ siteUrl });
    const sitemaps = await webmasters.sitemaps.list({ siteUrl });

    res.json({
      project,
      summary,
      performance,
      keywords,
      pages,
      geo,
      devices,
      appearance,
      indexing: indexing.data,
      sitemaps: sitemaps.data.sitemap || [],
      aiInsights: [
        "Optimize top pages with low CTR",
        "Improve titles for queries ranking 4–10",
        "Add schema for rich results",
        "Improve mobile page speed",
      ],
    });
  } catch (err) {
    console.error("OVERVIEW ERROR:", err.message);
    res.status(500).json({ error: "Overview fetch failed" });
  }
};




