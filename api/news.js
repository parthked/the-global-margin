// /api/news.js — Vercel Serverless Function
// Fetches geopolitical news from GNews.io (free, no Anthropic needed)

const CREDIBLE_SOURCES = [
  "reuters", "associated press", "afp", "bbc", "al jazeera", "the guardian",
  "new york times", "nyt", "financial times", "bloomberg", "washington post",
  "the economist", "politico", "foreign affairs", "cnn", "npr", "abc news",
  "cbs news", "nbc news", "france 24", "dw", "sky news", "ap news",
  "the hill", "axios", "time", "newsweek", "the telegraph", "the independent"
];

function getCredibilityScore(sourceName) {
  const s = (sourceName || "").toLowerCase();
  const tier1 = ["reuters", "associated press", "ap news", "afp", "bbc"];
  const tier2 = ["the guardian", "new york times", "nyt", "financial times", "bloomberg", "washington post", "the economist"];
  if (tier1.some(t => s.includes(t))) return 5;
  if (tier2.some(t => s.includes(t))) return 4;
  if (CREDIBLE_SOURCES.some(t => s.includes(t))) return 3;
  return 2;
}

function classifyRegion(title, description) {
  const text = ((title || "") + " " + (description || "")).toLowerCase();
  if (/europe|eu\b|nato|ukraine|russia|germany|france|uk\b|britain|london|paris|berlin|brussels|poland|italy/i.test(text)) return "Europe";
  if (/china|japan|india|asia|pacific|korea|taiwan|australia|asean|beijing|tokyo|delhi|sydney/i.test(text)) return "Asia-Pacific";
  if (/america|us\b|usa|biden|trump|congress|canada|brazil|mexico|latin|washington|pentagon/i.test(text)) return "Americas";
  if (/middle east|israel|iran|gaza|palestine|saudi|syria|iraq|lebanon|yemen|jordan|egypt/i.test(text)) return "Middle East";
  if (/africa|nigeria|kenya|south africa|ethiopia|congo|sudan|sahel|mali|somalia/i.test(text)) return "Africa";
  return "Global";
}

function classifyTopic(title, description) {
  const text = ((title || "") + " " + (description || "")).toLowerCase();
  if (/war\b|conflict|military|attack|bomb|missile|troops|army|weapon|strike|combat|battle|security|terrorism|terror/i.test(text)) return "Conflict & Security";
  if (/diplomacy|diplomatic|summit|talks|negotiations|treaty|ambassador|un\b|united nations|bilateral|peace/i.test(text)) return "Diplomacy";
  if (/trade|tariff|sanction|economic|economy|import|export|deal|commerce|investment|gdp|market/i.test(text)) return "Trade & Sanctions";
  if (/election|vote|voting|ballot|campaign|poll|candidate|democrat|republican|parliament|referendum/i.test(text)) return "Elections";
  if (/climate|carbon|emission|environment|green|renewable|cop\d|paris agreement|sustainability|warming/i.test(text)) return "Climate Policy";
  return "General";
}

export default async function handler(req, res) {
  const apiKey = process.env.GNEWS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GNEWS_API_KEY not configured. Add it in Vercel → Settings → Environment Variables. Get a free key at https://gnews.io"
    });
  }

  try {
    // Fetch geopolitical news from GNews
    const queries = [
      "geopolitics world affairs",
      "international relations diplomacy",
      "war conflict security"
    ];

    const allArticles = [];

    for (const q of queries) {
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&sortby=publishedAt&max=10&apikey=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errText = await response.text();
        console.error("GNews error:", response.status, errText);
        continue;
      }

      const data = await response.json();
      if (data.articles) {
        allArticles.push(...data.articles);
      }
    }

    // Also fetch top headlines in "world" category
    const topUrl = `https://gnews.io/api/v4/top-headlines?category=world&lang=en&max=10&apikey=${apiKey}`;
    const topRes = await fetch(topUrl);
    if (topRes.ok) {
      const topData = await topRes.json();
      if (topData.articles) allArticles.push(...topData.articles);
    }

    // Deduplicate by title
    const seen = new Set();
    const unique = allArticles.filter(a => {
      const key = (a.title || "").toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Transform to our format, score credibility, filter
    const transformed = unique
      .map((a, i) => ({
        id: String(i + 1),
        headline: a.title || "Untitled",
        summary: a.description || "",
        body: a.content || a.description || "",
        source: a.source?.name || "Unknown",
        source_url: a.url || "",
        image: a.image || "",
        region: classifyRegion(a.title, a.description),
        topic: classifyTopic(a.title, a.description),
        timestamp: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric"
        }) : "",
        credibility_score: getCredibilityScore(a.source?.name)
      }))
      .filter(a => a.credibility_score >= 2) // Keep reasonably credible sources
      .sort((a, b) => b.credibility_score - a.credibility_score) // Best sources first
      .slice(0, 15); // Cap at 15

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ articles: transformed });

  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "Failed to fetch news. " + (err.message || "") });
  }
}
