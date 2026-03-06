export function safeAI(result) {
  return {
    summary: result?.summary || "",
    questions: result?.questions || [],
    keywords: result?.keywords || [],
    suggestions: result?.suggestions || [],
  };
}
