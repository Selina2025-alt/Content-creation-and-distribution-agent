// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "migrate"
);

describe("migrateDatabase", () => {
  it("creates the core application tables", () => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });

    migrateDatabase();

    const db = openDatabase();
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('tasks', 'task_contents', 'platform_settings', 'skills', 'skill_files', 'skill_learning_results', 'skill_bindings', 'history_actions')"
      )
      .all() as Array<{ name: string }>;

    expect(rows).toHaveLength(8);
    db.close();
  });
});
