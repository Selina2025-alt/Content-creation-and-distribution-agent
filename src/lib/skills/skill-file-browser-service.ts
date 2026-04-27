import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { getSkillUnpackedDirectory } from "@/lib/fs/app-paths";

const previewableExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);

function isPreviewable(filePath: string) {
  return previewableExtensions.has(path.extname(filePath).toLowerCase());
}

function walkDirectory(rootDirectory: string, currentDirectory = rootDirectory) {
  const entries = readdirSync(currentDirectory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkDirectory(rootDirectory, absolutePath));
      continue;
    }

    if (entry.isFile() && isPreviewable(absolutePath)) {
      files.push(
        path.relative(rootDirectory, absolutePath).replaceAll(path.sep, "/")
      );
    }
  }

  return files.sort((left, right) => {
    const depthDifference = left.split("/").length - right.split("/").length;

    if (depthDifference !== 0) {
      return depthDifference;
    }

    return left.localeCompare(right);
  });
}

function resolveSkillFilePath(skillId: string, relativePath: string) {
  const rootDirectory = getSkillUnpackedDirectory(skillId);
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const absolutePath = path.resolve(rootDirectory, normalizedPath);
  const relativeToRoot = path.relative(rootDirectory, absolutePath);

  if (
    !relativeToRoot ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new Error("Invalid skill file path");
  }

  return absolutePath;
}

export function listSkillFiles(skillId: string) {
  const rootDirectory = getSkillUnpackedDirectory(skillId);

  if (!existsSync(rootDirectory)) {
    return [];
  }

  return walkDirectory(rootDirectory);
}

export function readSkillFile(skillId: string, relativePath: string) {
  const absolutePath = resolveSkillFilePath(skillId, relativePath);

  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    throw new Error("Skill file not found");
  }

  if (!isPreviewable(absolutePath)) {
    throw new Error("Skill file is not previewable");
  }

  return readFileSync(absolutePath, "utf8");
}
