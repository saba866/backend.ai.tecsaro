// import fetch from "node-fetch";

// const MODEL = "gemini-2.5-flash";
// const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// export async function runGemini(prompt) {
//   try {
//     const res = await fetch(`${ENDPOINT}?key=${process.env.GEMINI_API_KEY}`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         contents: [{ role: "user", parts: [{ text: prompt }] }],
//         generationConfig: {
//           temperature: 0.2,
//           maxOutputTokens: 2048,
//         },
//       }),
//     });

//     const data = await res.json();

//     if (data.error) {
//       console.error("❌ Gemini API error:", data.error.message);
//       return null;
//     }

//     let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
//     if (!text) return null;

//     // ✅ REMOVE MARKDOWN
//     text = text.replace(/```json|```/g, "").trim();

//     return text;
//   } catch (err) {
//     console.error("❌ Gemini request failed:", err.message);
//     return null;
//   }
// }



import fetch from "node-fetch";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function runGemini(prompt) {
  try {
    const res = await fetch(`${ENDPOINT}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json" // 🔥 FIX
        }
      })
    });

    const data = await res.json();
    if (data.error) return null;

    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}
