import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsShell } from "@/components/settings/settings-shell";
import type {
  PlatformId,
  SkillLearningResultRecord,
  SkillRecord
} from "@/lib/types";

const emptyPlatformSelections: Record<PlatformId, string[]> = {
  wechat: [],
  xiaohongshu: [],
  twitter: [],
  videoScript: []
};

const contentSkill: SkillRecord = {
  id: "content-skill",
  name: "XHS Viral Copy",
  sourceType: "prompt",
  sourceRef: "prompt:content-skill",
  summary: "Writes stronger Xiaohongshu hooks and captions.",
  status: "ready",
  skillKind: "content",
  createdAt: "2026-04-15T00:00:00.000Z",
  updatedAt: "2026-04-15T00:00:00.000Z"
};

const imageSkill: SkillRecord = {
  id: "image-skill",
  name: "Satori Code Cards",
  sourceType: "github",
  sourceRef: "https://github.com/vercel/satori",
  summary: "Creates designed social cards from code.",
  status: "ready",
  skillKind: "image",
  createdAt: "2026-04-15T00:00:00.000Z",
  updatedAt: "2026-04-15T00:00:00.000Z"
};

const contentLearning: SkillLearningResultRecord = {
  skillId: "content-skill",
  summary: contentSkill.summary,
  rules: ["Use a concrete pain point hook"],
  platformHints: ["xiaohongshu"],
  keywords: ["copy"],
  examplesSummary: ["prompt"],
  updatedAt: "2026-04-15T00:00:00.000Z"
};

const imageLearning: SkillLearningResultRecord = {
  skillId: "image-skill",
  summary: imageSkill.summary,
  rules: ["Use HTML/CSS composition and SVG export"],
  platformHints: ["xiaohongshu"],
  keywords: ["image", "satori"],
  examplesSummary: ["SKILL.md"],
  updatedAt: "2026-04-15T00:00:00.000Z"
};

describe("SettingsShell image skills", () => {
  it("separates content skills from image skills and lets Xiaohongshu bind image skills", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.includes("/api/platform-settings/xiaohongshu") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/skills/content-skill")) {
        return new Response(
          JSON.stringify({
            skill: contentSkill,
            learningResult: contentLearning,
            files: [],
            selectedFile: null
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <SettingsShell
        initialImageSkillSelections={emptyPlatformSelections}
        initialPlatformSelections={emptyPlatformSelections}
        initialSkillDetails={{
          [contentSkill.id]: contentLearning,
          [imageSkill.id]: imageLearning
        }}
        initialSkills={[contentSkill, imageSkill]}
      />
    );

    expect(screen.getByRole("heading", { name: "Content Skills" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Image Skills" })).toBeInTheDocument();

    const xhsPanel = screen.getByRole("region", { name: /小红书笔记规则/u });

    expect(
      within(xhsPanel).getByRole("button", { name: "XHS Viral Copy" })
    ).toBeInTheDocument();
    expect(
      within(xhsPanel).getByRole("button", { name: "Satori Code Cards" })
    ).toBeInTheDocument();

    await user.click(
      within(xhsPanel).getByRole("button", { name: "Satori Code Cards" })
    );
    await user.click(within(xhsPanel).getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/platform-settings/xiaohongshu",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            baseRules: [],
            enabledSkillIds: [],
            imageSkillIds: ["image-skill"]
          })
        })
      );
    });
  });
});
