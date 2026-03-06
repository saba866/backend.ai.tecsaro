/**
 * Convert domain → readable brand name
 * peec.ai → Peec AI
 * tryprofound.com → Profound
 */
export function domainToBrandName(domain = "") {
  if (!domain) return "";

  const clean = domain
    .replace("https://", "")
    .replace("http://", "")
    .replace("www.", "")
    .toLowerCase();

  const root = clean.split(".")[0];

  const prefixes = ["try", "get", "use", "my", "go", "the", "app"];
  let name = root;

  for (const p of prefixes) {
    if (name.startsWith(p) && name.length > p.length + 2) {
      name = name.slice(p.length);
      break;
    }
  }

  name = name.charAt(0).toUpperCase() + name.slice(1);

  const tld = clean.split(".").pop();
  if (tld === "ai" && !name.toLowerCase().includes("ai")) {
    name += " AI";
  }

  return name;
}

export function generateAliases(name = "", domain = "") {
  const aliases = new Set();

  const root = domain.split(".")[0];
  if (root) aliases.add(root.toLowerCase());

  const short = name.replace(/ AI$/i, "").trim();
  if (short && short !== name) aliases.add(short);

  return [...aliases];
}