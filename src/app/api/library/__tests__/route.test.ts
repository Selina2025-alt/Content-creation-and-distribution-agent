// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/library/route";
import { migrateDatabase } from "@/lib/db/migrate";
import { createDraft, markDraftGenerated } from "@/lib/db/repositories/draft-repository";
import { createHistoryAction } from "@/lib/db/repositories/history-action-repository";
import { createTaskContents } from "@/lib/db/repositories/task-content-repository";
import { createTask } from "@/lib/db/repositories/task-repository";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "library-routes"
);

describe("library route", () => {
  beforeEach(() => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });

    migrateDatabase();
  });

  it("archives a generated draft into the wechat content library", async () => {
    createDraft({
      id: "draft-1",
      title: "工作效率文章",
      prompt: "写一篇关于如何提高工作效率的内容",
      selectedPlatforms: ["wechat"],
      status: "draft"
    });
    createTask({
      id: "task-1",
      title: "高效工作的 5 个底层逻辑",
      userInput: "写一篇关于如何提高工作效率的内容",
      selectedPlatforms: ["wechat"],
      status: "ready"
    });
    createTaskContents("task-1", {
      wechat: {
        title: "高效工作的 5 个底层逻辑",
        summary: "从注意力、节奏、工具和复盘四个层面拆解高效工作。",
        body: "这里是正文。"
      },
      xiaohongshu: null,
      twitter: null,
      videoScript: null
    });
    markDraftGenerated("draft-1", "task-1");

    const response = await POST(
      new Request("http://localhost/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          draftId: "draft-1"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      item: {
        taskId: "task-1",
        title: "高效工作的 5 个底层逻辑",
        summary: "从注意力、节奏、工具和复盘四个层面拆解高效工作。"
      }
    });
  });

  it("archives a wechat article directly from the workspace by taskId", async () => {
    createTask({
      id: "task-2",
      title: "Harness Engineering 深度解析",
      userInput: "写一篇关于 Harness Engineering 的文章",
      selectedPlatforms: ["wechat"],
      status: "ready"
    });
    createTaskContents("task-2", {
      wechat: {
        title: "Harness Engineering 深度解析",
        summary: "一篇可归档的公众号文章摘要。",
        body: "这里是正文。"
      },
      xiaohongshu: null,
      twitter: null,
      videoScript: null
    });
    createHistoryAction({
      taskId: "task-2",
      actionType: "task_created",
      payload: {
        title: "Harness Engineering 深度解析",
        platforms: ["wechat"],
        sourceDraftId: "draft-from-history"
      }
    });

    const response = await POST(
      new Request("http://localhost/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          taskId: "task-2"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      item: {
        taskId: "task-2",
        title: "Harness Engineering 深度解析",
        summary: "一篇可归档的公众号文章摘要。"
      }
    });
  });
});
