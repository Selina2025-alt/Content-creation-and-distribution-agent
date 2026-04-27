// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSiliconFlowImageGeneration,
  createSiliconFlowChatCompletion,
  getSiliconFlowImageConfig,
  getSiliconFlowConfig
} from "@/lib/content/siliconflow-client";

const originalApiKey = process.env.SILICONFLOW_API_KEY;
const originalModel = process.env.SILICONFLOW_MODEL;
const originalBaseUrl = process.env.SILICONFLOW_BASE_URL;
const originalTimeout = process.env.SILICONFLOW_TIMEOUT_MS;
const originalImageModel = process.env.SILICONFLOW_IMAGE_MODEL;
const originalImageModelFallbacks = process.env.SILICONFLOW_IMAGE_MODEL_FALLBACKS;

describe("siliconflow client", () => {
  afterEach(() => {
    process.env.SILICONFLOW_API_KEY = originalApiKey;
    process.env.SILICONFLOW_MODEL = originalModel;
    process.env.SILICONFLOW_BASE_URL = originalBaseUrl;
    process.env.SILICONFLOW_TIMEOUT_MS = originalTimeout;
    process.env.SILICONFLOW_IMAGE_MODEL = originalImageModel;
    process.env.SILICONFLOW_IMAGE_MODEL_FALLBACKS = originalImageModelFallbacks;
    vi.restoreAllMocks();
  });

  it("uses the updated default model when model env is missing", () => {
    process.env.SILICONFLOW_API_KEY = "test-key";
    delete process.env.SILICONFLOW_MODEL;

    expect(getSiliconFlowConfig()?.model).toBe("Pro/zai-org/GLM-4.7");
  });

  it("retries provider busy responses before succeeding", async () => {
    process.env.SILICONFLOW_API_KEY = "test-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    delete process.env.SILICONFLOW_MODEL;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () =>
          JSON.stringify({
            code: 50508,
            message: "System is too busy now. Please try again later.",
            data: null
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"title":"ok"}'
              }
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSiliconFlowChatCompletion({
        messages: [
          {
            role: "user",
            content: "hello"
          }
        ]
      })
    ).resolves.toContain('"title":"ok"');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses the configured Qwen image edit model without sending image_size", async () => {
    process.env.SILICONFLOW_API_KEY = "test-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1/";
    process.env.SILICONFLOW_IMAGE_MODEL = "Qwen/Qwen-Image-Edit-2509";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            url: "https://cdn.example.com/xhs-card.png"
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSiliconFlowImageGeneration({
        prompt: "生成一张小红书知识卡片",
        image: "data:image/png;base64,AAA"
      })
    ).resolves.toBe("https://cdn.example.com/xhs-card.png");

    expect(getSiliconFlowImageConfig()?.model).toBe(
      "Qwen/Qwen-Image-Edit-2509"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, requestInit] = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(String(requestInit?.body));

    expect(url).toBe("https://api.siliconflow.cn/v1/images/generations");
    expect(requestBody.model).toBe("Qwen/Qwen-Image-Edit-2509");
    expect(requestBody.prompt).toContain("小红书知识卡片");
    expect(requestBody.image).toContain("data:image/png;base64,");
    expect(requestBody).not.toHaveProperty("image_size");
    expect(requestBody).not.toHaveProperty("batch_size");
  });

  it("falls back to the next candidate model when the configured model is unavailable", async () => {
    process.env.SILICONFLOW_API_KEY = "test-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_IMAGE_MODEL = "Invalid/Model";
    process.env.SILICONFLOW_IMAGE_MODEL_FALLBACKS =
      "Qwen/Qwen-Image,Kwai-Kolors/Kolors";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            code: 20012,
            message: "Model does not exist. Please check it carefully.",
            data: null
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: [
            {
              url: "https://cdn.example.com/wechat-cover.png"
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSiliconFlowImageGeneration({
        prompt: "Generate a clean cover image",
        imageSize: "1024x576"
      })
    ).resolves.toBe("https://cdn.example.com/wechat-cover.png");

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(firstBody.model).toBe("Invalid/Model");
    expect(secondBody.model).toBe("Qwen/Qwen-Image");
  });

  it("switches to fallback image model after repeated provider busy failures", async () => {
    process.env.SILICONFLOW_API_KEY = "test-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_IMAGE_MODEL = "Qwen/Qwen-Image-Edit-2509";
    process.env.SILICONFLOW_IMAGE_MODEL_FALLBACKS = "Qwen/Qwen-Image";

    const busyResponse = {
      ok: false,
      status: 503,
      text: async () =>
        JSON.stringify({
          code: 50508,
          message: "System is too busy now. Please try again later.",
          data: null
        })
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(busyResponse)
      .mockResolvedValueOnce(busyResponse)
      .mockResolvedValueOnce(busyResponse)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              url: "https://cdn.example.com/fallback-success.png"
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSiliconFlowImageGeneration({
        prompt: "Generate a robust fallback image"
      })
    ).resolves.toBe("https://cdn.example.com/fallback-success.png");

    expect(fetchMock).toHaveBeenCalledTimes(4);

    const thirdBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    const fourthBody = JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body));

    expect(thirdBody.model).toBe("Qwen/Qwen-Image-Edit-2509");
    expect(fourthBody.model).toBe("Qwen/Qwen-Image");
  });

  it("keeps configured image-edit model as first choice for text-to-image", async () => {
    process.env.SILICONFLOW_API_KEY = "test-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_IMAGE_MODEL = "Qwen/Qwen-Image-Edit-2509";
    process.env.SILICONFLOW_IMAGE_MODEL_FALLBACKS = "Qwen/Qwen-Image";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        images: [
          {
            url: "https://cdn.example.com/text-to-image.png"
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSiliconFlowImageGeneration({
        prompt: "Generate a cover image",
        imageSize: "1024x576"
      })
    ).resolves.toBe("https://cdn.example.com/text-to-image.png");

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.model).toBe("Qwen/Qwen-Image-Edit-2509");
  });
});
