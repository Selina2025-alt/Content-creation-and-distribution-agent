// @vitest-environment node

import { describe, expect, it } from "vitest";

import { learnSkill } from "@/lib/skills/skill-learning-service";

describe("learnSkill", () => {
  it("extracts capabilities and platform hints from skill markdown", () => {
    const result = learnSkill({
      markdown: [
        "---",
        "name: huashu-wechat-creation",
        "description: 花叔公众号内容创作全流程辅助",
        "---",
        "",
        "# 花叔公众号内容创作指南",
        "",
        "能力包含：",
        "- 风格规范指导（10条必须做到 + 10条必须避免）",
        "- 选题讨论（提供3-4个选题方向及大纲）",
        "- 内容创作（初稿撰写 + 三遍审校）",
        "",
        "触发条件：",
        "- 需要创作公众号内容"
      ].join("\n"),
      references: ["huashu-wechat-creation/SKILL.md"]
    });

    expect(result.summary).toBe("花叔公众号内容创作全流程辅助");
    expect(result.rules).toContain("风格规范指导（10条必须做到 + 10条必须避免）");
    expect(result.rules).toContain("选题讨论（提供3-4个选题方向及大纲）");
    expect(result.platformHints).toContain("wechat");
    expect(result.keywords).toContain("公众号");
  });
});
