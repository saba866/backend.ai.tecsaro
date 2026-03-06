// export function safeJsonParse(text) {
//   try {
//     // already object → return
//     if (typeof text === "object" && text !== null) {
//       return text;
//     }

//     if (typeof text !== "string") {
//       return null;
//     }

//     const cleaned = text
//       .replace(/```json/gi, "")
//       .replace(/```/g, "")
//       .trim();

//     return JSON.parse(cleaned);
//   } catch (err) {
//     console.error("❌ AI JSON parse failed:", err.message);
//     return null;
//   }
// }





export function safeJsonParse(text) {
  if (!text) return null;
  if (typeof text === "object" && text !== null) return text;
  if (typeof text !== "string") return null;

  // 1. Direct parse
  try {
    return JSON.parse(text);
  } catch (_) {}

  // 2. Strip markdown fences
  try {
    const stripped = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(stripped);
  } catch (_) {}

  // 3. Extract first complete { } block
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (_) {}

  // 4. Truncation recovery — find last valid closing brace
  try {
    const start = text.indexOf("{");
    if (start !== -1) {
      let depth = 0;
      let lastValid = -1;
      for (let i = start; i < text.length; i++) {
        if (text[i] === "{") depth++;
        if (text[i] === "}") {
          depth--;
          if (depth === 0) lastValid = i;
        }
      }
      if (lastValid !== -1) {
        return JSON.parse(text.slice(start, lastValid + 1));
      }
    }
  } catch (_) {}

  console.error("❌ AI JSON parse failed: could not recover JSON");
  return null;
}