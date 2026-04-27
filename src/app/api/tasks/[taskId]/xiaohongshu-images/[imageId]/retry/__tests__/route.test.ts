// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as retryImage } from "@/app/api/tasks/[taskId]/xiaohongshu-images/[imageId]/retry/route";
import { migrateDatabase } from "@/lib/db/migrate";
import { createTask } from "@/lib/db/repositories/task-repository";
import {
  createTaskContents,
  getTaskBundle
} from "@/lib/db/repositories/task-content-repository";
import type { GeneratedTaskContentBundle } from "@/lib/types";

const originalDataRoot = process.env.CONTENT_CREATION_AGENT_DATA_ROOT;
const originalApiKey = process.env.SILICONFLOW_API_KEY;
const originalBaseUrl = process.env.SILICONFLOW_BASE_URL;
const originalImageModel = process.env.SILICONFLOW_IMAGE_MODEL;

describe("xiaohongshu image retry route", () => {
  const dataRoot = path.join(process.cwd(), ".codex-data-tests", "xhs-image-retry-route");

  beforeEach(() => {
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = dataRoot;
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_IMAGE_MODEL = "Qwen/Qwen-Image-Edit-2509";
    rmSync(dataRoot, { recursive: true, force: true });
    migrateDatabase();
  });

  afterEach(() => {
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = originalDataRoot;
    process.env.SILICONFLOW_API_KEY = originalApiKey;
    process.env.SILICONFLOW_BASE_URL = originalBaseUrl;
    process.env.SILICONFLOW_IMAGE_MODEL = originalImageModel;
    rmSync(dataRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("regenerates one Xiaohongshu image and persists the updated content", async () => {
    createTask({
      id: "task-1",
      title: "小红书任务",
      userInput: "写一篇关于 AI 学习的小红书笔记",
      selectedPlatforms: ["xiaohongshu"],
      status: "ready"
    });

    const bundle: GeneratedTaskContentBundle = {
      wechat: null,
      twitter: null,
      videoScript: null,
      xiaohongshu: {
        title: "AI 学习别再瞎摸索",
        caption: "这是一条小红书文案。",
        imageSuggestions: Array.from({ length: 9 }, (_, index) => `图片 ${index + 1}`),
        imageAssets: Array.from({ length: 9 }, (_, index) => ({
          id: `xhs-image-${index + 1}`,
          title: `图 ${index + 1}`,
          prompt: `Series ${index + 1} of 9 手绘风格配图提示`,
          alt: `小红书配图 ${index + 1}`,
          src: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E",
          provider: "local-svg",
          status: index === 0 ? "failed" : "ready",
          errorMessage: index === 0 ? "图片生成失败" : undefined,
          type: 5,
          typeName: "综合框架/体系类",
          size: "portrait",
          colorScheme: "warm"
        })),
        hashtags: ["AI学习"]
      }
    };

    createTaskContents("task-1", bundle);

    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith("https://cdn.example.com/")) {
        const buffer = Buffer.from("retry-image");

        return Promise.resolve({
          ok: true,
          headers: {
            get: (name: string) =>
              name.toLowerCase() === "content-type" ? "image/png" : null
          },
          arrayBuffer: async () =>
            buffer.buffer.slice(
              buffer.byteOffset,
              buffer.byteOffset + buffer.byteLength
            )
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [
            {
              url: "https://cdn.example.com/retry-card.png"
            }
          ]
        })
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await retryImage(
      new Request("http://localhost/api/tasks/task-1/xiaohongshu-images/xhs-image-1/retry", {
        method: "POST"
      }),
      {
        params: Promise.resolve({
          taskId: "task-1",
          imageId: "xhs-image-1"
        })
      }
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      imageAsset: { src: string; originalSrc?: string; provider: string; status: string };
    };

    expect(payload.imageAsset.provider).toBe("siliconflow");
    expect(payload.imageAsset.status).toBe("ready");
    expect(payload.imageAsset.originalSrc).toBe("https://cdn.example.com/retry-card.png");
    expect(payload.imageAsset.src).toMatch(/^\/api\/assets\/xiaohongshu\/xhs-image-1-/);

    const persistedBundle = getTaskBundle("task-1");
    expect(persistedBundle.xiaohongshu?.imageAssets?.[0]).toMatchObject({
      provider: "siliconflow",
      status: "ready",
      originalSrc: "https://cdn.example.com/retry-card.png"
    });
  });
});
