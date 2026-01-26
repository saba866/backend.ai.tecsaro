import axios from "axios";

function normalize(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .trim();
}

export async function detectPlatform(website_url) {
  const cleanDomain = normalize(website_url);

  try {
    const res = await axios.get(`https://${cleanDomain}`, {
      timeout: 12000,
      headers: {
        "User-Agent": "Mozilla/5.0 (SEO-AI-Bot)"
      }
    });

    const html = res.data;
    const headers = res.headers;

    // -------------------
    // CMS / Platform
    // -------------------
    if (/wp-content|wp-includes/.test(html)) return "wordpress";
    if (/cdn\.shopify\.com|shopify\.analytics/.test(html)) return "shopify";
    if (/webflow\.js|data-wf-page/.test(html)) return "webflow";

    // -------------------
    // Framework detection
    // -------------------
    if (/_next\/static|next\.js/.test(html)) return "custom:nextjs";
    if (/ng-version|angular/.test(html)) return "custom:angular";
    if (/__REACT_DEVTOOLS_GLOBAL_HOOK__|react/.test(html)) return "custom:react";
    if (/vue|__VUE__/.test(html)) return "custom:vue";
    if (/svelte/.test(html)) return "custom:svelte";
    if (/nuxt/.test(html)) return "custom:nuxt";
    if (/astro/.test(html)) return "custom:astro";
    if (/vite/.test(html)) return "custom:vite";

    // -------------------
    // Static HTML
    // -------------------
    if (/<html/i.test(html)) return "custom:html";

    return "custom:unknown";

  } catch (e) {
    console.error("Platform detection failed:", e.message);
    return "custom:unknown";
  }
}
