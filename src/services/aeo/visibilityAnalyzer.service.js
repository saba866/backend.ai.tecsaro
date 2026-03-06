// import { runGemini } from "../gemini.service.js";




// export async function analyzeVisibility(prompt, brandDomain, competitors) {
//   const answer = await runGemini(prompt, { temperature: 0.2 });

//   if (!answer) {
//     return null;
//   }

//   const lowerAnswer = answer.toLowerCase();

//   // 🔹 Clean brand
//   const brand = brandDomain.toLowerCase().replace("www.", "");

//   const brandIndex = lowerAnswer.indexOf(brand);

//   const competitorPositions = competitors.map((c) => {
//     const domain = c.domain.toLowerCase().replace("www.", "");
//     return {
//       domain,
//       position: lowerAnswer.indexOf(domain),
//     };
//   });

//   return {
//     prompt,
//     brand_position: brandIndex >= 0 ? brandIndex : null,
//     competitor_positions: competitorPositions,
//     raw_answer: answer,
//   };
// }






// import { runGemini } from "../gemini.service.js";

// export async function analyzeVisibility(prompt, brandDomain, competitors) {
//   const answer = await runGemini(prompt, { temperature: 0.2 });

//   if (!answer) return null;

//   const lower = answer.toLowerCase();
//   const brand = brandDomain.toLowerCase().replace("www.", "");

//   const brandIndex = lower.indexOf(brand);

//   const competitorPositions = competitors.map(c => {
//     const d = c.domain.toLowerCase().replace("www.", "");
//     return {
//       domain: d,
//       position: lower.indexOf(d)
//     };
//   });

//   /* =========================
//      CLAIM EXTRACTION
//      simple heuristic v1
//   ========================== */

//   const sentences = answer
//     .split(".")
//     .map(s => s.trim())
//     .filter(s => s.length > 30);

//   const claims = sentences.slice(0, 6); // top claims only

//   /* =========================
//      ENTITY EXTRACTION
//      simple heuristic v1
//   ========================== */

//   const entities = [];

//   if (lower.includes("google")) entities.push("google");
//   if (lower.includes("chatgpt")) entities.push("chatgpt");
//   if (lower.includes("schema")) entities.push("schema");
//   if (lower.includes("structured data")) entities.push("structured data");
//   if (lower.includes("citation")) entities.push("citation");
//   if (lower.includes("data")) entities.push("data");
//   if (lower.includes("research")) entities.push("research");

//   return {
//     prompt,
//     brand_position: brandIndex >= 0 ? brandIndex : null,
//     competitor_positions: competitorPositions,
//     claims,
//     entities,
//     raw_answer: answer
//   };
// }




import { runGemini } from "../gemini.service.js";

export async function analyzeVisibility(prompt, brandDomain, competitors, brandName = "") {
  const answer = await runGemini(prompt, { temperature: 0.2 });

  if (!answer) return null;

  const lower = answer.toLowerCase();

  /* =========================
     BRAND DETECTION (SMART)
  ========================== */

  const domain = brandDomain.toLowerCase().replace("www.", "");
  const domainIndex = lower.indexOf(domain);

  const name = brandName.toLowerCase();
  const nameIndex = name ? lower.indexOf(name) : -1;

  const tokens = name.split(" ");
  const tokenHit = tokens.some(t => t && lower.includes(t));

  let brand_position = null;

  if (nameIndex >= 0) brand_position = nameIndex;
  else if (domainIndex >= 0) brand_position = domainIndex;
  else if (tokenHit) brand_position = 9999; // weak presence marker

  /* =========================
     COMPETITOR DETECTION
  ========================== */

  const competitorPositions = competitors.map(c => {
    const d = c.domain.toLowerCase().replace("www.", "");
    const parts = d.split(".");
    const keyword = parts[0];

    return {
      domain: d,
      position: lower.indexOf(d) >= 0
        ? lower.indexOf(d)
        : lower.indexOf(keyword)
    };
  });

  /* =========================
     CLAIM EXTRACTION
  ========================== */

  const sentences = answer
    .split(".")
    .map(s => s.trim())
    .filter(s => s.length > 30);

  const claims = sentences.slice(0, 6);

  /* =========================
     ENTITY EXTRACTION
  ========================== */

  const entities = [];

  if (lower.includes("google")) entities.push("google");
  if (lower.includes("chatgpt")) entities.push("chatgpt");
  if (lower.includes("schema")) entities.push("schema");
  if (lower.includes("structured data")) entities.push("structured data");
  if (lower.includes("citation")) entities.push("citation");
  if (lower.includes("research")) entities.push("research");
  if (lower.includes("data")) entities.push("data");

  return {
    prompt,
    brand_position,
    competitor_positions: competitorPositions,
    claims,
    entities,
    raw_answer: answer
  };
}