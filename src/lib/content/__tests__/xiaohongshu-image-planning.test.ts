// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildXiaohongshuImagePlan } from "@/lib/content/xiaohongshu-image-planning";

describe("buildXiaohongshuImagePlan", () => {
  it("turns a complex Xiaohongshu note into a series-mode image plan with template prompts", () => {
    const plan = buildXiaohongshuImagePlan({
      title: "AI 学习路线别乱刷！新手 30 天真正有效的上手法",
      caption:
        "如果你刚开始学 AI，最容易踩的坑不是工具不会用，而是一上来就收藏一堆教程。先建立全局地图，再拆成提示词、自动化、工作流三个模块，每天只练一个真实任务，最后用复盘把方法沉淀下来。",
      imageSuggestions: [
        "封面：AI 学习路线地图，标题强钩子",
        "流程：30 天学习路径，从工具认知到真实项目",
        "概念：提示词、模型、工作流的关系",
        "对比：乱刷教程 vs 项目驱动学习",
        "清单：每天必须完成的 5 个动作",
        "框架：学习、练习、复盘、输出四层闭环",
        "场景：真实工作台和 AI 工具界面",
        "总结：新手最该记住的一句话",
        "CTA：收藏这份 AI 学习路线"
      ]
    });

    expect(plan.mode).toBe("Series Mode");
    expect(plan.images).toHaveLength(9);
    expect(plan.decision).toContain("决策：Series Mode");
    expect(plan.images[0]).toMatchObject({
      title: expect.stringContaining("AI"),
      type: 5,
      typeName: "综合框架/体系类",
      size: "landscape",
      colorScheme: "warm"
    });
    expect(plan.images[0].prompt).toContain("Series 1 of 9");
    expect(plan.images[0].prompt).toContain("手绘风格");
    expect(plan.images[0].prompt).toContain("米黄色复古纸张背景");
    expect(plan.images[1].prompt).toContain("流程/步骤类");
    expect(plan.images[3].prompt).toContain("对比分析类");
  });
});
