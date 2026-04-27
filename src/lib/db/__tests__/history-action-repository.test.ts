// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "@/lib/db/migrate";
import {
  createHistoryAction,
  listHistoryActions
} from "@/lib/db/repositories/history-action-repository";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "history-action-repository"
);

describe("history action repository", () => {
  beforeEach(() => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });

    migrateDatabase();
  });

  it("creates and lists recent actions in reverse created order", () => {
    createHistoryAction({
      taskId: "task-1",
      actionType: "task_created",
      payload: {
        title: "第一篇文章"
      }
    });

    createHistoryAction({
      taskId: "task-1",
      actionType: "wechat_published",
      payload: {
        platform: "wechat"
      }
    });

    const actions = listHistoryActions();

    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({
      taskId: "task-1",
      actionType: "wechat_published"
    });
    expect(actions[1]).toMatchObject({
      taskId: "task-1",
      actionType: "task_created"
    });
  });
});
