// @vitest-environment node

import { existsSync, rmSync } from "node:fs";
import path from "node:path";

import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";

import { getSkillUnpackedDirectory } from "@/lib/fs/app-paths";
import { ingestSkillZip } from "@/lib/skills/zip-skill-ingestion-service";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "zip-skill-ingestion"
);

describe("ingestSkillZip", () => {
  it("rejects archives without SKILL.md", async () => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });

    const zip = new AdmZip();
    zip.addFile("README.md", Buffer.from("# Missing skill"));

    await expect(ingestSkillZip(zip.toBuffer(), "bad.zip")).rejects.toThrow(
      "SKILL.md"
    );
  });

  it("extracts SKILL.md and returns learned metadata", async () => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });

    const zip = new AdmZip();
    zip.addFile(
      "demo/SKILL.md",
      Buffer.from(
        [
          "name: Efficiency Writer",
          "description: Helps generate structured productivity content",
          "",
          "# Workflow",
          "- Use the examples folder before writing"
        ].join("\n")
      )
    );
    zip.addFile(
      "demo/examples/example-1.md",
      Buffer.from("# Example\nA sample workflow")
    );

    const result = await ingestSkillZip(zip.toBuffer(), "efficiency writer.zip");

    expect(result.name).toBe("Efficiency Writer");
    expect(result.learningResult.summary).toBe(
      "Helps generate structured productivity content"
    );
    expect(result.learningResult.examplesSummary).toContain(
      "demo/examples/example-1.md"
    );
    expect(existsSync(result.sourceRef)).toBe(true);
    expect(
      existsSync(path.join(getSkillUnpackedDirectory(result.id), "demo", "SKILL.md"))
    ).toBe(true);
  });
});
