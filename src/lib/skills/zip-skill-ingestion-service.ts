import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import AdmZip from "adm-zip";

import {
  getSkillUnpackedDirectory,
  getSkillUploadFilePath
} from "@/lib/fs/app-paths";
import { learnSkill } from "@/lib/skills/skill-learning-service";
import { parseSkillMarkdown } from "@/lib/skills/skill-parser";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.-]+/g, "-");
}

export async function ingestSkillZip(buffer: Buffer, fileName: string) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const skillEntry = entries.find((entry) =>
    entry.entryName.split("/").pop()?.toLowerCase() === "skill.md"
  );

  if (!skillEntry) {
    throw new Error("Uploaded skill archive must contain SKILL.md");
  }

  const skillId = randomUUID();
  const safeFileName = sanitizeFileName(fileName);
  const uploadPath = getSkillUploadFilePath(`${skillId}-${safeFileName}`);
  const unpackedDirectory = getSkillUnpackedDirectory(skillId);

  mkdirSync(path.dirname(uploadPath), { recursive: true });
  mkdirSync(unpackedDirectory, { recursive: true });
  writeFileSync(uploadPath, buffer);
  zip.extractAllTo(unpackedDirectory, true);

  const markdown = skillEntry.getData().toString("utf8");
  const references = entries
    .filter((entry) => entry.entryName.toLowerCase().endsWith(".md"))
    .map((entry) => entry.entryName);
  const parsed = parseSkillMarkdown(markdown);

  return {
    id: skillId,
    name: parsed.title,
    markdown,
    sourceRef: uploadPath,
    learningResult: learnSkill({ markdown, references })
  };
}
