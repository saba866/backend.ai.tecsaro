export const generateAIInsights = (data) => {
  const insights = [];

  data.keywords.forEach(k => {
    if (k.impressions > 1000 && k.ctr < 1)
      insights.push(`Improve CTR for keyword: ${k.keys[0]}`);
  });

  return insights;
};
