// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  ensureXiaohongshuImageAssets,
  generateXiaohongshuImageAssets
} from "@/lib/content/xiaohongshu-image-card-generator";

function decodeSvg(dataUrl: string) {
  const [, encodedSvg] = dataUrl.split(",", 2);
  return decodeURIComponent(encodedSvg);
}

describe("generateXiaohongshuImageAssets", () => {
  it("turns nine image prompts into visible generated image assets", () => {
    const assets = generateXiaohongshuImageAssets({
      title: "工作效率翻倍！我的 5 个神仙方法✨",
      imageSuggestions: Array.from({ length: 9 }, (_, index) => `图片 ${index + 1}：办公效率场景`)
    });

    expect(assets).toHaveLength(9);
    expect(assets[0]).toMatchObject({
      title: expect.stringContaining("工作效率"),
      prompt: expect.stringContaining("办公效率场景"),
      provider: "local-svg"
    });
    expect(assets[0].src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it("creates polished Xiaohongshu knowledge cards instead of sparse placeholders", () => {
    const assets = generateXiaohongshuImageAssets({
      title: "别再乱学 AI！新手 30 天上手路线",
      caption: "先建立全局地图，再拆成提示词、自动化、工作流三个模块，每天只练一个真实任务。",
      imageSuggestions: [
        "封面：AI 学习路线地图，标题强钩子",
        "流程：30 天学习路径，从工具认知到真实项目",
        "概念：提示词、模型、工作流的关系"
      ]
    });

    const svg = decodeSvg(assets[0].src);

    expect(svg).toContain('data-card-version="xhs-v2"');
    expect(svg).toContain("小红书知识卡");
    expect(svg).toContain("收藏后照着做");
    expect(svg).toContain("别再乱学 AI");
    expect(svg).not.toContain("CONTENT FACTORY");
  });

  it("fills missing image prompts so legacy notes still show a full carousel", () => {
    const assets = generateXiaohongshuImageAssets({
      title: "效率翻倍",
      imageSuggestions: []
    });

    expect(assets).toHaveLength(9);
    expect(assets[0].prompt).toContain("封面");
  });

  it("regenerates legacy sparse SVG cards when opening old notes", () => {
    const legacySvg = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>CONTENT FACTORY</text></svg>'
    );
    const content = ensureXiaohongshuImageAssets({
      title: "效率翻倍",
      caption: "每天只做一个真实任务，复盘后沉淀为模板。",
      imageSuggestions: ["封面：效率翻倍路线图"],
      imageAssets: Array.from({ length: 9 }, (_, index) => ({
        id: `legacy-${index}`,
        title: "旧图",
        prompt: "旧提示词",
        alt: "旧图",
        src: `data:image/svg+xml;charset=utf-8,${legacySvg}`,
        provider: "local-svg" as const
      }))
    });

    expect(decodeSvg(content.imageAssets[0].src)).toContain('data-card-version="xhs-v2"');
  });
});
