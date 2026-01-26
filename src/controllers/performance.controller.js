import { supabase } from "../config/supabase.js";
import { getWebmasters } from "../config/google.js";
import { fetchGSC } from "../services/gsc.service.js";
import { buildPerformanceTrend } from "../services/performance.service.js";

export const getPerformance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    const { data: integration } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "google")
      .single();

    const domain = project.domain.replace(/^https?:\/\//, "");
    const siteUrl = `sc-domain:${domain}`;
    const webmasters = getWebmasters(integration.access_token);

    const rows = await fetchGSC(webmasters, siteUrl, ["date"]);

    const trend = buildPerformanceTrend(rows);

    const totalClicks = rows.reduce((a,b)=>a+b.clicks,0);
    const totalImpr = rows.reduce((a,b)=>a+b.impressions,0);

    res.json({
      summary: {
        clicks: totalClicks,
        impressions: totalImpr,
        ctr: totalImpr ? ((totalClicks/totalImpr)*100).toFixed(2) : 0
      },
      trend
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Performance fetch failed" });
  }
};
