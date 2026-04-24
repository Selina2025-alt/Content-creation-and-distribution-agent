import { parseSkillMarkdown } from "@/lib/skills/skill-parser";

const capabilityHeadingPatterns = [
  /能力/,
  /触发条件/,
  /工作流程/,
  /使用方式/,
  /输出标准/,
  /必须做到/,
  /when to use/i,
  /workflow/i,
  /capabilities/i,
  /rules/i
];

function headingMatchesCapabilities(text: string) {
  return capabilityHeadingPatterns.some((pattern) => pattern.test(text));
}

function extractCapabilityRules(markdown: string) {
  const rules: string[] = [];
  let isCapturing = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const markdownHeading = line.match(/^#{1,6}\s+(.+)$/);
    const colonHeading = line.match(/^(.+?)[：:]$/);
    const headingText = markdownHeading?.[1] ?? colonHeading?.[1] ?? null;

    if (headingText) {
      isCapturing = headingMatchesCapabilities(headingText);
      continue;
    }

    const bullet = line.match(/^(?:[-*]|\d+\.)\s+(.+)$/);

    if (!isCapturing || !bullet?.[1]) {
      continue;
    }

    rules.push(bullet[1]);

    if (rules.length >= 6) {
      break;
    }
  }

  return rules;
}

function inferPlatformHints(markdown: string) {
  const hints = new Set<string>();

  if (/公众号|微信|wechat|weixin/i.test(markdown)) {
    hints.add("wechat");
  }

  if (/小红书|xiaohongshu|rednote/i.test(markdown)) {
    hints.add("xiaohongshu");
  }

  if (/twitter|tweet|thread|推文|x\.com/i.test(markdown)) {
    hints.add("twitter");
  }

  if (/视频|分镜|脚本|video|script/i.test(markdown)) {
    hints.add("videoScript");
  }

  return Array.from(hints);
}

function extractKeywords(markdown: string, title: string, description: string) {
  const keywords = new Set<string>();
  const source = `${title} ${description}`;

  for (const match of source.matchAll(/[A-Za-z0-9][A-Za-z0-9_.-]{2,}/g)) {
    keywords.add(match[0].toLowerCase());
  }

  for (const keyword of [
    "公众号",
    "小红书",
    "Twitter",
    "视频",
    "长文",
    "写作",
    "选题",
    "审校",
    "风格",
    "内容创作"
  ]) {
    if (markdown.includes(keyword)) {
      keywords.add(keyword);
    }
  }

  return Array.from(keywords).slice(0, 8);
}

export function learnSkill(input: { markdown: string; references: string[] }) {
  const parsed = parseSkillMarkdown(input.markdown);
  const extractedRules = extractCapabilityRules(input.markdown);

  return {
    summary: parsed.description,
    rules:
      extractedRules.length > 0
        ? extractedRules
        : ["Read SKILL.md", "Apply workflow before generation"],
    platformHints: inferPlatformHints(input.markdown),
    keywords: extractKeywords(input.markdown, parsed.title, parsed.description),
    examplesSummary: input.references.slice(0, 3)
  };
}
