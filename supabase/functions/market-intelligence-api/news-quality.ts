/**
 * Market Intelligence V3 — conservative, publisher-independent headline quality.
 * Decisions are editorial relevance, NOT verification of an event or its market impact.
 * No external calls: safe to unit test and reuse by RSS ingestion + public feed.
 */
export type NewsHeat = "HOT" | "WARM" | "COLD";
export type ComparableHeadline = {
  title: string;
  publisher?: string | null;
  category?: string | null;
  published_at?: string | null;
};

const preview = /\b(preview|forecast|prediction|predicts?|outlook|analysis|opinion|ahead of|could|might|may|would|should|what if|possible|expects?|expected|awaits?|watch|technical setup|price target)\b/i;
const economic = /\b(cpi|core cpi|ppi|pce|core pce|nfp|nonfarm payrolls|unemployment rate|jobs report|gdp|retail sales|fomc|interest rate|rate decision|inflation data|jobless claims)\b/i;
const decision = /\b(cuts?|cutting|hikes?|hiking|raises?|raised|holds?|held|keeps?|kept|lowers?|lowered|reduces?|reduced|votes?|voted|announces?|announced|approves?|approved|rejects?|rejected|released|reports?|reported)\b/i;
const resultVerb = /\b(rises?|rose|falls?|fell|drops?|dropped|slows?|slowed|accelerates?|accelerated|surges?|surged|jumps?|jumped|climbs?|climbed|contracts?|contracted|expands?|expanded|unexpectedly|surprises?|surprised|misses?|missed|beats?|beat)\b/i;
const geopolitical = /\b(tariffs?|sanctions?|trade ban|embargo|military strikes?|missile attack|war|oil output|oil production|opec)\b/i;
const policyAction = /\b(imposes?|imposed|announces?|announced|signs?|signed|enacts?|enacted|launches?|launched|strikes?|struck|attacks?|attacked|cuts?|cut|halts?|halted|suspends?|suspended|raises?|raised|increases?|increased|reduces?|reduced)\b/i;
const marketTerms = /\b(gold|silver|xauusd|xag|bitcoin|btc|ethereum|eth|crypto|forex|foreign exchange|currency|dollar|usd|yen|jpy|euro|eur|gbp|cad|aud|nzd|chf|dxy|bond|treasury|yield|crude|oil|opec|inflation|federal reserve|fed|ecb|boe|boj|cftc|comex|stocks?|equities|s&p|nasdaq|rates?|tariffs?|sanctions?|etf|cpi|ppi|pce|nfp|gdp|payrolls|economic)\b/i;

/** Do not mistake evergreen tickers or quote pages for breaking news. */
export function isEvergreenListing(title: string): boolean {
  const t = title.toLowerCase();
  return /\blive price,\s*news,\s*chart and price history\b/.test(t) ||
    /\b(real.time|live)\s+(price|quote)\s+chart\s+and\s+historical\s+data\b/.test(t);
}

/** Explicit actions and results can be HOT; speculative analysis is never auto-HOT. */
export function classifyHeadline(title: string, category: string, sourceName = ""): { priority: NewsHeat; reason: string } {
  const t = title.toLowerCase();
  const relevant = marketTerms.test(t) || /^(Gold|Forex|Central Banks|Economic Data|Energy|Crypto)$/i.test(category);
  if (!relevant) return { priority: "COLD", reason: "Low relevance to monitored financial markets" };
  const official = /\b(official|federal reserve|bls|ecb|eia)\b/i.test(sourceName);
  if (!preview.test(t)) {
    if ((economic.test(t) && (decision.test(t) || resultVerb.test(t))) ||
        (geopolitical.test(t) && policyAction.test(t)) ||
        (official && economic.test(t) && /\b(statement|release|decision)\b/i.test(t))) {
      return { priority: "HOT", reason: "Potentially material reported economic or policy development; independent verification required" };
    }
  }
  return { priority: "WARM", reason: preview.test(t) ? "Market-related preview or commentary, not a confirmed release" : "Market-relevant coverage" };
}

const stopWords = new Set(["a","an","and","as","at","be","by","for","from","has","have","in","into","is","it","its","of","on","or","that","the","their","this","to","us","with","after","amid","before","more","than","now","new","latest"]);
const oppositeSets: Array<[string[], string[]]> = [
  [["rise","rises","rose","rising","gain","gains","gained","surge","surges","surged","up","higher","jump","jumps","jumped","rebound","rebounds"],["fall","falls","fell","falling","drop","drops","dropped","decline","declines","declined","lower","down","slump","slumps","slumped","plunge","plunges"]],
  [["cut","cuts","cutting","lower","lowers","reduced","reduce"],["hike","hikes","hiking","raise","raises","raised","increase","increases","increased"]],
  [["approve","approves","approved"],["reject","rejects","rejected","deny","denies","denied"]],
  [["above","over"],["below","under"]]
];

function canonical(title: string, publisher = ""): string {
  let t = title.trim();
  const suffix = publisher.trim();
  if (suffix && t.toLowerCase().endsWith(" - " + suffix.toLowerCase())) t = t.slice(0, -suffix.length - 3);
  return t.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\bxau\s*\/\s*usd\b/g, "xauusd")
    .replace(/\bxag\s*\/\s*usd\b/g, "xagusd")
    .replace(/[^a-z0-9.%]+/g," ").replace(/\s+/g," ").trim();
}
function signature(headline: ComparableHeadline) {
  const raw = canonical(headline.title, headline.publisher || "");
  const words = raw.split(" ").filter(Boolean);
  const tokens = new Set(words.filter(w => w.length >= 3 && !stopWords.has(w)));
  const numbers = new Set(words.filter(w => /\d/.test(w)));
  return { raw, tokens, numbers, words: new Set(words) };
}
function sameSet(a:Set<string>,b:Set<string>): boolean {
  return a.size===b.size && [...a].every(x=>b.has(x));
}
function contradictory(a:Set<string>,b:Set<string>):boolean {
  for(const [pos,neg] of oppositeSets){
    const ap=pos.some(w=>a.has(w)),an=neg.some(w=>a.has(w));
    const bp=pos.some(w=>b.has(w)),bn=neg.some(w=>b.has(w));
    if((ap&&bn)||(an&&bp))return true;
  }
  return false;
}

/** Aggressive merges risk hiding genuine Fed/CPI outcomes. Require very high word overlap. */
export function nearDuplicateHeadline(a: ComparableHeadline,b:ComparableHeadline):boolean {
  if((a.category||"")!==(b.category||""))return false;
  const ta=Date.parse(String(a.published_at||"")),tb=Date.parse(String(b.published_at||""));
  if(!Number.isFinite(ta)||!Number.isFinite(tb)||Math.abs(ta-tb)>6*60*60*1000)return false;
  const x=signature(a),y=signature(b);
  if(x.raw===y.raw)return true;
  if(!sameSet(x.numbers,y.numbers) || contradictory(x.words,y.words))return false;
  if(x.tokens.size<6||y.tokens.size<6)return false;
  const shared=[...x.tokens].filter(w=>y.tokens.has(w)).length;
  const union=x.tokens.size+y.tokens.size-shared;
  const jaccard=shared/union;
  const containment=shared/Math.min(x.tokens.size,y.tokens.size);
  return shared>=6 && (jaccard>=0.86 || (jaccard>=0.76 && containment>=0.96 && shared>=8));
}

/** Preserve the newest item and its source link without changing stored articles. */
export function deduplicateHeadlineFeed<T extends ComparableHeadline>(articles:T[]):T[]{
  const result:T[]=[];
  for(const article of articles){
    if(!result.some(prior=>nearDuplicateHeadline(prior,article)))result.push(article);
  }
  return result;
}
