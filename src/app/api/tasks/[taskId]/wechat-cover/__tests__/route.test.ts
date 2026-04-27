// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as generateWechatCover } from "@/app/api/tasks/[taskId]/wechat-cover/route";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  createTaskContents,
  getTaskBundle
} from "@/lib/db/repositories/task-content-repository";
import { createTask } from "@/lib/db/repositories/task-repository";
import type { GeneratedTaskContentBundle } from "@/lib/types";

const originalDataRoot = process.env.CONTENT_CREATION_AGENT_DATA_ROOT;
const originalApiKey = process.env.SILICONFLOW_API_KEY;
const originalBaseUrl = process.env.SILICONFLOW_BASE_URL;
const originalImageModel = process.env.SILICONFLOW_IMAGE_MODEL;

describe("wechat cover image route", () => {
  const dataRoot = path.join(process.cwd(), ".codex-data-tests", "wechat-cover-route");

  beforeEach(() => {
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = dataRoot;
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_IMAGE_MODEL = "Qwen/Qwen-Image-Edit-2509";
    rmSync(dataRoot, { recursive: true, force: true });
    migrateDatabase();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = originalDataRoot;
    process.env.SILICONFLOW_API_KEY = originalApiKey;
    process.env.SILICONFLOW_BASE_URL = originalBaseUrl;
    process.env.SILICONFLOW_IMAGE_MODEL = originalImageModel;
    rmSync(dataRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("generates wechat cover image and persists the asset with strict no-text constraints", async () => {
    createTask({
      id: "task-wechat-cover-1",
      title: "公众号首图测试",
      userInput: "写一篇关于 AI 趋势的深度文章",
      selectedPlatforms: ["wechat"],
      status: "ready"
    });

    const bundle: GeneratedTaskContentBundle = {
      wechat: {
        title: "AI 趋势全景",
        summary: "总结 AI 技术与应用变化，给出普通人可执行的行动建议。",
        body: "## 变化趋势\n\n先理解技术变化，再选择可落地场景。"
      },
      xiaohongshu: null,
      twitter: null,
      videoScript: null
    };

    createTaskContents("task-wechat-cover-1", bundle);

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.startsWith("https://cdn.example.com/")) {
        const buffer = Buffer.from("wechat-cover-image");

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
          data: [{ url: "https://cdn.example.com/wechat-cover.png" }]
        })
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await generateWechatCover(
      new Request("http://localhost/api/tasks/task-wechat-cover-1/wechat-cover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          candidateId: "wechat-cover-1"
        })
      }),
      { params: Promise.resolve({ taskId: "task-wechat-cover-1" }) }
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      coverImageAsset: { originalSrc?: string; provider: string; src: string; status?: string };
    };

    expect(payload.coverImageAsset.provider).toBe("siliconflow");
    expect(payload.coverImageAsset.status).toBe("ready");
    expect(payload.coverImageAsset.originalSrc).toBe(
      "https://cdn.example.com/wechat-cover.png"
    );
    expect(payload.coverImageAsset.src).toMatch(/^\/api\/assets\/wechat\/wechat-cover-1-/);

    const imageRequest = fetchMock.mock.calls.find(([callInput]) =>
      callInput.toString().includes("/images/generations")
    );
    expect(imageRequest).toBeDefined();

    const imageRequestBody = JSON.parse(
      String((imageRequest?.[1] as RequestInit | undefined)?.body ?? "{}")
    ) as { prompt?: string };
    expect(imageRequestBody.prompt).toContain("Article hero-cover style constraints");
    expect(imageRequestBody.prompt).toContain("style channel 1:");
    expect(imageRequestBody.prompt).toContain("Hard constraints: NO visible words");
    expect(imageRequestBody.prompt).toContain("Zero-branding safety:");
    expect(imageRequestBody.prompt).toContain("Corner safety:");
    expect(imageRequestBody.prompt).toContain("Relevance guardrail:");
    expect(imageRequestBody.prompt).toContain("Scene purity:");
    expect(imageRequestBody.prompt).toContain("Human character is allowed");
    expect(imageRequestBody.prompt).not.toContain("github.com");
    expect(imageRequestBody.prompt).not.toContain("Baoyu WeChat Cover");
    expect(imageRequestBody.prompt).not.toContain("md2wechat Cover Hero");
    expect(imageRequestBody.prompt).not.toContain("Create a premium WeChat article cover artwork");
    expect(imageRequestBody.prompt).not.toContain("JimLiu");
    expect(imageRequestBody.prompt).not.toContain("geekjourneyx");

    const persistedBundle = getTaskBundle("task-wechat-cover-1");
    expect(persistedBundle.wechat?.coverImageAsset).toMatchObject({
      provider: "siliconflow",
      status: "ready",
      originalSrc: "https://cdn.example.com/wechat-cover.png"
    });
  });
});
