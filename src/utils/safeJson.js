export function safeJsonParse(text) {
  if (!text) return null;

  try {
    if (typeof text === "object") return text;

    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  } catch {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;

      const fixed = match[0]
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");

      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}
