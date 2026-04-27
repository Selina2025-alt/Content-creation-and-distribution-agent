// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import AdmZip from "adm-zip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET as exportTask } from "@/app/api/tasks/[taskId]/export/route";
import { migrateDatabase } from "@/lib/db/migrate";
import { createTaskContents } from "@/lib/db/repositories/task-content-repository";
import { createTask } from "@/lib/db/repositories/task-repository";
import type { GeneratedTaskContentBundle } from "@/lib/types";

const originalDataRoot = process.env.CONTENT_CREATION_AGENT_DATA_ROOT;

describe("task export route", () => {
  const dataRoot = path.join(process.cwd(), ".codex-data-tests", "task-export-route");

  beforeEach(() => {
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = dataRoot;
    rmSync(dataRoot, { recursive: true, force: true });
    migrateDatabase();

    createTask({
      id: "task-1",
      title: "AI workflow",
      userInput: "Write about AI workflow",
      selectedPlatforms: ["wechat", "xiaohongshu", "twitter", "videoScript"],
      status: "ready"
    });

    const bundle: GeneratedTaskContentBundle = {
      wechat: {
        title: "Wechat title",
        summary: "Wechat summary",
        body: "Wechat body"
      },
      xiaohongshu: {
        title: "XHS title",
        caption: "XHS caption",
        imageSuggestions: Array.from({ length: 2 }, (_, index) => `image ${index + 1}`),
        imageAssets: [
          {
            id: "xhs-image-1",
            title: "Image 1",
            prompt: "prompt 1",
            alt: "Image 1",
            src: "data:image/png;base64,aGVsbG8=",
            provider: "local-svg",
            status: "ready"
          },
          {
            id: "xhs-image-2",
            title: "Image 2",
            prompt: "prompt 2",
            alt: "Image 2",
            src: "data:image/png;base64,d29ybGQ=",
            provider: "local-svg",
            status: "ready"
          }
        ],
        hashtags: ["ai", "workflow"]
      },
      twitter: {
        mode: "single",
        language: "English",
        tweets: ["AI is useful when it fits your existing workflow."]
      },
      videoScript: {
        title: "Video script",
        scenes: [
          {
            shot: "01",
            copy: "Open with a concrete pain point.",
            visual: "Creator staring at too many tabs.",
            subtitle: "Too many tabs, no output",
            pace: "Medium",
            audio: "Light beat",
            effect: "Title pop-in"
          }
        ]
      }
    };

    createTaskContents("task-1", bundle);
  });

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true });
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = originalDataRoot;
  });

  it("exports markdown and html files", async () => {
    const markdownResponse = await exportTask(
      new Request("http://localhost/api/tasks/task-1/export?format=markdown"),
      {
        params: Promise.resolve({ taskId: "task-1" })
      }
    );
    const htmlResponse = await exportTask(
      new Request("http://localhost/api/tasks/task-1/export?format=html"),
      {
        params: Promise.resolve({ taskId: "task-1" })
      }
    );

    expect(markdownResponse.status).toBe(200);
    expect(htmlResponse.status).toBe(200);
    expect(markdownResponse.headers.get("content-disposition")).toContain(".md");
    expect(htmlResponse.headers.get("content-disposition")).toContain(".html");

    const markdownText = await markdownResponse.text();
    const htmlText = await htmlResponse.text();

    expect(markdownText).toContain("## 公众号文章");
    expect(markdownText).toContain("## 小红书笔记");
    expect(htmlText).toContain("<h2>Twitter</h2>");
  });

  it("exports xiaohongshu image package zip", async () => {
    const response = await exportTask(
      new Request("http://localhost/api/tasks/task-1/export?format=image-package"),
      {
        params: Promise.resolve({ taskId: "task-1" })
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/zip");

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const entryNames = zip.getEntries().map((entry) => entry.entryName);

    expect(entryNames).toContain("manifest.json");
    expect(entryNames).toContain("images/image-01.png");
    expect(entryNames).toContain("images/image-02.png");
  });

  it("returns 400 for invalid export format", async () => {
    const response = await exportTask(
      new Request("http://localhost/api/tasks/task-1/export?format=pdf"),
      {
        params: Promise.resolve({ taskId: "task-1" })
      }
    );

    expect(response.status).toBe(400);
  });
});
