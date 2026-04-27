import type { WebSearchResult, WebSearchTrace } from "@/lib/types";

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
const FALLBACK_REQUEST_TIMEOUT_MS = 1_500;
const POWERSHELL_TIMEOUT_MS = 20_000;

interface SearchWebForContentInput {
  enabled: boolean;
  prompt: string;
  maxResults?: number;
}

type SearchProvider = {
  name: string;
  search: (query: string, maxResults: number) => Promise<WebSearchResult[]>;
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/&#0183;/g, "·")
    .replace(/&ensp;/g, " ");
}

function stripTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))
  );
}

function normalizeDuckDuckGoUrl(rawUrl: string) {
  const decoded = decodeHtmlEntities(rawUrl);

  try {
    const url = new URL(decoded, "https://duckduckgo.com");
    const redirectTarget = url.searchParams.get("uddg");

    if (redirectTarget) {
      return redirectTarget;
    }

    return url.toString();
  } catch {
    return decoded;
  }
}

function normalizeSearchUrl(rawUrl: string) {
  return decodeHtmlEntities(rawUrl).trim();
}

function extractTopic(prompt: string) {
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();
  const topicMatch = normalizedPrompt.match(
    /(?:\u5173\u4e8e|\u56f4\u7ed5|\u4e3b\u9898\u662f)\s*([^,，.。\n;；!！?？]+?)(?:\u7684(?:\u516c\u4f17\u53f7\u6587\u7ae0|\u516c\u4f17\u53f7\u957f\u6587|\u5c0f\u7ea2\u4e66\u7b14\u8bb0|Twitter\s*\u63a8\u6587|\u63a8\u6587|\u89c6\u9891\u811a\u672c|\u6587\u7ae0|\u5185\u5bb9|\u7a3f\u5b50)|[,，.。\n;；!！?？]|$)/iu
  );
  const candidate =
    topicMatch?.[1] ??
    normalizedPrompt
      .replace(
        /^(?:\u8bf7|\u5e2e\u6211|\u9ebb\u70e6)?\s*(?:\u5199|\u751f\u6210|\u521b\u4f5c|\u64b0\u5199)(?:\u4e00\u7bc7|\u4e00\u4e2a|\u4e00\u6761)?(?:\u5173\u4e8e)?\s*/u,
        ""
      )
      .split(
        /[,，.。\n;；!！?？]|\u8981\u6c42|\u9700\u8981|\u9762\u5411|\u98ce\u683c|\u5b57\u6570/u
      )[0];

  return candidate
    .replace(/^\u5173\u4e8e\s*/u, "")
    .replace(
      /\u7684?(?:\u516c\u4f17\u53f7\u6587\u7ae0|\u516c\u4f17\u53f7\u957f\u6587|\u5c0f\u7ea2\u4e66\u7b14\u8bb0|Twitter\s*\u63a8\u6587|\u63a8\u6587|\u89c6\u9891\u811a\u672c|\u6587\u7ae0|\u5185\u5bb9|\u7a3f\u5b50)$/iu,
      ""
    )
    .trim();
}

function getPromptHints(prompt: string) {
  const hints: string[] = [];

  if (/\u6700\u65b0|\u8d44\u6599|\u7814\u7a76|202\d/u.test(prompt)) {
    hints.push("latest report");
  }

  if (/\u6848\u4f8b|\u4f8b\u5b50|\u5b9e\u8df5/u.test(prompt)) {
    hints.push("case study");
  }

  if (/\u53cd\u65b9|\u4e89\u8bae|\u98ce\u9669|\u6311\u6218|\u5c40\u9650/u.test(prompt)) {
    hints.push("controversy risks");
  }

  return hints;
}

function getEnglishPhrases(value: string) {
  return value.match(/[a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*)*/gi) ?? [];
}

function buildEnglishSearchQuery(topic: string, prompt: string) {
  const englishPhrases = getEnglishPhrases(topic);

  if (englishPhrases.length === 0) {
    return null;
  }

  const mappedTerms = [
    /\u5185\u5bb9\u521b\u4f5c/u.test(prompt) ? "content creation" : "",
    /\u8425\u9500/u.test(prompt) ? "marketing" : "",
    /\u8d8b\u52bf/u.test(prompt) ? "trends" : "",
    ...getPromptHints(prompt)
  ].filter(Boolean);
  const years = topic.match(/20\d{2}/g) ?? [];

  return uniqueValues([...englishPhrases, ...mappedTerms, ...years])
    .join(" ")
    .slice(0, 140);
}

function buildSearchQueries(prompt: string) {
  const topic = extractTopic(prompt);
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();
  const englishSearchQuery = buildEnglishSearchQuery(topic, prompt);
  const hints = getPromptHints(prompt);
  const baseQuery = topic || normalizedPrompt;
  const queries = [
    englishSearchQuery,
    uniqueValues([baseQuery, ...hints]).join(" "),
    uniqueValues([baseQuery, "\u8d8b\u52bf", "\u6848\u4f8b", "\u6700\u65b0"]).join(" ")
  ];

  if (englishSearchQuery?.toLowerCase().includes("ai agent")) {
    queries.push("AI agents content workflows report case study");
    queries.push("AI agent trends enterprise workflows report");
  }

  return uniqueValues(queries.filter((query): query is string => Boolean(query))).map((query) =>
    query.slice(0, 160)
  );
}

function getRelevanceTokens(queries: string[]) {
  const joinedQuery = queries.join(" ");
  const englishAndNumberTokens = joinedQuery.match(/[a-z0-9][a-z0-9-]{1,}/gi) ?? [];
  const knownChineseTerms = [
    "\u4eba\u5de5\u667a\u80fd",
    "\u667a\u80fd\u4f53",
    "\u5185\u5bb9\u521b\u4f5c",
    "\u5de5\u4f5c\u6548\u7387",
    "\u516c\u4f17\u53f7",
    "\u5c0f\u7ea2\u4e66",
    "\u89c6\u9891\u811a\u672c",
    "\u8d8b\u52bf",
    "\u6848\u4f8b"
  ].filter((term) => joinedQuery.includes(term));

  return Array.from(
    new Set([...englishAndNumberTokens, ...knownChineseTerms].map((token) => token.toLowerCase()))
  );
}

function scoreResult(result: WebSearchResult, tokens: string[]) {
  const haystack = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
  const tokenScore = tokens.reduce(
    (total, token) => total + (haystack.includes(token) ? 1 : 0),
    0
  );
  const phraseScore =
    (haystack.includes("ai agent") || haystack.includes("ai agents") || haystack.includes("aiagent")
      ? 3
      : 0) +
    (haystack.includes("content creation") ||
    haystack.includes("\u5185\u5bb9\u521b\u4f5c") ||
    haystack.includes("\u5185\u5bb9\u751f\u4ea7")
      ? 3
      : 0) +
    (haystack.includes("trend") || haystack.includes("\u8d8b\u52bf") ? 2 : 0) +
    (haystack.includes("report") || haystack.includes("\u7814\u7a76") ? 2 : 0) +
    (haystack.includes("case") || haystack.includes("\u6848\u4f8b") ? 2 : 0);

  return tokenScore + phraseScore;
}

function rankResultsByRelevance(
  results: WebSearchResult[],
  queries: string[],
  maxResults: number
): WebSearchResult[] {
  const tokens = getRelevanceTokens(queries);
  const joinedQuery = queries.join(" ").toLowerCase();
  const requiresAiAgent = /\bai agents?\b/.test(joinedQuery) || joinedQuery.includes("aiagent");

  if (tokens.length === 0) {
    return results.slice(0, maxResults);
  }

  const minimumScore = tokens.length <= 4 ? 2 : 4;

  return results
    .map((result, index) => ({
      result,
      index,
      score: scoreResult(result, tokens)
    }))
    .filter((item) => {
      const haystack = `${item.result.title} ${item.result.snippet} ${item.result.url}`.toLowerCase();
      const mentionsAiAgent =
        /\bai agents?\b/.test(haystack) ||
        haystack.includes("aiagent") ||
        haystack.includes("\u667a\u80fd\u4f53");

      return item.score >= minimumScore && (!requiresAiAgent || mentionsAiAgent);
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, maxResults)
    .map((item) => item.result);
}

function dedupeResults(results: WebSearchResult[]) {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = result.url.replace(/\/$/, "").toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parseDuckDuckGoLiteHtml(html: string, maxResults: number): WebSearchResult[] {
  const linkPattern =
    /<a[^>]*class=["'][^"']*result-link[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const snippetPattern =
    /<td[^>]*class=["'][^"']*result-snippet[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi;
  const snippets = Array.from(html.matchAll(snippetPattern)).map((match) =>
    stripTags(match[1] ?? "")
  );

  return Array.from(html.matchAll(linkPattern))
    .slice(0, maxResults)
    .map((match, index) => ({
      title: stripTags(match[2] ?? ""),
      url: normalizeDuckDuckGoUrl(match[1] ?? ""),
      snippet: snippets[index] ?? ""
    }))
    .filter((result) => result.title && result.url);
}

function parseBraveHtml(html: string, maxResults: number): WebSearchResult[] {
  const resultPattern =
    /<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*class=["'][^"']*\bl1\b[^"']*["'][\s\S]*?<div[^>]*class=["'][^"']*title[^"']*["'][^>]*(?:title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/div>\s*<\/a>[\s\S]*?<div[^>]*class=["'][^"']*generic-snippet[^"']*["'][\s\S]*?<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;

  return Array.from(html.matchAll(resultPattern))
    .slice(0, maxResults)
    .map((match) => ({
      title: stripTags(match[2] || match[3] || ""),
      url: normalizeSearchUrl(match[1] ?? ""),
      snippet: stripTags(match[4] ?? "")
    }))
    .filter((result) => result.title && result.url);
}

function normalizeSogouUrl(rawUrl: string) {
  const decoded = decodeHtmlEntities(rawUrl);

  try {
    return new URL(decoded, "https://www.sogou.com").toString();
  } catch {
    return decoded;
  }
}

function parseSogouHtml(html: string, maxResults: number): WebSearchResult[] {
  const resultPattern =
    /<h3[^>]*class=["'][^"']*vr-title[^"']*["'][^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>([\s\S]*?)(?=<h3[^>]*class=["'][^"']*vr-title|$)/gi;

  return Array.from(html.matchAll(resultPattern))
    .slice(0, maxResults)
    .map((match) => {
      const followingBlock = match[3] ?? "";
      const snippetMatch = followingBlock.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

      return {
        title: stripTags(match[2] ?? ""),
        url: normalizeSogouUrl(match[1] ?? ""),
        snippet: stripTags(snippetMatch?.[1] ?? "")
      };
    })
    .filter((result) => result.title && result.url);
}

function extractXmlTag(item: string, tagName: string) {
  const match = item.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  const rawValue = match?.[1] ?? "";

  return stripTags(rawValue.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
}

function parseBingRssXml(xml: string, maxResults: number): WebSearchResult[] {
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;

  return Array.from(xml.matchAll(itemPattern))
    .slice(0, maxResults)
    .map((match) => {
      const item = match[1] ?? "";

      return {
        title: extractXmlTag(item, "title"),
        url: extractXmlTag(item, "link"),
        snippet: extractXmlTag(item, "description")
      };
    })
    .filter((result) => result.title && result.url);
}

async function fetchText(
  url: string,
  headers: Record<string, string>,
  fallbackToPowerShell = false
) {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(
        fallbackToPowerShell ? FALLBACK_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS
      )
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (!fallbackToPowerShell) {
      throw error;
    }

    return fetchTextWithPowerShell(url, headers);
  }
}

async function fetchTextWithPowerShell(url: string, headers: Record<string, string>) {
  if (process.platform !== "win32") {
    throw new Error("PowerShell search fallback is only available on Windows");
  }

  const { execFile } = await import("node:child_process");
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
$headers = @{
  'User-Agent' = $env:CONTENT_AGENT_USER_AGENT
  'Accept-Language' = $env:CONTENT_AGENT_ACCEPT_LANGUAGE
}
$response = Invoke-WebRequest -Uri $env:CONTENT_AGENT_SEARCH_URL -UseBasicParsing -Headers $headers -TimeoutSec 18
[Console]::Write($response.Content)
`;

  return new Promise<string>((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        env: {
          ...process.env,
          CONTENT_AGENT_SEARCH_URL: url,
          CONTENT_AGENT_USER_AGENT: headers["User-Agent"] ?? "Mozilla/5.0",
          CONTENT_AGENT_ACCEPT_LANGUAGE: headers["Accept-Language"] ?? "en-US,en;q=0.9"
        },
        encoding: "utf8",
        maxBuffer: 5 * 1024 * 1024,
        timeout: POWERSHELL_TIMEOUT_MS
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }

        resolve(stdout);
      }
    );
  });
}

async function searchWithDuckDuckGoLite(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const html = await fetchText(
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
    {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    },
    true
  );

  return parseDuckDuckGoLiteHtml(html, maxResults);
}

async function searchWithBraveHtml(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const html = await fetchText(
    `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`,
    {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    },
    true
  );

  return parseBraveHtml(html, maxResults);
}

async function searchWithSogou(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const html = await fetchText(
    `https://www.sogou.com/web?query=${encodeURIComponent(query)}`,
    {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "zh-CN,zh;q=0.9"
    }
  );

  return parseSogouHtml(html, maxResults);
}

async function searchWithBingRss(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const xml = await fetchText(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss&ensearch=1`,
    {
      "User-Agent": "ContentCreationAgent/0.1",
      "Accept-Language": "en-US,en;q=0.9"
    }
  );

  return parseBingRssXml(xml, maxResults);
}

async function searchWithSerper(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.SERPER_API_KEY ?? ""
    },
    body: JSON.stringify({
      q: query,
      num: maxResults
    }),
    signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Serper returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (payload.organic ?? [])
    .map((item) => ({
      title: item.title?.trim() ?? "",
      url: item.link?.trim() ?? "",
      snippet: item.snippet?.trim() ?? ""
    }))
    .filter((result) => result.title && result.url)
    .slice(0, maxResults);
}

async function searchProviderAcrossQueries(
  provider: SearchProvider,
  queries: string[],
  maxResults: number
) {
  const errors: string[] = [];
  const rawResults: WebSearchResult[] = [];

  for (const query of queries) {
    try {
      rawResults.push(...(await provider.search(query, maxResults)));

      const rankedResults = rankResultsByRelevance(
        dedupeResults(rawResults),
        queries,
        maxResults
      );

      if (rankedResults.length >= Math.min(3, maxResults)) {
        return {
          results: rankedResults,
          errors
        };
      }
    } catch (error) {
      errors.push(
        `${query}: ${error instanceof Error ? error.message : "Search failed"}`
      );
    }
  }

  const rankedResults = rankResultsByRelevance(
    dedupeResults(rawResults),
    queries,
    maxResults
  );

  return {
    results: rankedResults,
    errors
  };
}

function getSearchProviders(): SearchProvider[] {
  const providers: SearchProvider[] = [];

  if (process.env.SERPER_API_KEY) {
    providers.push({
      name: "serper",
      search: searchWithSerper
    });
  }

  providers.push(
    {
      name: "sogou-web",
      search: searchWithSogou
    },
    {
      name: "brave-html",
      search: searchWithBraveHtml
    },
    {
      name: "bing-rss",
      search: searchWithBingRss
    },
    {
      name: "duckduckgo-lite",
      search: searchWithDuckDuckGoLite
    }
  );

  return providers;
}

export async function searchWebForContent(
  input: SearchWebForContentInput
): Promise<WebSearchTrace> {
  const queries = buildSearchQueries(input.prompt);
  const query = queries[0] ?? "";
  const maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS;

  if (!input.enabled || !query) {
    return {
      enabled: false,
      provider: "none",
      query,
      queries,
      results: []
    };
  }

  const providers = getSearchProviders();
  const errors: string[] = [];

  for (const provider of providers) {
    const providerResult = await searchProviderAcrossQueries(provider, queries, maxResults);

    if (providerResult.results.length > 0) {
      return {
        enabled: true,
        provider: provider.name,
        query,
        queries,
        results: providerResult.results
      };
    }

    errors.push(
      `${provider.name}: ${
        providerResult.errors.length > 0
          ? providerResult.errors.join("; ")
          : "no relevant usable results"
      }`
    );
  }

  return {
    enabled: true,
    provider: providers.at(-1)?.name ?? "none",
    query,
    queries,
    results: [],
    error: errors.join("; ") || "Search failed"
  };
}
