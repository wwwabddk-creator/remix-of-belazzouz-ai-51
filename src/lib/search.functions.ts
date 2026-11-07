import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ q: z.string().min(1).max(500) });

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;          // provider id (e.g. "searxng:searx.be", "ddg", "wikipedia")
  domain: string;          // host of url
  score: number;           // 0..1 evidence weight
  corroborations: number;  // # of distinct providers that returned this domain
};

export type WebSearchOutput = {
  results: WebSearchResult[];
  summary: string;          // formatted, numbered, with score badges
  confidence: number;       // 0..1 aggregated confidence
  providersUsed: string[];
};

// Pool of free, key-less SearXNG instances.
const SEARXNG_INSTANCES = [
  "https://searx.be",
  "https://search.brave4u.com",
  "https://priv.au",
  "https://searx.tiekoetter.com",
  "https://search.inetol.net",
  "https://searx.work",
  "https://opnxng.com",
  "https://baresearch.org",
  "https://northboot.xyz",
];

// Domains we give a small authority boost — encyclopedic / standards / docs.
const AUTHORITY_BOOST: Record<string, number> = {
  "wikipedia.org": 0.25,
  "britannica.com": 0.2,
  "nature.com": 0.2,
  "science.org": 0.2,
  "nih.gov": 0.25,
  "who.int": 0.25,
  "nasa.gov": 0.25,
  "europa.eu": 0.2,
  "un.org": 0.2,
  "reuters.com": 0.15,
  "apnews.com": 0.15,
  "bbc.com": 0.12,
  "bbc.co.uk": 0.12,
  "developer.mozilla.org": 0.2,
  "stackoverflow.com": 0.12,
  "github.com": 0.1,
  "arxiv.org": 0.18,
  "ieee.org": 0.18,
  "acm.org": 0.18,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

function hostOf(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return "";
  }
}

function rootDomain(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  return parts.slice(-2).join(".");
}

const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","of","in","on","at",
  "to","for","with","by","and","or","but","not","no","do","does","did","how",
  "what","why","when","where","who","whom","which","that","this","these","those",
  "it","its","as","from","about","into","than","then","so","can","could","would",
  "should","will","may","might","i","you","he","she","we","they","me","my","your",
  "هل","ما","ماذا","لماذا","كيف","متى","أين","من","إلى","في","على","عن","و","أو",
  "هذا","هذه","ذلك","تلك","هو","هي","هم","نحن","انت","أنت","لا","نعم","مع","بين",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[<>"'`]/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function overlapScore(queryTokens: Set<string>, text: string): number {
  if (!queryTokens.size) return 0;
  const tokens = tokenize(text);
  if (!tokens.length) return 0;
  let hits = 0;
  const seen = new Set<string>();
  for (const t of tokens) {
    if (queryTokens.has(t) && !seen.has(t)) {
      seen.add(t);
      hits++;
    }
  }
  return hits / queryTokens.size; // 0..1
}

type RawHit = Omit<WebSearchResult, "score" | "corroborations">;

async function trySearxng(instance: string, q: string): Promise<RawHit[]> {
  const r = await withTimeout(
    fetch(`${instance}/search?q=${encodeURIComponent(q)}&format=json&safesearch=1`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    }),
    7000,
  );
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = (await r.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
  const out: RawHit[] = (j.results || [])
    .slice(0, 8)
    .map((x) => {
      const url = x.url || "";
      return {
        title: (x.title || "").slice(0, 140),
        url,
        snippet: (x.content || "").slice(0, 320),
        source: `searxng:${hostOf(instance)}`,
        domain: hostOf(url),
      };
    })
    .filter((x) => x.url && x.title && x.domain);
  if (!out.length) throw new Error("empty");
  return out;
}

async function tryDuckDuckGo(q: string): Promise<RawHit[]> {
  const r = await withTimeout(
    fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`),
    6000,
  );
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = (await r.json()) as {
    AbstractText?: string; AbstractURL?: string; Heading?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
  };
  const hits: RawHit[] = [];
  if (j.AbstractText && j.AbstractURL) {
    hits.push({
      title: j.Heading || "Summary",
      url: j.AbstractURL,
      snippet: j.AbstractText.slice(0, 320),
      source: "ddg",
      domain: hostOf(j.AbstractURL),
    });
  }
  const flat = (j.RelatedTopics || []).flatMap((x) => x.Topics || [x]);
  for (const t of flat.slice(0, 8)) {
    if (t.Text && t.FirstURL) {
      hits.push({
        title: t.Text.split(" - ")[0].slice(0, 120),
        url: t.FirstURL,
        snippet: t.Text.slice(0, 320),
        source: "ddg",
        domain: hostOf(t.FirstURL),
      });
    }
  }
  if (!hits.length) throw new Error("empty");
  return hits;
}

async function tryWikipedia(q: string): Promise<RawHit[]> {
  const r = await withTimeout(
    fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srsearch=${encodeURIComponent(q)}&srlimit=5`),
    6000,
  );
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = (await r.json()) as { query?: { search?: Array<{ title: string; snippet: string }> } };
  const hits: RawHit[] = (j.query?.search || []).map((s) => {
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`;
    return {
      title: s.title,
      url,
      snippet: s.snippet.replace(/<[^>]+>/g, "").slice(0, 320),
      source: "wikipedia",
      domain: "wikipedia.org",
    };
  });
  if (!hits.length) throw new Error("empty");
  return hits;
}

function authorityBoost(domain: string): number {
  const root = rootDomain(domain);
  if (AUTHORITY_BOOST[root]) return AUTHORITY_BOOST[root];
  if (root.endsWith(".gov") || root.endsWith(".edu")) return 0.2;
  if (root.endsWith(".org")) return 0.05;
  return 0;
}

export const webSearch = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }): Promise<WebSearchOutput> => {
    const q = data.q;
    const qTokens = new Set(tokenize(q));

    // Fan out to multiple providers in parallel. Use 3 random SearXNG instances + DDG + Wikipedia.
    const searxPicks = shuffle(SEARXNG_INSTANCES).slice(0, 3);
    const attempts: Array<{ id: string; run: () => Promise<RawHit[]> }> = [
      ...searxPicks.map((inst) => ({ id: `searxng:${hostOf(inst)}`, run: () => trySearxng(inst, q) })),
      { id: "ddg", run: () => tryDuckDuckGo(q) },
      { id: "wikipedia", run: () => tryWikipedia(q) },
    ];

    const settled = await Promise.allSettled(attempts.map((a) => a.run()));
    const providersUsed: string[] = [];
    const raw: RawHit[] = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled" && s.value.length) {
        providersUsed.push(attempts[i].id);
        raw.push(...s.value);
      }
    });

    // Fallback: if parallel fan-out got nothing, sequentially try the rest of the SearXNG pool.
    if (!raw.length) {
      const remaining = SEARXNG_INSTANCES.filter((i) => !searxPicks.includes(i));
      for (const inst of remaining) {
        try {
          const hits = await trySearxng(inst, q);
          providersUsed.push(`searxng:${hostOf(inst)}`);
          raw.push(...hits);
          break;
        } catch { /* keep trying */ }
      }
    }

    if (!raw.length) {
      return { results: [], summary: "", confidence: 0, providersUsed: [] };
    }

    // Dedupe by URL while tracking distinct provider corroboration per domain.
    const byUrl = new Map<string, RawHit>();
    const domainProviders = new Map<string, Set<string>>();
    for (const h of raw) {
      if (!byUrl.has(h.url)) byUrl.set(h.url, h);
      if (!domainProviders.has(h.domain)) domainProviders.set(h.domain, new Set());
      domainProviders.get(h.domain)!.add(h.source);
    }

    // Score each unique hit.
    const scored: WebSearchResult[] = [];
    for (const h of byUrl.values()) {
      const corroborations = domainProviders.get(h.domain)?.size ?? 1;
      const titleOverlap = overlapScore(qTokens, h.title);
      const snipOverlap = overlapScore(qTokens, h.snippet);
      const lengthSignal = Math.min(h.snippet.length / 240, 1) * 0.1;
      const corrSignal = Math.min((corroborations - 1) * 0.18, 0.45);
      const authority = authorityBoost(h.domain);
      const raw01 =
        0.45 * titleOverlap +
        0.3 * snipOverlap +
        corrSignal +
        authority +
        lengthSignal;
      const score = Math.max(0, Math.min(1, raw01));
      scored.push({ ...h, score, corroborations });
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 6);

    // Aggregate confidence: top-result weight + provider diversity + corroboration count.
    const providerDiversity = Math.min(providersUsed.length / 4, 1); // 4+ providers => max
    const topScore = top[0]?.score ?? 0;
    const meanTop3 = top.slice(0, 3).reduce((s, r) => s + r.score, 0) / Math.max(1, Math.min(3, top.length));
    const maxCorr = Math.min((Math.max(...top.map((t) => t.corroborations), 1) - 1) / 3, 1);
    const confidence = Math.max(
      0,
      Math.min(1, 0.45 * meanTop3 + 0.2 * topScore + 0.2 * providerDiversity + 0.15 * maxCorr),
    );

    const summary = top
      .slice(0, 4)
      .map((x, i) => {
        const pct = Math.round(x.score * 100);
        const corr = x.corroborations > 1 ? ` (corroborated ×${x.corroborations})` : "";
        return `[${i + 1}] (${x.domain}, conf ${pct}%${corr}) ${x.title}: ${x.snippet}`;
      })
      .join("\n");

    return { results: top, summary, confidence, providersUsed };
  });
