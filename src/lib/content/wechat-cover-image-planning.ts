import type {
  WechatContentBody,
  WechatCoverImagePlan,
  XiaohongshuColorScheme,
  XiaohongshuImagePlanItem,
  XiaohongshuImageSize,
  XiaohongshuImageType
} from "@/lib/types";

const TYPE_NAMES: Record<XiaohongshuImageType, string> = {
  1: "流程/步骤类",
  2: "概念解析类",
  3: "对比分析类",
  4: "清单/工具包类",
  5: "综合框架类"
};

const COVER_VISUAL_GUIDES: Record<XiaohongshuImageType, string> = {
  1: "one clear action scene, directional flow implied by gesture and composition",
  2: "single core metaphor scene, focused center subject, clean background",
  3: "split-scene contrast with two subjects, visual tension without labels",
  4: "curated objects or props around one hero subject, minimal arrangement",
  5: "layered world-building scene around one hero subject, cinematic depth"
};

const CHARACTER_STYLE_GUIDES = [
  "realistic human portrait, cinematic editorial mood",
  "stylized 3D cartoon character, expressive but premium look",
  "anime-inspired illustration character, clean linework and soft light",
  "minimal silhouette character with strong pose and atmosphere"
] as const;

const PLATFORM_TRIGGER_REPLACEMENTS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  { pattern: /朋友圈/gi, replacement: "社交互动" },
  { pattern: /公众号/gi, replacement: "内容平台" },
  { pattern: /微信/gi, replacement: "内容平台" },
  { pattern: /\bwechat\b/gi, replacement: "content platform" },
  { pattern: /\btwitter\b/gi, replacement: "social media" },
  { pattern: /\binstagram\b|\bins\b/gi, replacement: "social media" },
  { pattern: /\btiktok\b|抖音|快手|微博|小红书/gi, replacement: "social media" },
  { pattern: /\bapp\b|\bui\b|界面|截图|状态栏|导航栏|角标/gi, replacement: "" },
  { pattern: /logo|watermark|icon/gi, replacement: "" }
];

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeSemanticInput(value: string) {
  const normalized = PLATFORM_TRIGGER_REPLACEMENTS.reduce(
    (acc, { pattern, replacement }) => acc.replace(pattern, replacement),
    value
  );

  return compact(normalized)
    .replace(/[|]{2,}/g, "|")
    .replace(/\s{2,}/g, " ")
    .replace(/^[-:;,，。；\s]+|[-:;,，。；\s]+$/g, "");
}

function inferMode(input: { summary: string; body: string }) {
  const body = compact(input.body);
  const summary = compact(input.summary);
  const hasStructuredCopy =
    /(^|\n)\s{0,2}#{1,4}\s+/.test(input.body) ||
    /第[一二三四五六七八九十\d]+\s*[部分章节点]/.test(body) ||
    /首先|其次|最后|步骤|流程|框架|清单|对比/.test(body);

  if (hasStructuredCopy || body.length > 1200 || summary.length > 120) {
    return "Series Mode";
  }

  return "Simple Mode";
}

function inferColorScheme(text: string): XiaohongshuColorScheme {
  if (/技术|工程|架构|模型|分析|数据|系统/.test(text)) {
    return "cool";
  }

  if (/创意|营销|品牌|增长|热点|流量/.test(text)) {
    return "vibrant";
  }

  if (/商业|战略|历史|组织|管理|复盘/.test(text)) {
    return "classic";
  }

  return "warm";
}

function inferType(text: string, index: number): XiaohongshuImageType {
  if (/对比|vs|VS|差异|误区/.test(text)) {
    return 3;
  }

  if (/流程|步骤|路径|操作|执行/.test(text)) {
    return 1;
  }

  if (/概念|原理|机制|模型|定义/.test(text)) {
    return 2;
  }

  if (/清单|工具|列表|建议|方法/.test(text)) {
    return 4;
  }

  if (/框架|体系|地图|结构|全景/.test(text)) {
    return 5;
  }

  return index === 0 ? 5 : 2;
}

function sizeForWechatCover(): XiaohongshuImageSize {
  return "landscape";
}

function splitSections(body: string) {
  const headingSections = body
    .split(/\n(?=#{1,4}\s+)/g)
    .map((section) => compact(section))
    .filter(Boolean);

  if (headingSections.length >= 2) {
    return headingSections;
  }

  return body
    .split(/\n{2,}/g)
    .map((section) => compact(section))
    .filter((section) => section.length > 18);
}

function buildCandidateTitle(input: {
  articleTitle: string;
  sectionText: string;
  index: number;
}) {
  const plain = sanitizeSemanticInput(
    input.sectionText
      .replace(/^#{1,4}\s*/, "")
      .replace(/^\d+[\.\)]\s*/, "")
      .trim()
  );
  const [firstClause] = plain.split(/[，。；;\n]/);
  const normalized = compact(firstClause || plain).slice(0, 18);

  if (input.index === 0) {
    return normalized || sanitizeSemanticInput(input.articleTitle).slice(0, 18);
  }

  return normalized || `核心观点 ${input.index + 1}`;
}

function extractSemanticKeywords(text: string, fallback: string) {
  const source = sanitizeSemanticInput(
    compact(text)
      .replace(/^#{1,4}\s*/g, "")
      .replace(/[“”"'`]/g, "")
      .replace(/\s+/g, " ")
  );
  const segments = source
    .split(/[，。；：,.!?]/g)
    .map((segment) => compact(segment))
    .filter((segment) => segment.length >= 2)
    .slice(0, 3);

  if (segments.length > 0) {
    return segments.join(" | ");
  }

  return sanitizeSemanticInput(compact(fallback)).slice(0, 42);
}

function inferCharacterDirection(input: {
  sectionText: string;
  type: XiaohongshuImageType;
  index: number;
}) {
  const source = sanitizeSemanticInput(`${input.sectionText}`).toLowerCase();

  if (/心理|情绪|关系|自我|焦虑/.test(source)) {
    return "expressive human close-up portrait, emotion-driven lighting";
  }

  if (/技术|系统|工程|ai|模型|数据/.test(source)) {
    return "professional human figure in a modern tech scene";
  }

  if (/社交互动|social media|content platform|app|ui|界面|截图/.test(source)) {
    return "single human character in a real-world scene, no smartphone, no interface, no overlays";
  }

  if (input.type === 3) {
    return "two contrasting human characters in one split scene";
  }

  return CHARACTER_STYLE_GUIDES[input.index % CHARACTER_STYLE_GUIDES.length];
}

function buildPrompt(input: {
  articleTitle: string;
  articleSummary: string;
  sectionText: string;
  candidateTitle: string;
  type: XiaohongshuImageType;
  typeName: string;
  colorScheme: XiaohongshuColorScheme;
  index: number;
}) {
  const semanticKeywords = extractSemanticKeywords(
    input.sectionText,
    `${input.articleTitle} ${input.articleSummary}`
  );
  const safeCandidateTitle = sanitizeSemanticInput(input.candidateTitle);
  const characterDirection = inferCharacterDirection({
    sectionText: input.sectionText,
    type: input.type,
    index: input.index
  });

  return [
    "Create a premium article hero-cover artwork in 16:9 landscape ratio.",
    "Goal: visually striking cover image with high aesthetics and strong readability on mobile.",
    `Theme intent (semantic only, never render as text): ${safeCandidateTitle}`,
    `Semantic context keywords (semantic only): ${semanticKeywords}`,
    `Visual structure: ${input.typeName}; ${COVER_VISUAL_GUIDES[input.type]}`,
    `Character direction: ${characterDirection}`,
    `Color style: ${input.colorScheme}`,
    "Quality bar: cinematic lighting, clean composition, depth of field, polished details, premium editorial look.",
    "Hard constraints: NO visible text, NO typography, NO Chinese/English letters, NO numbers, NO logo, NO watermark, NO UI screenshot.",
    "Branding constraints: NO platform identity, NO social-app references, NO chat-bubble icon, NO product-like badge.",
    "Corner constraints: all corners must stay clean, with no corner badges, no app symbols, no labels, no tiny icons.",
    "Scene constraints: no device frame, no app header, no fake UI chrome, no interface overlay, no status bar, no profile avatar, no notification badge.",
    "Absolute negatives: no smartphone mockup, no tablet frame, no chat window, no social feed card, no software panel, no launcher icons.",
    "Content constraints: only keep visual elements directly relevant to the article theme; remove unrelated decorative icons and symbols.",
    "Do not put title, subtitle, labels, or any readable words in the image.",
    "If text artifacts appear, regenerate with a fully textless design."
  ].join("\n");
}

export function buildWechatCoverImagePlan(input: {
  title: string;
  summary: string;
  body: string;
}): WechatCoverImagePlan {
  const mode = inferMode({ summary: input.summary, body: input.body });
  const sections = splitSections(input.body);
  const candidateCount =
    mode === "Simple Mode" ? 1 : Math.min(3, Math.max(2, sections.length));
  const selectedSections = sections.slice(0, candidateCount);
  const fallbackSection = sanitizeSemanticInput(
    compact(`${input.title} ${input.summary}`)
  );

  const images: XiaohongshuImagePlanItem[] = Array.from({
    length: candidateCount
  }).map((_, index) => {
    const sectionText = selectedSections[index] ?? fallbackSection;
    const candidateTitle = buildCandidateTitle({
      articleTitle: input.title,
      sectionText,
      index
    });
    const type = inferType(`${candidateTitle} ${sectionText}`, index);
    const typeName = TYPE_NAMES[type];
    const colorScheme = inferColorScheme(
      `${input.title} ${input.summary} ${sectionText}`
    );
    const size = sizeForWechatCover();

    return {
      id: `wechat-cover-${index + 1}`,
      title: candidateTitle,
      type,
      typeName,
      size,
      colorScheme,
      prompt: buildPrompt({
        articleTitle: input.title,
        articleSummary: input.summary,
        sectionText,
        candidateTitle,
        type,
        typeName,
        colorScheme,
        index
      })
    };
  });

  const decision = [
    `预计模式：${mode}`,
    `预计候选图片数量：${images.length} 张`,
    ...images.map(
      (image, index) =>
        `图${index + 1}：[${image.title}]（类型${image.type} - ${image.typeName}，尺寸${image.size}）`
    )
  ].join("\n");

  return {
    mode,
    decision,
    images,
    selectedImageId: images[0]?.id
  };
}

export function ensureWechatCoverImagePlan(
  content: WechatContentBody
): WechatContentBody & { coverImagePlan: WechatCoverImagePlan } {
  const plan =
    content.coverImagePlan && content.coverImagePlan.images.length > 0
      ? content.coverImagePlan
      : buildWechatCoverImagePlan({
          title: content.title,
          summary: content.summary,
          body: content.body
        });

  const hasSelectedId = Boolean(
    plan.selectedImageId && plan.images.some((image) => image.id === plan.selectedImageId)
  );

  return {
    ...content,
    coverImagePlan: {
      ...plan,
      selectedImageId: hasSelectedId ? plan.selectedImageId : plan.images[0]?.id
    }
  };
}
