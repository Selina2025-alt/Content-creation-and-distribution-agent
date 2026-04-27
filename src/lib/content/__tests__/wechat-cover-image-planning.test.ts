import { describe, expect, it } from "vitest";

import { buildWechatCoverImagePlan } from "@/lib/content/wechat-cover-image-planning";

describe("buildWechatCoverImagePlan", () => {
  it("builds text-free, anti-ui prompts for wechat cover generation", () => {
    const plan = buildWechatCoverImagePlan({
      title: "普通人如何用 AI 提升工作效率",
      summary: "从认知到执行的五步方法，帮你稳定产出。",
      body: "## 认知升级\n先看清问题，再设计动作。\n\n## 执行路径\n把任务拆成可复用流程。"
    });

    expect(plan.images.length).toBeGreaterThan(0);

    const firstPrompt = plan.images[0]?.prompt ?? "";
    expect(firstPrompt).toContain("Create a premium article hero-cover artwork");
    expect(firstPrompt).toContain("Hard constraints: NO visible text");
    expect(firstPrompt).toContain("Branding constraints:");
    expect(firstPrompt).toContain("Corner constraints:");
    expect(firstPrompt).toContain("Scene constraints:");
    expect(firstPrompt).toContain("Absolute negatives:");
    expect(firstPrompt).toContain("no smartphone mockup");
    expect(firstPrompt).toContain("Character direction:");
    expect(firstPrompt).toContain("Do not put title, subtitle, labels");
    expect(firstPrompt).not.toContain("Create a premium WeChat article cover artwork");
    expect(firstPrompt).not.toContain("wechat");
    expect(firstPrompt).not.toContain("WeChat");
    expect(firstPrompt).not.toContain("朋友圈");
  });

  it("sanitizes social-platform trigger words from semantic context", () => {
    const plan = buildWechatCoverImagePlan({
      title: "为什么你发朋友圈越来越焦虑",
      summary: "从微信社交压力谈到心理边界建立。",
      body:
        "## 朋友圈比较陷阱\n你看到的是他人筛选后的结果，不是完整生活。\n\n## 走出内耗\n建立边界，减少被动刷屏。"
    });

    const firstPrompt = plan.images[0]?.prompt ?? "";
    expect(firstPrompt).not.toMatch(/朋友圈|微信|wechat/i);
    expect(plan.images[0]?.title ?? "").not.toMatch(/朋友圈|微信|wechat/i);
  });
});
