const CREDIBLE_SOURCES = {
  "reuters": 5, "associated press": 5, "ap news": 5, "afp": 5,
  "bbc news": 5, "bbc": 5, "al jazeera english": 4, "al jazeera": 4,
  "the guardian": 4, "the new york times": 4, "financial times": 4,
  "bloomberg": 4, "the washington post": 4, "the economist": 4,
  "foreign affairs": 5, "politico": 4, "cnn": 3, "abc news": 3,
  "nbc news": 3, "cbs news": 3, "france 24": 4, "dw news": 4,
  "the wall street journal": 4,
};

function getCredibility(sourceName) {
  if (!sourceName) return 3;
  const lower = sourceName.toLowerCase().trim();
  for (const [key, score] of Object.entries(CREDIBLE_SOURCES)) {
    if (lower.includes(key) || key.includes(lower)) return score;
  }
  return 3;
}

function guessRegion(title, description) {
  const text = ((title || "") + " " + (description || "")).toLowerCase();
  const regions = {
    "Europe": ["europe", "eu ", "nato", "ukraine", "russia", "germany", "france", "uk ", "britain", "london", "paris", "berlin", "brussels", "poland", "italy", "spain", "sweden", "norway", "finland", "balkans", "kremlin", "moscow"],
    "Asia-Pacific": ["china", "japan", "india", "asia", "pacific", "beijing", "tokyo", "seoul", "korea", "taiwan", "asean", "australia", "philippines", "vietnam", "indonesia", "myanmar", "bangladesh", "pakistan", "sri lanka", "nepal", "singapore", "thailand", "malaysia"],
    "Americas": ["us ", "u.s.", "united states", "america", "canada", "brazil", "mexico", "washington", "congress", "senate", "white house", "pentagon", "latin america", "colombia", "argentina", "venezuela", "chile", "peru", "cuba"],
    "Middle East": ["middle east", "iran", "iraq", "syria", "israel", "palestine", "gaza", "saudi", "yemen", "lebanon", "jordan", "turkey", "ankara", "tehran", "gulf", "qatar", "uae", "dubai", "houthi", "hezbollah", "hamas"],
    "Africa": ["africa", "nigeria", "kenya", "ethiopia", "somalia", "sudan", "congo", "south africa", "egypt", "libya", "morocco", "sahel", "mali", "niger", "chad", "mozambique", "tanzania", "uganda"]
  };
  for (const [region, keywords] of Object.entries(regions)) {
    if (keywords.some(k => text.includes(k))) return region;
  }
  return "Global";
}

function guessTopic(title, description) {
  const text = ((title || "") + " " + (description || "")).toLowerCase();
  const topics = {
    "Conflict & Security": ["war", "attack", "military", "bomb", "missile", "troops", "soldier", "fighting", "conflict", "weapon", "airstrike", "drone", "terror", "security", "defense", "killed", "casualties", "ceasefire", "offensive", "invasion"],
    "Diplomacy": ["diplomat", "summit", "talks", "negotiate", "treaty", "ambassador", "bilateral", "multilateral", "un ", "united nations", "foreign minister", "peace", "agreement", "alliance"],
    "Trade & Sanctions": ["trade", "tariff", "sanction", "export", "import", "economic", "embargo", "ban ", "restrict", "commerce", "supply chain", "market", "oil price", "commodity"],
    "Elections": ["election", "vote", "ballot", "campaign", "poll", "referendum", "democrat", "republican", "parliament", "coalition", "inaugurat"],
    "Climate Policy": ["climate", "carbon", "emission", "renewable", "green", "paris agreement", "cop2", "cop3", "environmental", "sustainability", "fossil fuel", "clean energy"]
  };
  for (const [topic, keywords] of Object.entries(topics)) {
    if (keywords.some(k => text.includes(k))) return topic;
  }
  return "General";
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "NEWSAPI_KEY not configured. Add it in Vercel > Settings > Environment Variables. Get a free key at https://newsapi.org/register"
    });
  }

  try {
    const url = "https://newsapi.org/v2/everything?" + new URLSearchParams({
      q: "geopolitics OR diplomacy OR sanctions OR conflict OR military OR trade war",
      language: "en",
      sortBy: "publishedAt",
      pageSize: "30",
      apiKey: apiKey
    });

    const response = await fetch(url);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errBody?.message || "NewsAPI error " + response.status
      });
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      return res.status(200).json({ articles: [] });
    }

    const articles = data.articles
      .filter(a => a.title && a.title !== "[Removed]" && a.description)
      .map((a, i) => {
        const sourceName = a.source?.name || "Unknown";
        const credibility = getCredibility(sourceName);
        return {
          id: String(i + 1),
          headline: a.title,
          summary: a.description || "",
          body: a.content ? a.content.replace(/\[\+\d+ chars\]/g, "").trim() : a.description || "",
          source: sourceName,
          source_url: a.url || "",
          region: guessRegion(a.title, a.description),
          topic: guessTopic(a.title, a.description),
          timestamp: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
          credibility_score: credibility,
          image_url: a.urlToImage || ""
        };
      })
      .filter(a => a.credibility_score >= 3)
      .slice(0, 15);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ articles });

  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "Failed to fetch news. " + (err.message || "") });
  }
}
