// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateTwitterContent,
  parseTwitterContent
} from "@/lib/content/twitter-generation-service";

const originalApiKey = process.env.SILICONFLOW_API_KEY;
const originalBaseUrl = process.env.SILICONFLOW_BASE_URL;
const originalModel = process.env.SILICONFLOW_MODEL;

describe("twitter generation service", () => {
  afterEach(() => {
    process.env.SILICONFLOW_API_KEY = originalApiKey;
    process.env.SILICONFLOW_BASE_URL = originalBaseUrl;
    process.env.SILICONFLOW_MODEL = originalModel;
    vi.restoreAllMocks();
  });

  it("parses over-limit tweets without silently truncating them", () => {
    const overLimitTweet =
      "This draft is intentionally too long because it should be repaired by a dedicated compression pass instead of being cut off mid-thought. ".repeat(
        3
      );

    const content = parseTwitterContent(
      JSON.stringify({
        mode: "thread",
        tweets: [
          "1/3 Start with a real problem, not a tools list.",
          "2/3 Do one small useful task with AI each day.",
          overLimitTweet
        ]
      })
    );

    expect(content.mode).toBe("thread");
    expect(content.tweets).toHaveLength(3);
    expect(content.tweets[2]).toBe(overLimitTweet.trim());
    expect(content.tweets[2].length).toBeGreaterThan(280);
    expect(content.tweets[2]).not.toMatch(/\.\.\.$/u);
  });

  it("uses SiliconFlow to generate a mode-aware tweet or thread when configured", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                mode: "single",
                language: "English",
                tweets: [
                  "The biggest AI learning trap might be treating a bookmarks folder like progress. One small real task a day teaches more than another tool list."
                ]
              })
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const content = await generateTwitterContent({
      language: "English",
      modePreference: "single",
      prompt: "\u5199\u4e00\u7ec4\u5173\u4e8e\u666e\u901a\u4eba\u5982\u4f55\u5b66\u4e60 AI \u7684 Twitter \u5185\u5bb9",
      rules: ["Direct voice with practical method"],
      webSearchResults: [
        {
          title: "AI learning guide",
          url: "https://example.com/ai-learning",
          snippet: "Practice beats tool hoarding."
        }
      ]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const requestBody = JSON.stringify(JSON.parse(String(requestInit?.body)));

    expect(requestBody).toContain("Twitter/X");
    expect(requestBody).toContain("Output language: English");
    expect(requestBody).toContain("The language selector overrides the language used in the user requirement.");
    expect(requestBody).not.toContain("Please generate a publish-ready Twitter/X post in Chinese.");
    expect(requestBody).toContain("Direct voice with practical method");
    expect(requestBody).toContain("https://example.com/ai-learning");
    expect(requestBody).toContain("Single");
    expect(requestBody).toContain("public-clis/twitter-cli");
    expect(requestBody).toContain("twitter search");
    expect(content?.mode).toBe("single");
    expect(content?.language).toBe("English");
    expect(content?.tweets).toHaveLength(1);
    expect(content?.tweets.every((tweet) => tweet.length <= 280)).toBe(true);
  });

  it("repairs English output when the first model response still contains Chinese", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  mode: "thread",
                  language: "English",
                  tweets: [
                    "\u6700\u8fd1\u770b NousResearch \u5f00\u6e90\u7684 Hermes Agent\u3002",
                    "\u611f\u89c9\u5b83\u8ddf\u5e02\u9762\u4e0a\u591a\u6570\u5957\u58f3\u804a\u5929\u673a\u5668\u4eba\u4e0d\u592a\u4e00\u6837\u3002"
                  ]
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  mode: "thread",
                  language: "English",
                  tweets: [
                    "I was looking at NousResearch's open-source Hermes Agent recently.",
                    "It feels less like another chatbot wrapper and more like an attempt to make agents fit into actual workflows."
                  ]
                })
              }
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const content = await generateTwitterContent({
      language: "English",
      modePreference: "thread",
      prompt: "\u5199\u4e00\u7ec4\u5173\u4e8e NousResearch Hermes Agent \u7684\u63a8\u6587",
      rules: []
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallBody = JSON.stringify(
      JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    );

    expect(secondCallBody).toContain("Rewrite these Twitter/X tweets into English.");
    expect(secondCallBody).toContain("Remove all Chinese Han characters");
    expect(content?.language).toBe("English");
    expect(content?.tweets.join("")).not.toMatch(/\p{Script=Han}/u);
  });

  it("repairs over-limit tweets instead of returning a hard-truncated draft", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";

    const tooLongTweet =
      "Just went through the latest Stanford AI Index report. The most striking thing is not the benchmark jump, but the cost and where the models come from. In 2023, 149 foundation models were released. Only 8 came from academia. The rest of the story is still important because ".repeat(
        2
      );
    const repairedTweet =
      "The Stanford AI Index detail that stuck with me is not the benchmark race. It is the cost curve: in 2023, 149 foundation models shipped, and only 8 came from academia.";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  mode: "single",
                  language: "English",
                  tweets: [tooLongTweet]
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  mode: "single",
                  language: "English",
                  tweets: [repairedTweet]
                })
              }
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const content = await generateTwitterContent({
      language: "English",
      modePreference: "single",
      prompt: "Write a tweet about the Stanford AI Index.",
      rules: []
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallBody = JSON.stringify(
      JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    );

    expect(secondCallBody).toContain(
      "Rewrite these Twitter/X tweets so every tweet is a complete thought under 280 characters."
    );
    expect(secondCallBody).toContain("Do not use ellipses");
    expect(content?.tweets).toEqual([repairedTweet]);
    expect(content?.tweets[0].length).toBeLessThanOrEqual(280);
    expect(content?.tweets[0]).not.toContain("The rest");
    expect(content?.tweets[0]).not.toMatch(/\.\.\.$/u);
  });
});
