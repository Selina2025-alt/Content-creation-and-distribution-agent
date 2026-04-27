import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsShell } from "@/components/settings/settings-shell";
import type {
  PlatformId,
  SkillLearningResultRecord,
  SkillRecord
} from "@/lib/types";

const sampleSkill: SkillRecord = {
  id: "skill-1",
  name: "效率写作规则包",
  sourceType: "zip",
  sourceRef: ".codex-data/skills/uploads/skill-1-demo.zip",
  summary: "帮助生成结构化的效率内容",
  status: "ready",
  createdAt: "2026-04-08T00:00:00.000Z",
  updatedAt: "2026-04-08T00:00:00.000Z"
};

const sampleLearningResult: SkillLearningResultRecord = {
  skillId: "skill-1",
  summary: "帮助生成结构化的效率内容",
  rules: ["Read SKILL.md", "Apply workflow before generation"],
  platformHints: ["wechat"],
  keywords: ["efficiency", "writer"],
  examplesSummary: ["demo/SKILL.md", "demo/references/style.md"],
  updatedAt: "2026-04-08T00:00:00.000Z"
};

const emptyPlatformSelections: Record<PlatformId, string[]> = {
  wechat: [],
  xiaohongshu: [],
  twitter: [],
  videoScript: []
};

describe("SettingsShell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty platform bindings, anchor navigation, and allows save/reset", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.includes("/api/platform-settings/wechat") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/skills/skill-1")) {
        return new Response(
          JSON.stringify({
            skill: sampleSkill,
            learningResult: sampleLearningResult,
            files: ["demo/SKILL.md"],
            selectedFile: {
              path: "demo/SKILL.md",
              content: "name: Efficiency Writer"
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <SettingsShell
        initialPlatformSelections={emptyPlatformSelections}
        initialSkillDetails={{ [sampleSkill.id]: sampleLearningResult }}
        initialSkills={[sampleSkill]}
      />
    );

    expect(screen.getByRole("link", { name: "返回主页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "公众号文章" })).toHaveAttribute(
      "href",
      "#platform-wechat"
    );
    expect(screen.getByRole("link", { name: "Skills Library" })).toHaveAttribute(
      "href",
      "#skills-library"
    );

    const wechatPanel = screen.getByRole("region", { name: "公众号文章 规则" });
    expect(within(wechatPanel).getByText("暂未选择 skills")).toBeInTheDocument();
    expect(
      within(wechatPanel).queryByRole("button", { name: "已选 效率写作规则包" })
    ).not.toBeInTheDocument();

    await user.click(within(wechatPanel).getByRole("button", { name: "效率写作规则包" }));
    await user.click(within(wechatPanel).getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/platform-settings/wechat",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            baseRules: [],
            enabledSkillIds: ["skill-1"]
          })
        })
      );
    });

    await user.click(within(wechatPanel).getByRole("button", { name: "重置" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/platform-settings/wechat",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            baseRules: [],
            enabledSkillIds: []
          })
        })
      );
    });

    expect(within(wechatPanel).getByText("暂未选择 skills")).toBeInTheDocument();
  });

  it("loads skill files and previews file contents", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.includes("file=demo%2Freferences%2Fstyle.md")) {
        return new Response(
          JSON.stringify({
            skill: sampleSkill,
            learningResult: sampleLearningResult,
            files: ["demo/SKILL.md", "demo/references/style.md"],
            selectedFile: {
              path: "demo/references/style.md",
              content: "# Tone guide\nUse concise, practical language."
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/skills/skill-1")) {
        return new Response(
          JSON.stringify({
            skill: sampleSkill,
            learningResult: sampleLearningResult,
            files: ["demo/SKILL.md", "demo/references/style.md"],
            selectedFile: {
              path: "demo/SKILL.md",
              content: "name: Efficiency Writer\ndescription: Helps generate"
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <SettingsShell
        initialPlatformSelections={emptyPlatformSelections}
        initialSkillDetails={{ [sampleSkill.id]: sampleLearningResult }}
        initialSkills={[sampleSkill]}
      />
    );

    expect(await screen.findByRole("button", { name: "demo/SKILL.md" })).toBeInTheDocument();
    expect(await screen.findByText(/Efficiency Writer/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "demo/references/style.md" }));

    expect(await screen.findByText("Tone guide")).toBeInTheDocument();
    expect(
      await screen.findByText("Use concise, practical language.")
    ).toBeInTheDocument();
  });

  it("shows learned capabilities in the library and deletes a skill", async () => {
    const user = userEvent.setup();
    const englishSkill: SkillRecord = {
      id: "skill-delete",
      name: "Efficiency Writer",
      sourceType: "github",
      sourceRef: "https://github.com/openai/demo/tree/main/skills/writer",
      summary: "Writes practical longform productivity articles.",
      status: "ready",
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z"
    };
    const englishLearningResult: SkillLearningResultRecord = {
      skillId: "skill-delete",
      summary: "Writes practical longform productivity articles.",
      rules: ["Use contrast-first hooks", "Close with concrete next steps"],
      platformHints: ["wechat"],
      keywords: ["productivity", "longform"],
      examplesSummary: ["skills/writer/SKILL.md"],
      updatedAt: "2026-04-08T00:00:00.000Z"
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.includes("/api/skills/skill-delete") && init?.method === "DELETE") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/skills/skill-delete")) {
        return new Response(
          JSON.stringify({
            skill: englishSkill,
            learningResult: englishLearningResult,
            files: ["skills/writer/SKILL.md"],
            selectedFile: {
              path: "skills/writer/SKILL.md",
              content: "name: Efficiency Writer"
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <SettingsShell
        initialPlatformSelections={{
          ...emptyPlatformSelections,
          wechat: ["skill-delete"]
        }}
        initialSkillDetails={{ [englishSkill.id]: englishLearningResult }}
        initialSkills={[englishSkill]}
      />
    );

    expect(
      (await screen.findAllByText("Use contrast-first hooks")).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("productivity").length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "删除 Efficiency Writer" })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/skills/skill-delete",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    expect(screen.queryByText("Efficiency Writer")).not.toBeInTheDocument();
    expect(screen.queryByText("Use contrast-first hooks")).not.toBeInTheDocument();
  });

  it("creates a prompt skill from direct instructions", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url === "/api/skills/prompt" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            skill: {
              id: "prompt-skill-1",
              name: "行业深度 Prompt",
              sourceType: "prompt",
              sourceRef: "prompt:prompt-skill-1",
              summary: "要求有事实、案例和反方观点。",
              status: "ready",
              createdAt: "2026-04-11T00:00:00.000Z",
              updatedAt: "2026-04-11T00:00:00.000Z"
            },
            learningResult: {
              skillId: "prompt-skill-1",
              summary: "要求有事实、案例和反方观点。",
              rules: ["先解释背景，再给出案例和行动建议。"],
              platformHints: ["wechat"],
              keywords: ["行业深度", "Prompt"],
              examplesSummary: ["Prompt skill"],
              updatedAt: "2026-04-11T00:00:00.000Z"
            }
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/skills/prompt-skill-1")) {
        return new Response(
          JSON.stringify({
            skill: {
              id: "prompt-skill-1",
              name: "行业深度 Prompt",
              sourceType: "prompt",
              sourceRef: "prompt:prompt-skill-1",
              summary: "要求有事实、案例和反方观点。",
              status: "ready",
              createdAt: "2026-04-11T00:00:00.000Z",
              updatedAt: "2026-04-11T00:00:00.000Z"
            },
            learningResult: {
              skillId: "prompt-skill-1",
              summary: "要求有事实、案例和反方观点。",
              rules: ["先解释背景，再给出案例和行动建议。"],
              platformHints: ["wechat"],
              keywords: ["行业深度", "Prompt"],
              examplesSummary: ["Prompt skill"],
              updatedAt: "2026-04-11T00:00:00.000Z"
            },
            files: [],
            selectedFile: null
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <SettingsShell
        initialPlatformSelections={emptyPlatformSelections}
        initialSkillDetails={{}}
        initialSkills={[]}
      />
    );

    await user.type(screen.getByLabelText("Prompt 技能名称"), "行业深度 Prompt");
    await user.type(screen.getByLabelText("Prompt 技能描述"), "要求有事实、案例和反方观点。");
    await user.type(
      screen.getByLabelText("Prompt 技能指令"),
      "先解释背景，再给出案例和行动建议。"
    );
    await user.click(screen.getByRole("button", { name: "保存 Prompt 技能" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/skills/prompt",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "行业深度 Prompt",
            description: "要求有事实、案例和反方观点。",
            instruction: "先解释背景，再给出案例和行动建议。",
            platformHints: ["wechat"]
          })
        })
      );
    });

    expect((await screen.findAllByText("行业深度 Prompt")).length).toBeGreaterThan(0);
    expect(await screen.findByText("PROMPT")).toBeInTheDocument();
    expect(
      (await screen.findAllByText("先解释背景，再给出案例和行动建议。")).length
    ).toBeGreaterThan(0);
  });
});
