// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateXiaohongshuContent,
  parseXiaohongshuContent
} from "@/lib/content/xiaohongshu-generation-service";

const originalApiKey = process.env.SILICONFLOW_API_KEY;
const originalBaseUrl = process.env.SILICONFLOW_BASE_URL;
const originalModel = process.env.SILICONFLOW_MODEL;
const originalImageModel = process.env.SILICONFLOW_IMAGE_MODEL;
const originalImageLimit = process.env.SILICONFLOW_IMAGE_LIMIT;
const originalDataRoot = process.env.CONTENT_CREATION_AGENT_DATA_ROOT;

describe("xiaohongshu generation service", () => {
  const dataRoot = path.join(process.cwd(), ".codex-data-tests", "xiaohongshu-generation");

  afterEach(() => {
    process.env.SILICONFLOW_API_KEY = originalApiKey;
    process.env.SILICONFLOW_BASE_URL = originalBaseUrl;
    process.env.SILICONFLOW_MODEL = originalModel;
    process.env.SILICONFLOW_IMAGE_MODEL = originalImageModel;
    process.env.SILICONFLOW_IMAGE_LIMIT = originalImageLimit;
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = originalDataRoot;
    rmSync(dataRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("parses generated note copy and creates nine image assets", () => {
    const content = parseXiaohongshuContent(
      JSON.stringify({
        title: "工作效率翻倍！我的 5 个神仙方法✨",
        caption: "这是一段完整、有种草感的小红书正文。",
        imageSuggestions: Array.from({ length: 9 }, (_, index) => `第 ${index + 1} 张图：办公效率场景`),
        hashtags: ["效率提升", "自我管理"]
      })
    );

    expect(content.caption).toContain("小红书正文");
    expect(content.imageSuggestions).toHaveLength(9);
    expect(content.imagePlan?.mode).toBe("Series Mode");
    expect(content.imagePlan?.images[0].prompt).toContain("Series 1 of 9");
    expect(content.imageAssets).toHaveLength(9);
    expect(content.imageAssets?.[0].src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it("uses SiliconFlow to generate Xiaohongshu note content when configured", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";
    delete process.env.SILICONFLOW_IMAGE_MODEL;
    delete process.env.SILICONFLOW_IMAGE_LIMIT;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "真实生成的小红书标题",
                caption: "一段来自模型的小红书文案，包含痛点、方法和收藏理由。",
                imageSuggestions: Array.from({ length: 9 }, (_, index) => `第 ${index + 1} 张图：真实配图提示`),
                hashtags: ["效率提升", "职场成长"]
              })
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const content = await generateXiaohongshuContent({
      prompt: "写一篇关于如何学习 AI 的小红书笔记",
      rules: ["标题要有爆点，文案要简洁"]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const requestBody = JSON.stringify(JSON.parse(String(requestInit?.body)));
    expect(requestBody).toContain("内置小红书爆文图文 Skill");
    expect(requestBody).toContain("步骤2.5");
    expect(requestBody).toContain("Series Mode");
    expect(requestBody).toContain("模版1：流程/步骤类");
    expect(content?.title).toBe("真实生成的小红书标题");
    expect(content?.imagePlan?.images[0].prompt).toContain("手绘风格");
    expect(content?.imageAssets).toHaveLength(9);
  });

  it("replaces Xiaohongshu local card assets with SiliconFlow image URLs when an image model is configured", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";
    process.env.SILICONFLOW_IMAGE_MODEL = "Qwen/Qwen-Image-Edit-2509";
    process.env.SILICONFLOW_IMAGE_LIMIT = "9";
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = dataRoot;

    const chatResponse = {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "爆款小红书标题",
                caption: "这是一段真正面向小红书的文案，有痛点、有方法、有收藏理由。",
                imageSuggestions: Array.from({ length: 9 }, (_, index) => `第 ${index + 1} 张图：分图策略`),
                hashtags: ["AI学习", "小红书运营"]
              })
            }
          }
        ]
      })
    };
    const imageResponses = Array.from({ length: 9 }, (_, index) => ({
      ok: true,
      json: async () => ({
        data: [
          {
            url: `https://cdn.example.com/xhs-card-${index + 1}.png`
          }
        ]
      })
    }));
    const downloadResponse = {
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "image/png" : null)
      },
      arrayBuffer: async () => {
        const buffer = Buffer.from("persisted-image");

        return buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        );
      }
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatResponse)
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.startsWith("https://cdn.example.com/")
            ? downloadResponse
            : imageResponses.shift()
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const content = await generateXiaohongshuContent({
      prompt: "写一篇关于普通人如何学习 AI 的小红书笔记",
      rules: [],
      enableImageGeneration: true
    });

    expect(fetchMock).toHaveBeenCalledTimes(19);
    expect(content?.imageAssets).toHaveLength(9);
    expect(content?.imageAssets?.every((asset) => asset.provider === "siliconflow")).toBe(true);
    expect(content?.imageAssets?.[0].src).toMatch(/^\/api\/assets\/xiaohongshu\/xhs-image-1-/);
    expect(content?.imageAssets?.[0].originalSrc).toBe("https://cdn.example.com/xhs-card-1.png");
    expect(content?.imageAssets?.[0].status).toBe("ready");

    const [, firstImageRequest] = fetchMock.mock.calls[1];
    const firstImageBody = JSON.parse(String(firstImageRequest?.body));

    expect(firstImageBody.model).toBe("Qwen/Qwen-Image-Edit-2509");
    expect(firstImageBody.prompt).toContain("Series 1 of 9");
    expect(firstImageBody.image).toContain("data:image/png;base64,");
    expect(firstImageBody).not.toHaveProperty("image_size");
    expect(firstImageBody).not.toHaveProperty("batch_size");
  });

  it("does not call image generation when switch is off", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";
    process.env.SILICONFLOW_IMAGE_MODEL = "Qwen/Qwen-Image-Edit-2509";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Low-token XHS title",
                caption: "Low-token XHS caption",
                imageSuggestions: Array.from(
                  { length: 9 },
                  (_, index) => `prompt ${index + 1}`
                ),
                hashtags: ["xhs", "ai"]
              })
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const content = await generateXiaohongshuContent({
      prompt: "Write a xiaohongshu note",
      rules: [],
      enableImageGeneration: false
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(content?.imageAssets?.every((asset) => asset.provider === "local-svg")).toBe(
      true
    );
  });
});
