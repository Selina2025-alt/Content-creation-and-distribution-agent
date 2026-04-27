// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { installSkillFromGithub } from "@/lib/skills/github-skill-install-service";

describe("installSkillFromGithub", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects when the remote SKILL.md cannot be downloaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })
    );

    await expect(
      installSkillFromGithub({
        command: "请帮我安装 openai/demo 仓库的 skills/writer 技能"
      })
    ).rejects.toThrow("SKILL.md");
  });

  it("downloads and learns a github skill from an owner repo command", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        [
          "name: Github Writer",
          "description: Helps adapt longform content into multiple platforms"
        ].join("\n")
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await installSkillFromGithub({
      command: "请帮我安装 openai/demo 仓库的 skills/writer 技能"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/openai/demo/main/skills/writer/SKILL.md"
    );
    expect(result.name).toBe("Github Writer");
    expect(result.sourceRef).toBe(
      "https://github.com/openai/demo/tree/main/skills/writer"
    );
    expect(result.learningResult.summary).toBe(
      "Helps adapt longform content into multiple platforms"
    );
  });

  it("understands a github url plus a bare skill name and discovers the path in repo", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (
        url ===
        "https://api.github.com/repos/Selina2025-alt/claude-skills-library/git/trees/main?recursive=1"
      ) {
        return {
          ok: true,
          json: async () => ({
            tree: [
              { path: "skills/huashu-wechat-creation/SKILL.md", type: "blob" },
              { path: "skills/other-skill/SKILL.md", type: "blob" }
            ]
          })
        } as Response;
      }

      if (
        url ===
        "https://raw.githubusercontent.com/Selina2025-alt/claude-skills-library/main/skills/huashu-wechat-creation/SKILL.md"
      ) {
        return {
          ok: true,
          text: async () =>
            [
              "name: Wechat Creation Skill",
              "description: Helps create better wechat content"
            ].join("\n")
        } as Response;
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await installSkillFromGithub({
      command:
        "帮我安装 https://github.com/Selina2025-alt/claude-skills-library.git 的 huashu-wechat-creation 技能"
    });

    expect(result.name).toBe("Wechat Creation Skill");
    expect(result.sourceRef).toBe(
      "https://github.com/Selina2025-alt/claude-skills-library/tree/main/skills/huashu-wechat-creation"
    );
  });

  it("installs a root skill from a natural language github command even when .git touches Chinese text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (
        url ===
        "https://api.github.com/repos/Selina2025-alt/claude-skills-library/git/trees/main?recursive=1"
      ) {
        return {
          ok: true,
          json: async () => ({
            tree: [
              { path: "content-research-writer/SKILL.md", type: "blob" },
              { path: "huashu-wechat-creation/SKILL.md", type: "blob" },
              { path: "huashu-wechat-creation/references/style-guide.md", type: "blob" }
            ]
          })
        } as Response;
      }

      if (
        url ===
        "https://raw.githubusercontent.com/Selina2025-alt/claude-skills-library/main/huashu-wechat-creation/SKILL.md"
      ) {
        return {
          ok: true,
          text: async () =>
            [
              "name: huashu-wechat-creation",
              "description: Helps create Huashu-style WeChat longform articles"
            ].join("\n")
        } as Response;
      }

      if (
        url ===
        "https://raw.githubusercontent.com/Selina2025-alt/claude-skills-library/main/huashu-wechat-creation/references/style-guide.md"
      ) {
        return {
          ok: true,
          text: async () => "# Style guide"
        } as Response;
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await installSkillFromGithub({
      command:
        "\u5e2e\u6211\u5b89\u88c5https://github.com/Selina2025-alt/claude-skills-library.git\u7684 huashu-wechat-creation \u6280\u80fd"
    });

    expect(result.name).toBe("huashu-wechat-creation");
    expect(result.sourceRef).toBe(
      "https://github.com/Selina2025-alt/claude-skills-library/tree/main/huashu-wechat-creation"
    );
  });

  it("matches an explicit root skill even when the repository also has skills directory candidates", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (
        url ===
        "https://api.github.com/repos/Selina2025-alt/claude-skills-library/git/trees/main?recursive=1"
      ) {
        return {
          ok: true,
          json: async () => ({
            tree: [
              { path: "skills/字幕转markdown/SKILL.md", type: "blob" },
              { path: "skills/帮我写作/SKILL.md", type: "blob" },
              { path: "skills/来点选题/SKILL.md", type: "blob" },
              { path: "skills/英文播客自动总结/SKILL.md", type: "blob" },
              { path: "huashu-wechat-creation/SKILL.md", type: "blob" },
              { path: "huashu-wechat-creation/references/style-guide.md", type: "blob" }
            ]
          })
        } as Response;
      }

      if (
        url ===
        "https://raw.githubusercontent.com/Selina2025-alt/claude-skills-library/main/huashu-wechat-creation/SKILL.md"
      ) {
        return {
          ok: true,
          text: async () =>
            [
              "name: huashu-wechat-creation",
              "description: Huashu WeChat creation workflow"
            ].join("\n")
        } as Response;
      }

      if (
        url ===
        "https://raw.githubusercontent.com/Selina2025-alt/claude-skills-library/main/huashu-wechat-creation/references/style-guide.md"
      ) {
        return {
          ok: true,
          text: async () => "# Style guide"
        } as Response;
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await installSkillFromGithub({
      command:
        "\u5e2e\u6211\u5b89\u88c5https://github.com/Selina2025-alt/claude-skills-library.git\u7684 huashu-wechat-creation \u6280\u80fd"
    });

    expect(result.name).toBe("huashu-wechat-creation");
    expect(result.sourceRef).toBe(
      "https://github.com/Selina2025-alt/claude-skills-library/tree/main/huashu-wechat-creation"
    );
  });

  it("downloads lowercase skill.md files when the repository uses that filename", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (
        url ===
        "https://api.github.com/repos/openai/demo/git/trees/main?recursive=1"
      ) {
        return {
          ok: true,
          json: async () => ({
            tree: [{ path: "skills/lowercase/skill.md", type: "blob" }]
          })
        } as Response;
      }

      if (
        url ===
        "https://raw.githubusercontent.com/openai/demo/main/skills/lowercase/skill.md"
      ) {
        return {
          ok: true,
          text: async () =>
            [
              "name: Lowercase Skill",
              "description: Uses a lowercase skill filename"
            ].join("\n")
        } as Response;
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await installSkillFromGithub({
      command: "install openai/demo lowercase skill"
    });

    expect(result.name).toBe("Lowercase Skill");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/openai/demo/main/skills/lowercase/skill.md"
    );
  });
});
