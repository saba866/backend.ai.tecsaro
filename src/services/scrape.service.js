// import axios from "axios";
// import * as cheerio from "cheerio";

// export async function crawlDomain(domain) {
//   try {
//     const { data } = await axios.get(`https://${domain}`, {
//       timeout: 10000,
//       headers: {
//         "User-Agent": "Mozilla/5.0",
//       },
//     });

//     const $ = cheerio.load(data);

//     const headings = [];

//     $("h1, h2, h3").each((_, el) => {
//       const text = $(el).text().trim();
//       if (text.length > 10) headings.push(text);
//     });

//     return headings.slice(0, 50);
//   } catch (err) {
//     console.error("Crawl error:", domain, err.message);
//     return [];
//   }
// }





import axios from "axios";
import * as cheerio from "cheerio";

export async function crawlDomain(domain) {
  try {
    const { data } = await axios.get(`https://${domain}`, {
      timeout: 10000,
      headers: {
        "User-Agent":      "TecsaroBot/1.0 (+https://ai.tecsaro.com/bot)",
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection":      "keep-alive",
      },
    });

    const $ = cheerio.load(data);

    const headings = [];
    $("h1, h2, h3").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 10) headings.push(text);
    });

    return {
      success: true,
      data: headings.slice(0, 50),
    };

  } catch (err) {
    const status = err?.response?.status;

    if (status === 403 || status === 503 || status === 520 || status === 521 || status === 522) {
      return {
        success:   false,
        errorType: "CLOUDFLARE_BLOCKED",
        message:   "Your website's Cloudflare is blocking TecsaroBot",
        fix:       "Go to Cloudflare → Security → WAF → Custom Rules → Add: User-Agent contains 'TecsaroBot' → Allow",
        helpLink:  "https://ai.tecsaro.com/help",
      };
    }

    return {
      success:   false,
      errorType: "UNKNOWN",
      message:   err.message,
    };
  }
}