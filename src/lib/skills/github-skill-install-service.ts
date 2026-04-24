import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getSkillUnpackedDirectory } from "@/lib/fs/app-paths";
import { learnSkill } from "@/lib/skills/skill-learning-service";
import { parseSkillMarkdown } from "@/lib/skills/skill-parser";

type GithubInstallCommand = {
  command: string;
  ref?: string;
};

type GithubInstallTarget = {
  repo: string;
  path: string;
  ref?: string;
};

type GithubTreeEntry = {
  path: string;
  type: string;
};

type DiscoveredSkillTarget = {
  path: string;
  skillFilePath: string;
};

type ResolvedGithubTarget = {
  repo: string;
  path: string;
  ref: string;
  skillFilePath?: string;
  treeEntries?: GithubTreeEntry[];
};

const candidateRefs = ["main", "master"];
const previewableExtensions = new Set([".md", ".txt", ".json", ".yaml", ".yml"]);

function normalizePath(inputPath: string) {
  return inputPath
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/SKILL\.md$/i, "");
}

function normalizeRepo(inputRepo: string) {
  return inputRepo
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
}

function normalizeIdentifier(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildRawGithubUrl(repo: string, ref: string, relativePath: string) {
  const safePath = relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://raw.githubusercontent.com/${repo}/${ref}/${safePath}`;
}

function isSkillMarkdownPath(filePath: string) {
  return /(^|\/)skill\.md$/i.test(filePath);
}

function stripGithubUrls(command: string) {
  return command.replace(
    /https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?/gi,
    " "
  );
}

function extractRepoFromCommand(command: string) {
  const treeUrlMatch = command.match(
    /https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/tree\/([A-Za-z0-9_.-]+)\/([^?#\s]+)/i
  );

  if (treeUrlMatch) {
    return {
      repo: normalizeRepo(treeUrlMatch[1]),
      ref: treeUrlMatch[2],
      path: normalizePath(treeUrlMatch[3])
    };
  }

  const githubUrlMatch = command.match(
    /https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\.git)?(?=$|[/?#\s]|[^\x00-\x7F])/i
  );

  if (githubUrlMatch) {
    return {
      repo: normalizeRepo(githubUrlMatch[1]),
      ref: null,
      path: null
    };
  }

  const shorthandMatch = command.match(/\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/);

  if (!shorthandMatch) {
    return null;
  }

  return {
    repo: normalizeRepo(shorthandMatch[1]),
    ref: null,
    path: null
  };
}

function extractExplicitSkillPath(command: string) {
  const explicitPathMatch = command.match(
    /\b((?:skills|Skills)\/[A-Za-z0-9_./-]+(?:\/SKILL\.md)?)\b/
  );

  if (!explicitPathMatch) {
    return null;
  }

  return normalizePath(explicitPathMatch[1]);
}

function extractSkillHint(command: string, repo: string, explicitPath?: string | null) {
  if (explicitPath) {
    return path.posix.basename(explicitPath);
  }

  const commandWithoutUrls = stripGithubUrls(command);
  const repoTokens = new Set(
    repo
      .split("/")
      .flatMap((part) => part.split("-"))
      .map((token) => normalizeIdentifier(token))
      .filter(Boolean)
  );
  const ignoredTokens = new Set([
    "github",
    "git",
    "com",
    "repo",
    "repository",
    "skill",
    "skills",
    "install",
    "tree",
    "main",
    "master",
    ...repoTokens
  ]);

  const matches = Array.from(
    commandWithoutUrls.matchAll(/([A-Za-z0-9_.-]+)\s*(?:技能|skill)/gi)
  );

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const candidate = matches[index]?.[1];

    if (!candidate) {
      continue;
    }

    const normalizedCandidate = normalizeIdentifier(candidate);

    if (!normalizedCandidate || ignoredTokens.has(normalizedCandidate)) {
      continue;
    }

    return candidate;
  }

  const fallbackTokens = Array.from(
    commandWithoutUrls.matchAll(/[A-Za-z0-9][A-Za-z0-9_.-]*[A-Za-z0-9]/g)
  ).map((match) => match[0]);

  for (let index = fallbackTokens.length - 1; index >= 0; index -= 1) {
    const candidate = fallbackTokens[index];
    const normalizedCandidate = normalizeIdentifier(candidate);

    if (!normalizedCandidate || ignoredTokens.has(normalizedCandidate)) {
      continue;
    }

    return candidate;
  }

  return null;
}

async function fetchRepositoryTree(repo: string, ref: string) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${ref}?recursive=1`
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { tree?: GithubTreeEntry[] };

  return payload.tree ?? [];
}

function discoverSkillPathFromTree(
  treeEntries: GithubTreeEntry[],
  skillHint?: string | null
): DiscoveredSkillTarget {
  const skillDirectories = treeEntries
    .filter((entry) => entry.type === "blob" && isSkillMarkdownPath(entry.path))
    .map((entry) => ({
      path: normalizePath(entry.path),
      skillFilePath: entry.path
    }));

  if (skillDirectories.length === 0) {
    throw new Error("No SKILL.md found in the GitHub repository");
  }

  const preferredDirectories = skillDirectories.filter((entry) =>
    entry.path.startsWith("skills/")
  );
  const candidates =
    preferredDirectories.length > 0 ? preferredDirectories : skillDirectories;

  if (skillHint) {
    const normalizedHint = normalizeIdentifier(skillHint);
    const hintedCandidates = skillDirectories;

    const exactLeafMatch = hintedCandidates.find(
      (candidate) =>
        normalizeIdentifier(path.posix.basename(candidate.path)) === normalizedHint
    );

    if (exactLeafMatch) {
      return exactLeafMatch;
    }

    const partialMatch = hintedCandidates.find((candidate) =>
      normalizeIdentifier(candidate.path).includes(normalizedHint)
    );

    if (partialMatch) {
      return partialMatch;
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const errorCandidates = skillHint ? skillDirectories : candidates;

  throw new Error(
    `Could not determine which skill to install from the repository. Candidates: ${errorCandidates
      .slice(0, 8)
      .map((candidate) => candidate.path)
      .join(", ")}`
  );
}

async function resolveGithubInstallTarget(
  input: GithubInstallCommand | GithubInstallTarget
): Promise<ResolvedGithubTarget> {
  if ("repo" in input && "path" in input) {
    return {
      repo: normalizeRepo(input.repo),
      path: normalizePath(input.path),
      ref: input.ref ?? "main"
    };
  }

  const repoTarget = extractRepoFromCommand(input.command);

  if (!repoTarget) {
    throw new Error("Could not parse GitHub repo from install command");
  }

  const explicitPath = repoTarget.path ?? extractExplicitSkillPath(input.command);
  const skillHint = extractSkillHint(input.command, repoTarget.repo, explicitPath);
  const refsToTry = input.ref
    ? [input.ref]
    : repoTarget.ref
      ? [repoTarget.ref]
      : candidateRefs;

  if (explicitPath) {
    return {
      repo: repoTarget.repo,
      path: explicitPath,
      ref: refsToTry[0]
    };
  }

  for (const ref of refsToTry) {
    const treeEntries = await fetchRepositoryTree(repoTarget.repo, ref);

    if (!treeEntries) {
      continue;
    }

    const discoveredTarget = discoverSkillPathFromTree(treeEntries, skillHint);

    return {
      repo: repoTarget.repo,
      path: discoveredTarget.path,
      ref,
      skillFilePath: discoveredTarget.skillFilePath,
      treeEntries
    };
  }

  throw new Error("Could not inspect the GitHub repository to locate the skill");
}

async function downloadSkillFiles(
  repo: string,
  ref: string,
  skillPath: string,
  unpackedDirectory: string,
  skillFilePath?: string,
  treeEntries?: GithubTreeEntry[]
) {
  const candidateFiles = treeEntries
    ? treeEntries
        .filter(
          (entry) =>
            entry.type === "blob" &&
            entry.path.startsWith(`${skillPath}/`) &&
            previewableExtensions.has(path.posix.extname(entry.path).toLowerCase())
        )
        .map((entry) => entry.path)
    : [];
  const discoveredSkillFilePath =
    skillFilePath ??
    candidateFiles.find((relativePath) => isSkillMarkdownPath(relativePath));
  const skillMarkdownCandidates = discoveredSkillFilePath
    ? [discoveredSkillFilePath]
    : [`${skillPath}/SKILL.md`, `${skillPath}/skill.md`];

  const filesToDownload = Array.from(
    new Set([...skillMarkdownCandidates, ...candidateFiles])
  ).slice(0, 12);

  const downloadedFiles: Array<{ path: string; content: string }> = [];

  for (const relativePath of filesToDownload) {
    const response = await fetch(buildRawGithubUrl(repo, ref, relativePath));

    if (!response.ok) {
      continue;
    }

    const content = await response.text();
    const absoluteFilePath = path.join(
      unpackedDirectory,
      ...relativePath.split("/")
    );

    mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
    writeFileSync(absoluteFilePath, content, "utf8");
    downloadedFiles.push({
      path: relativePath,
      content
    });
  }

  if (!downloadedFiles.some((file) => isSkillMarkdownPath(file.path))) {
    throw new Error("Failed to download SKILL.md from GitHub");
  }

  return downloadedFiles;
}

export async function installSkillFromGithub(
  input: GithubInstallCommand | GithubInstallTarget
) {
  const target = await resolveGithubInstallTarget(input);
  const skillId = randomUUID();
  const unpackedDirectory = getSkillUnpackedDirectory(skillId);
  const downloadedFiles = await downloadSkillFiles(
    target.repo,
    target.ref,
    target.path,
    unpackedDirectory,
    target.skillFilePath,
    target.treeEntries
  );
  const skillMarkdown =
    downloadedFiles.find((file) => isSkillMarkdownPath(file.path))?.content ?? "";

  if (!skillMarkdown.includes("name:")) {
    throw new Error("Downloaded skill is missing SKILL.md metadata");
  }

  const parsed = parseSkillMarkdown(skillMarkdown);

  return {
    id: skillId,
    name: parsed.title,
    markdown: skillMarkdown,
    sourceRef: `https://github.com/${target.repo}/tree/${target.ref}/${target.path}`,
    learningResult: learnSkill({
      markdown: skillMarkdown,
      references: downloadedFiles.map((file) => file.path)
    })
  };
}
