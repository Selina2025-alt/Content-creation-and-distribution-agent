// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import {
  generateWechatContent,
  parseWechatContent
} from "@/lib/content/wechat-generation-service";

const originalApiKey = process.env.SILICONFLOW_API_KEY;

describe("wechat generation service", () => {
  afterEach(() => {
    process.env.SILICONFLOW_API_KEY = originalApiKey;
  });

  it("parses fenced json into wechat content", () => {
    const content = parseWechatContent(`\`\`\`json
{
  "title": "公众号标题",
  "summary": "这是一段公众号摘要。",
  "body": "## 正文\\n\\n这是一段公众号正文。"
}
\`\`\``);

    expect(content.title).toBe("公众号标题");
    expect(content.summary).toContain("摘要");
    expect(content.body).toContain("正文");
  });

  it("returns null when SiliconFlow is not configured", async () => {
    delete process.env.SILICONFLOW_API_KEY;

    await expect(
      generateWechatContent({
        prompt: "写一篇关于智能体发展的文章",
        rules: []
      })
    ).resolves.toBeNull();
  });
});
