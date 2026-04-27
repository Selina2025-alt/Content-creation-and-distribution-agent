// @vitest-environment node

import { describe, expect, it } from "vitest";

import { generateTaskContentBundle } from "@/lib/content/mock-generation-service";

describe("generateTaskContentBundle", () => {
  it("returns the fixed efficiency fixture when all platforms are selected", async () => {
    const bundle = await generateTaskContentBundle({
      prompt: "写一篇关于如何提高工作效率的内容",
      platforms: ["wechat", "xiaohongshu", "twitter", "videoScript"],
      appliedSkillNamesByPlatform: {}
    });

    expect(bundle.wechat?.title).toBe("高效工作的 5 个底层逻辑");
    expect(bundle.xiaohongshu?.imageSuggestions).toHaveLength(9);
    expect(bundle.xiaohongshu?.imageAssets).toHaveLength(9);
    expect(bundle.twitter?.tweets).toHaveLength(10);
    expect(bundle.videoScript?.scenes).toHaveLength(3);
    expect(bundle.videoScript?.scenes[0]).toMatchObject({
      shot: expect.any(String),
      copy: expect.any(String),
      visual: expect.any(String),
      subtitle: expect.any(String),
      pace: expect.any(String),
      audio: expect.any(String),
      effect: expect.any(String)
    });
  });

  it("returns the same fixture when the efficiency topic includes extra audience guidance", async () => {
    const bundle = await generateTaskContentBundle({
      prompt:
        "写一篇关于如何提高工作效率的内容，面向 25-35 岁知识工作者，风格清晰，有方法论，有案例。",
      platforms: ["wechat", "xiaohongshu", "twitter", "videoScript"],
      appliedSkillNamesByPlatform: {}
    });

    expect(bundle.wechat?.title).toBe("高效工作的 5 个底层逻辑");
    expect(bundle.xiaohongshu?.imageSuggestions).toHaveLength(9);
    expect(bundle.twitter?.tweets).toHaveLength(10);
    expect(bundle.videoScript?.scenes).toHaveLength(3);
    expect(bundle.videoScript?.scenes.every((scene) => scene.copy.trim())).toBe(
      true
    );
  });

  it("uses the built-in Xiaohongshu skill instead of placeholder copy for local fallback", async () => {
    const bundle = await generateTaskContentBundle({
      prompt: "写一篇关于如何学习 AI 的小红书内容",
      platforms: ["xiaohongshu"],
      appliedSkillNamesByPlatform: {}
    });

    expect(bundle.xiaohongshu?.title).not.toContain("草稿");
    expect(bundle.xiaohongshu?.caption).not.toContain("演示流程");
    expect(bundle.xiaohongshu?.caption).toContain("收藏");
    expect(bundle.xiaohongshu?.imageSuggestions).toHaveLength(9);
    expect(bundle.xiaohongshu?.imagePlan?.decision).toContain("决策：Series Mode");
    expect(bundle.xiaohongshu?.imagePlan?.images[0].prompt).toContain(
      "Series 1 of 9"
    );
  });
});
