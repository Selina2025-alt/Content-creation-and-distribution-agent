// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "@/lib/db/migrate";
import { createHistoryAction } from "@/lib/db/repositories/history-action-repository";
import { createLibraryEntry } from "@/lib/db/repositories/library-entry-repository";
import { createTaskContents } from "@/lib/db/repositories/task-content-repository";
import { createTask } from "@/lib/db/repositories/task-repository";
import {
  getWechatLibraryDetail,
  getWechatLibraryPayload
} from "@/lib/library/wechat-library-service";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "wechat-library-service"
);

describe("wechat library service", () => {
  beforeEach(() => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });

    migrateDatabase();
  });

  it("keeps generated wechat tasks out of the library until they are explicitly added", () => {
    createTask({
      id: "task-1",
      title: "AI Agent 长文",
      userInput: "写一篇关于智能体发展的公众号文章",
      selectedPlatforms: ["wechat"],
      status: "ready"
    });
    createTaskContents("task-1", {
      wechat: {
        title: "AI Agent 长文",
        summary: "这是一段摘要",
        body: "这是一段正文"
      },
      xiaohongshu: null,
      twitter: null,
      videoScript: null
    });
    createHistoryAction({
      taskId: "task-1",
      actionType: "task_created",
      payload: {
        title: "AI Agent 长文"
      }
    });

    const payload = getWechatLibraryPayload();

    expect(payload.items).toHaveLength(0);
    expect(payload.recentActions[0]).toMatchObject({
      taskId: "task-1",
      actionType: "task_created"
    });
  });

  it("returns saved library items and full wechat detail after archiving", () => {
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
        body: "这是公众号正文第一段。\n\n这是公众号正文第二段。"
      },
      xiaohongshu: null,
      twitter: null,
      videoScript: null
    });
    createLibraryEntry({
      taskId: "task-1",
      platform: "wechat",
      sourceDraftId: "draft-1"
    });

    const payload = getWechatLibraryPayload();
    const detail = getWechatLibraryDetail("task-1");

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      taskId: "task-1",
      title: "高效工作的 5 个底层逻辑",
      summary: "从注意力、节奏、工具和复盘四个层面拆解高效工作。"
    });

    expect(detail).toMatchObject({
      taskId: "task-1",
      title: "高效工作的 5 个底层逻辑",
      summary: "从注意力、节奏、工具和复盘四个层面拆解高效工作。",
      body: "这是公众号正文第一段。\n\n这是公众号正文第二段。"
    });
  });
});
