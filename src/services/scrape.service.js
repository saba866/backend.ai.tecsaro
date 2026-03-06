import axios from "axios";
import * as cheerio from "cheerio";

export async function crawlDomain(domain) {
  try {
    const { data } = await axios.get(`https://${domain}`, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(data);

    const headings = [];

    $("h1, h2, h3").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 10) headings.push(text);
    });

    return headings.slice(0, 50);
  } catch (err) {
    console.error("Crawl error:", domain, err.message);
    return [];
  }
}
