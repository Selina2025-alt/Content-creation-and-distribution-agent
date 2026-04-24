// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { DELETE } from "@/app/api/skills/[skillId]/route";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  getPlatformSetting,
  upsertPlatformSetting
} from "@/lib/db/repositories/platform-settings-repository";
import {
  createSkill,
  getSkillById,
  getSkillLearningResult,
  saveSkillLearningResult
} from "@/lib/db/repositories/skill-repository";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "skill-delete-route"
);

describe("skill detail route", () => {
  beforeEach(() => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });
    migrateDatabase();
  });

  it("deletes a skill and removes it from platform selections", async () => {
    createSkill({
      id: "skill-delete",
      name: "Efficiency Writer",
      sourceType: "github",
      sourceRef: "https://github.com/openai/demo/tree/main/skills/writer",
      summary: "Writes practical longform productivity articles.",
      status: "ready"
    });
    saveSkillLearningResult("skill-delete", {
      summary: "Writes practical longform productivity articles.",
      rules: ["Use contrast-first hooks"],
      platformHints: ["wechat"],
      keywords: ["productivity"],
      examplesSummary: ["skills/writer/SKILL.md"]
    });
    upsertPlatformSetting({
      platform: "wechat",
      baseRulesJson: "[]",
      enabledSkillIdsJson: JSON.stringify(["skill-delete", "skill-keep"])
    });

    const response = await DELETE(
      new Request("http://localhost/api/skills/skill-delete", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ skillId: "skill-delete" }) }
    );

    expect(response.status).toBe(200);
    expect(getSkillById("skill-delete")).toBeNull();
    expect(getSkillLearningResult("skill-delete")).toBeNull();
    expect(
      JSON.parse(
        (getPlatformSetting("wechat") as { enabled_skill_ids_json: string })
          .enabled_skill_ids_json
      )
    ).toEqual(["skill-keep"]);
  });
});
