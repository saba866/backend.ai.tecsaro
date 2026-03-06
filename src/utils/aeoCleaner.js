export const cleanContent = (text) => {
  return text
    .replace(/\s+/g, " ")
    .replace(/cookie|privacy|terms/gi, "")
    .trim();
};
