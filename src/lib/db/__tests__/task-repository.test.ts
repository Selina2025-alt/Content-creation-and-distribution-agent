// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "@/lib/db/migrate";
import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  renameTask
} from "@/lib/db/repositories/task-repository";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "task-repository"
);

describe("task repository", () => {
  beforeEach(() => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });

    migrateDatabase();
  });

  it("creates and lists tasks in reverse updated order", () => {
    createTask({
      id: "task-1",
      title: "First",
      userInput: "prompt 1",
      selectedPlatforms: ["wechat"],
      status: "ready"
    });

    expect(listTasks()[0]?.id).toBe("task-1");
  });

  it("renames and deletes tasks", () => {
    createTask({
      id: "task-2",
      title: "Before rename",
      userInput: "prompt 2",
      selectedPlatforms: ["twitter"],
      status: "ready"
    });

    renameTask("task-2", "After rename");
    expect(getTaskById("task-2")?.title).toBe("After rename");

    deleteTask("task-2");
    expect(getTaskById("task-2")).toBeNull();
  });
});
