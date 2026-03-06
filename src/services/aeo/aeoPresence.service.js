


import { supabase } from "../../config/supabase.js";

export function calculatePresenceMetrics(rows = []) {

  if (!rows.length) {
    return {
      brand_presence: 0,
      competitor_presence: [],
      win_loss: { wins: 0, losses: 0, shared: 0, missed: 0 },
      total_prompts: 0
    };
  }

  const grouped = {};

  for (const r of rows) {
    const key = r.answer_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  let wins = 0, losses = 0, shared = 0, missed = 0;
  let brandCount = 0;
  const compCounts = {};

  for (const mentions of Object.values(grouped)) {

    const brand = mentions.find(
      m => m.entity_type === "brand" && m.mentioned
    );

    const competitors = mentions.filter(
      m => m.entity_type === "competitor" && m.mentioned
    );

    if (brand) brandCount++;

    competitors.forEach(c => {
      compCounts[c.entity_name] =
        (compCounts[c.entity_name] || 0) + 1;
    });

    if (brand && competitors.length === 0) wins++;
    else if (!brand && competitors.length > 0) losses++;
    else if (brand && competitors.length > 0) shared++;
    else missed++;
  }

  const total = Object.keys(grouped).length;

  return {
    brand_presence: total ? brandCount / total : 0,
    competitor_presence: Object.entries(compCounts).map(([name, count]) => ({
      name,
      rate: count / total
    })),
    win_loss: { wins, losses, shared, missed },
    total_prompts: total
  };
}