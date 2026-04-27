// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import { buildTaskGenerationTrace } from "@/lib/content/task-generation-trace";

const originalApiKey = process.env.SILICONFLOW_API_KEY;
const originalModel = process.env.SILICONFLOW_MODEL;
const originalImageModel = process.env.SILICONFLOW_IMAGE_MODEL;

describe("task generation trace", () => {
  afterEach(() => {
    process.env.SILICONFLOW_API_KEY = originalApiKey;
    process.env.SILICONFLOW_MODEL = originalModel;
    process.env.SILICONFLOW_IMAGE_MODEL = originalImageModel;
  });

  it("shows the configured image model when Xiaohongshu image generation is enabled", () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";
    process.env.SILICONFLOW_IMAGE_MODEL = "Qwen/Qwen-Image-Edit-2509";

    const trace = buildTaskGenerationTrace({
      prompt: "写一篇小红书 AI 学习笔记",
      platforms: ["xiaohongshu"],
      skills: []
    });

    expect(trace.providerLabel).toContain("Qwen/Qwen-Image-Edit-2509");
    expect(trace.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "image-generate",
          label: "生成小红书配图"
        })
      ])
    );
  });

  it("treats Twitter as model-backed when SiliconFlow is configured", () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";
    delete process.env.SILICONFLOW_IMAGE_MODEL;

    const trace = buildTaskGenerationTrace({
      prompt: "写一组关于 AI 学习的 Twitter Thread",
      platforms: ["twitter"],
      skills: []
    });

    expect(trace.providerLabel).toBe("SiliconFlow · Pro/zai-org/GLM-4.7");
    expect(trace.methodLabel).toBe("Twitter 结构化生成");
    expect(trace.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "twitter-built-in-skill",
          label: "内置 Twitter Research + Voice Skill",
          detail: expect.stringContaining("public-clis/twitter-cli")
        })
      ])
    );
  });
});
