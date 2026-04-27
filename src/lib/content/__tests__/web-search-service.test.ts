import { afterEach, describe, expect, it, vi } from "vitest";

import { searchWebForContent } from "@/lib/content/web-search-service";

function braveHtml(
  results: Array<{ title: string; url: string; snippet: string }>
) {
  return `
    <html>
      ${results
        .map(
          (result) => `
            <div class="snippet" data-type="web">
              <a href="${result.url}" class="svelte-14r20fy l1">
                <div class="title search-snippet-title" title="${result.title}">
                  ${result.title}
                </div>
              </a>
              <div class="generic-snippet">
                <div class="content desktop-default-regular">${result.snippet}</div>
              </div>
            </div>
          `
        )
        .join("")}
    </html>
  `;
}

function bingRss(
  results: Array<{ title: string; url: string; snippet: string }>
) {
  return `<?xml version="1.0" encoding="utf-8" ?>
    <rss version="2.0">
      <channel>
        ${results
          .map(
            (result) => `
              <item>
                <title>${result.title}</title>
                <link>${result.url}</link>
                <description>${result.snippet}</description>
              </item>
            `
          )
          .join("")}
      </channel>
    </rss>`;
}

function sogouHtml(
  results: Array<{ title: string; url: string; snippet: string }>
) {
  return `
    <html>
      ${results
        .map(
          (result) => `
            <h3 class="vr-title">
              <a href="${result.url}" target="_blank">${result.title}</a>
            </h3>
            <p class="star-wiki">${result.snippet}</p>
          `
        )
        .join("")}
    </html>
  `;
}

describe("web search service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("extracts no-key Brave results for a focused topic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          braveHtml([
            {
              title: "Harness Engineering guide",
              url: "https://example.com/harness",
              snippet: "A practical explanation of Harness Engineering patterns."
            }
          ])
      }))
    );

    const result = await searchWebForContent({
      enabled: true,
      prompt: "\u5199\u4e00\u7bc7\u5173\u4e8e Harness Engineering \u7684\u6587\u7ae0"
    });

    expect(result.enabled).toBe(true);
    expect(result.provider).toBe("brave-html");
    expect(result.query).toContain("Harness Engineering");
    expect(result.results[0]).toMatchObject({
      title: "Harness Engineering guide",
      url: "https://example.com/harness",
      snippet: "A practical explanation of Harness Engineering patterns."
    });
  });

  it("falls back to Bing RSS when Brave returns no relevant usable sources", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlText = String(url);

      if (urlText.includes("search.brave.com")) {
        return {
          ok: true,
          text: async () =>
            braveHtml([
              {
                title: "Calendar for 2026",
                url: "https://example.com/calendar",
                snippet: "Holidays and public dates."
              }
            ])
        };
      }

      return {
        ok: true,
        text: async () =>
          bingRss([
            {
              title: "AI Agent market report 2026",
              url: "https://example.com/report",
              snippet: "Latest analysis of AI agent adoption and enterprise workflows."
            }
          ])
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchWebForContent({
      enabled: true,
      prompt:
        "\u5199\u4e00\u7bc7\u5173\u4e8e 2026 \u5e74 AI Agent \u5185\u5bb9\u521b\u4f5c\u8d8b\u52bf\u7684\u6587\u7ae0",
      maxResults: 3
    });

    expect(result.provider).toBe("bing-rss");
    expect(result.results[0]).toMatchObject({
      title: "AI Agent market report 2026",
      url: "https://example.com/report",
      snippet: "Latest analysis of AI agent adoption and enterprise workflows."
    });
  });

  it("builds focused query variants and drops irrelevant search results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          braveHtml([
            {
              title: "How to disable a desktop AI assistant",
              url: "https://example.com/unrelated",
              snippet: "A support answer unrelated to content workflows."
            },
            {
              title: "AI Agent content creation trends 2026",
              url: "https://example.com/agent-trends",
              snippet:
                "Fresh report with case studies about AI Agent workflows for content teams."
            }
          ])
      }))
    );

    const result = await searchWebForContent({
      enabled: true,
      prompt:
        "\u5199\u4e00\u7bc7\u5173\u4e8e 2026 \u5e74 AI Agent \u5185\u5bb9\u521b\u4f5c\u8d8b\u52bf\u7684\u516c\u4f17\u53f7\u6587\u7ae0\uff0c\u8981\u6c42\u7ed3\u5408\u6700\u65b0\u8d44\u6599\uff0c\u6709\u6848\u4f8b\uff0c\u6709\u53cd\u65b9\u89c2\u70b9"
    });

    expect(result.query).toBe(
      "AI Agent content creation trends latest report case study controversy risks 2026"
    );
    expect(result.queries).toContain("AI agents content workflows report case study");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      title: "AI Agent content creation trends 2026",
      url: "https://example.com/agent-trends"
    });
  });

  it("keeps AI Agent results ahead of generic case-study matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          sogouHtml([
            {
              title: "SSCI journal list with a real-world case study",
              url: "https://example.com/journals",
              snippet: "General management research and case study material."
            },
            {
              title: "2026 AI Agent trends for content workflows",
              url: "https://example.com/ai-agent-trends",
              snippet: "AI Agent report with workflow examples and content production cases."
            }
          ])
      }))
    );

    const result = await searchWebForContent({
      enabled: true,
      prompt:
        "\u5199\u4e00\u7bc7\u5173\u4e8e 2026 \u5e74 AI Agent \u5185\u5bb9\u521b\u4f5c\u8d8b\u52bf\u7684\u516c\u4f17\u53f7\u6587\u7ae0\uff0c\u8981\u6c42\u7ed3\u5408\u6848\u4f8b"
    });

    expect(result.provider).toBe("sogou-web");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      title: "2026 AI Agent trends for content workflows",
      url: "https://example.com/ai-agent-trends"
    });
  });
});
