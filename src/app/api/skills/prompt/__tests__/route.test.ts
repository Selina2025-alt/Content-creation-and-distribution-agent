// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/skills/prompt/route";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  getSkillLearningResult,
  listSkills
} from "@/lib/db/repositories/skill-repository";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "prompt-skill-routes"
);

describe("prompt skill route", () => {
  beforeEach(() => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });
    migrateDatabase();
  });

  it("creates a reusable prompt skill that can be selected like an uploaded skill", async () => {
    const response = await POST(
      new Request("http://localhost/api/skills/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "深度行业分析 Prompt",
          description: "要求文章有事实、案例和反方观点。",
          instruction: "写作时必须先解释背景，再给出具体案例和可执行建议。",
          platformHints: ["wechat"]
        })
      })
    );

    expect(response.status).toBe(201);

    const payload = (await response.json()) as { skill: { id: string; sourceType: string } };
    const savedSkill = listSkills()[0];

    expect(payload.skill.sourceType).toBe("prompt");
    expect(savedSkill).toMatchObject({
      name: "深度行业分析 Prompt",
      sourceType: "prompt",
      summary: "要求文章有事实、案例和反方观点。"
    });
    expect(getSkillLearningResult(savedSkill.id)?.rules).toContain(
      "写作时必须先解释背景，再给出具体案例和可执行建议。"
    );
  });
});
