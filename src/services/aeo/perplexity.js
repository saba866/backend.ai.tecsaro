import OpenAI from "openai";

// ─────────────────────────────────────────
// PERPLEXITY CLIENT
// Perplexity uses OpenAI-compatible API
// Just different base URL + model
// ─────────────────────────────────────────
const perplexity = new OpenAI({
  apiKey:  process.env.PERPLEXITY_API_KEY,
  baseURL: "https://api.perplexity.ai",
});

// ─────────────────────────────────────────
// PERPLEXITY MODELS
// sonar       → fast, cheap  (starter tier)
// sonar-pro   → best quality (pro tier)
// ─────────────────────────────────────────
const MODELS = {
  starter: "sonar",
  pro:     "sonar-pro",
};

// ─────────────────────────────────────────
// ASK PERPLEXITY
// Returns plain text answer (not JSON)
// Perplexity is a search engine — answers
// are grounded in real web results
// ─────────────────────────────────────────
export async function askPerplexity(prompt, { tier = "starter" } = {}) {
  const model = MODELS[tier] || MODELS.starter;

  try {
    const response = await perplexity.chat.completions.create({
      model,
      messages: [
        {
          role:    "system",
          content: "You are a helpful AI assistant. Answer the user's question clearly and concisely, mentioning relevant tools, platforms, or services where appropriate.",
        },
        {
          role:    "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens:  1000,
    });

    return response.choices[0]?.message?.content || null;

  } catch (err) {
    // Handle specific Perplexity errors
    if (err.status === 401) {
      console.error("❌ Perplexity: Invalid API key");
    } else if (err.status === 429) {
      console.warn("⚠️  Perplexity: Rate limited");
    } else if (err.status === 503) {
      console.warn("⚠️  Perplexity: Service unavailable");
    } else {
      console.error("❌ Perplexity error:", err.message);
    }
    return null;
  }
}