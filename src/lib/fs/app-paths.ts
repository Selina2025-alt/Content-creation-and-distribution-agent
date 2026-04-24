import { mkdirSync } from "node:fs";
import path from "node:path";

function getDataRoot() {
  return (
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT ??
    path.join(process.cwd(), ".codex-data")
  );
}

function getSkillsRoot() {
  return path.join(getDataRoot(), "skills");
}

function getGeneratedAssetsRoot() {
  return path.join(getDataRoot(), "generated-assets");
}

export function ensureAppDirectories() {
  const dataRoot = getDataRoot();
  const skillsRoot = getSkillsRoot();
  const generatedAssetsRoot = getGeneratedAssetsRoot();

  mkdirSync(dataRoot, { recursive: true });
  mkdirSync(path.join(skillsRoot, "uploads"), { recursive: true });
  mkdirSync(path.join(skillsRoot, "unpacked"), { recursive: true });
  mkdirSync(generatedAssetsRoot, { recursive: true });
}

export function getDatabaseFilePath() {
  return path.join(getDataRoot(), "content-creation-agent.sqlite");
}

export function getSkillsUploadsPath() {
  return path.join(getSkillsRoot(), "uploads");
}

export function getSkillsUnpackedPath() {
  return path.join(getSkillsRoot(), "unpacked");
}

export function getSkillUploadFilePath(fileName: string) {
  return path.join(getSkillsUploadsPath(), fileName);
}

export function getSkillUnpackedDirectory(skillId: string) {
  return path.join(getSkillsUnpackedPath(), skillId);
}

export function getGeneratedAssetsPath() {
  return getGeneratedAssetsRoot();
}

export function getGeneratedAssetFilePath(assetPath: string[]) {
  return path.join(getGeneratedAssetsRoot(), ...assetPath);
}
