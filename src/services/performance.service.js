export const buildPerformanceTrend = (rows) => {
  const map = {};

  rows.forEach(r => {
    const date = r.keys[0];
    if (!map[date]) {
      map[date] = { date, clicks: 0, impressions: 0 };
    }
    map[date].clicks += r.clicks;
    map[date].impressions += r.impressions;
  });

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
};
