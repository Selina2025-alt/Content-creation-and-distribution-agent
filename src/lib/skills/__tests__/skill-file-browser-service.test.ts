// @vitest-environment node

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getSkillUnpackedDirectory } from "@/lib/fs/app-paths";
import {
  listSkillFiles,
  readSkillFile
} from "@/lib/skills/skill-file-browser-service";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "skill-file-browser"
);

describe("skill-file-browser-service", () => {
  it("lists previewable files recursively and reads file contents", () => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });

    const skillDir = getSkillUnpackedDirectory("skill-1");
    mkdirSync(path.join(skillDir, "demo", "references"), { recursive: true });
    writeFileSync(
      path.join(skillDir, "demo", "SKILL.md"),
      "name: Demo Skill\ndescription: Demo"
    );
    writeFileSync(
      path.join(skillDir, "demo", "references", "style.md"),
      "# Style\nKeep it crisp."
    );
    writeFileSync(path.join(skillDir, "demo", "logo.png"), "binary");

    expect(listSkillFiles("skill-1")).toEqual([
      "demo/SKILL.md",
      "demo/references/style.md"
    ]);
    expect(readSkillFile("skill-1", "demo/references/style.md")).toBe(
      "# Style\nKeep it crisp."
    );
  });
});
