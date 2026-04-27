// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import {
  generateVideoScriptContent,
  parseVideoScriptContent
} from "@/lib/content/video-script-generation-service";

const originalApiKey = process.env.SILICONFLOW_API_KEY;

describe("video script generation service", () => {
  afterEach(() => {
    process.env.SILICONFLOW_API_KEY = originalApiKey;
  });

  it("parses a table-shaped video script from fenced json", () => {
    const content = parseVideoScriptContent(`\`\`\`json
{
  "title": "3 分钟短视频脚本",
  "scenes": [
    {
      "shot": "01",
      "copy": "先抛出用户痛点。",
      "visual": "人物面对凌乱桌面。",
      "subtitle": "越忙越乱？",
      "pace": "快节奏",
      "audio": "轻快鼓点",
      "effect": "推近镜头"
    }
  ]
}
\`\`\``);

    expect(content.title).toBe("3 分钟短视频脚本");
    expect(content.scenes[0]).toEqual({
      shot: "01",
      copy: "先抛出用户痛点。",
      visual: "人物面对凌乱桌面。",
      subtitle: "越忙越乱？",
      pace: "快节奏",
      audio: "轻快鼓点",
      effect: "推近镜头"
    });
  });

  it("normalizes legacy voiceover into copy for old scene records", () => {
    const content = parseVideoScriptContent(`{
      "title": "旧版脚本",
      "scenes": [
        {
          "shot": "开场",
          "visual": "人物入画",
          "voiceover": "旧版旁白也要变成文案内容"
        }
      ]
    }`);

    expect(content.scenes[0]).toMatchObject({
      shot: "开场",
      copy: "旧版旁白也要变成文案内容",
      subtitle: "旧版旁白也要变成文案内容",
      pace: "中等节奏",
      audio: "轻背景音乐",
      effect: "基础转场"
    });
  });

  it("returns null when SiliconFlow is not configured", async () => {
    delete process.env.SILICONFLOW_API_KEY;

    await expect(
      generateVideoScriptContent({
        prompt: "写一个 3 分钟视频脚本",
        rules: []
      })
    ).resolves.toBeNull();
  });
});
