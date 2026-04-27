import type {
  XiaohongshuColorScheme,
  XiaohongshuImagePlan,
  XiaohongshuImagePlanItem,
  XiaohongshuImageSize,
  XiaohongshuImageType
} from "@/lib/types";

const TYPE_NAMES: Record<XiaohongshuImageType, string> = {
  1: "流程/步骤类",
  2: "概念解析类",
  3: "对比分析类",
  4: "清单/工具包类",
  5: "综合框架/体系类"
};

const DEFAULT_SUGGESTIONS = [
  "封面：主题总览，强钩子标题与生活化场景",
  "流程：从痛点到行动的完整步骤",
  "概念：核心方法的关系拆解",
  "对比：错误做法 vs 正确做法",
  "清单：可收藏的行动工具包",
  "框架：方法闭环与关键模块",
  "场景：真实桌面、手机和工具界面",
  "总结：一句话收束核心观点",
  "CTA：收藏、评论和下一步行动"
];

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function inferMode(input: { caption: string; imageSuggestions: string[] }) {
  const ideaCount = input.imageSuggestions.filter(Boolean).length;
  const hasStructuredCopy = /[1-9一二三四五六七八九][\.、]|首先|其次|最后|步骤|方法|框架|清单|对比/.test(
    input.caption
  );

  return ideaCount > 1 || input.caption.length > 140 || hasStructuredCopy
    ? "Series Mode"
    : "Simple Mode";
}

function inferColorScheme(text: string): XiaohongshuColorScheme {
  if (/学习|成长|方法|效率|自我|知识|复盘/.test(text)) {
    return "warm";
  }

  if (/商业|管理|战略|历史|品牌|融资|组织/.test(text)) {
    return "classic";
  }

  if (/技术|AI|数据|分析|工程|模型|系统/.test(text)) {
    return "cool";
  }

  if (/创意|营销|爆款|娱乐|潮流|副业/.test(text)) {
    return "vibrant";
  }

  return "warm";
}

function inferType(input: {
  suggestion: string;
  index: number;
  title: string;
}): XiaohongshuImageType {
  if (/^(对比|VS|vs|差异|误区)[：:]/.test(input.suggestion)) {
    return 3;
  }

  if (/^(流程|步骤|路径|路线|操作)[：:]/.test(input.suggestion)) {
    return 1;
  }

  if (/^(概念|原理|机制|本质)[：:]/.test(input.suggestion)) {
    return 2;
  }

  if (/^(清单|工具|列表|收藏)[：:]/.test(input.suggestion)) {
    return 4;
  }

  if (/^(框架|体系|地图|总览)[：:]/.test(input.suggestion)) {
    return 5;
  }

  const text = `${input.title} ${input.suggestion}`;

  if (input.index === 0) {
    return 5;
  }

  if (/步骤|流程|路径|路线|怎么做|操作|行动/.test(text)) {
    return 1;
  }

  if (/概念|原理|关系|机制|本质|是什么/.test(text)) {
    return 2;
  }

  if (/对比|VS|vs|差异|前后|误区|错误/.test(text)) {
    return 3;
  }

  if (/清单|工具|列表|收藏| checklist|动作/.test(text)) {
    return 4;
  }

  if (/框架|体系|闭环|地图|总览|结构/.test(text)) {
    return 5;
  }

  const rotation: XiaohongshuImageType[] = [1, 2, 3, 4, 5];
  return rotation[(input.index - 1) % rotation.length];
}

function sizeForType(type: XiaohongshuImageType, text: string): XiaohongshuImageSize {
  if (type === 1) {
    return "portrait";
  }

  if (type === 3) {
    return "landscape";
  }

  if (type === 4) {
    return text.length > 42 ? "portrait" : "square";
  }

  if (type === 5) {
    return "landscape";
  }

  return "square";
}

function titleFromSuggestion(suggestion: string, fallback: string) {
  const normalized = compact(suggestion)
    .replace(/^第?\s*\d+\s*张?图?[：:.-]?\s*/, "")
    .replace(/^(封面|流程|概念|对比|清单|框架|场景|总结|CTA)[：:]\s*/, "");
  const [beforeComma] = normalized.split(/[，,。]/);

  return (beforeComma || fallback).slice(0, 28);
}

function normalizeSuggestions(input: { title: string; imageSuggestions: string[] }) {
  const suggestions = input.imageSuggestions
    .map((item) => compact(item))
    .filter(Boolean)
    .slice(0, 9);

  for (const fallback of DEFAULT_SUGGESTIONS) {
    if (suggestions.length >= 9) {
      break;
    }

    suggestions.push(fallback.replace("主题", input.title));
  }

  return suggestions;
}

function templatePrompt(input: {
  title: string;
  caption: string;
  suggestion: string;
  index: number;
  total: number;
  type: XiaohongshuImageType;
  typeName: string;
  size: XiaohongshuImageSize;
  colorScheme: XiaohongshuColorScheme;
}) {
  const series = `Series ${input.index + 1} of ${input.total}`;
  const source = compact(input.caption).slice(0, 180);
  const base = [
    `${series}，${input.typeName}，尺寸 ${input.size}，配色 ${input.colorScheme}。`,
    `主题「${input.title}」，本图重点：${input.suggestion}。`,
    `素材摘要：${source}。`,
    "视觉风格：手绘风格知识图谱海报，TED 演讲笔记质感，米黄色复古纸张背景，细微纸纹，手绘波浪线、箭头、虚线框、星号装饰，中文排版清晰。"
  ];

  if (input.type === 1) {
    return [
      ...base,
      "模版1：流程/步骤类。布局采用从上到下或从左到右的流程结构，每个步骤用圆角卡片承载，连接线显示顺序，底部放关键提醒。"
    ].join("\n");
  }

  if (input.type === 2) {
    return [
      ...base,
      "模版2：概念解析类。布局采用中心放射状结构，中心写核心概念，周围 3-5 个维度用手绘曲线连接，并用灯泡、书本、齿轮等小图标辅助理解。"
    ].join("\n");
  }

  if (input.type === 3) {
    return [
      ...base,
      "模版3：对比分析类。布局采用左右对称对比，中间使用 VS/闪电/波浪分隔，左右分别列出要点，底部给一句清晰结论。"
    ].join("\n");
  }

  if (input.type === 4) {
    return [
      ...base,
      "模版4：清单/工具包类。布局采用网格或列表结构，每个行动项前加复选框或星标，重点推荐用高亮边框，底部用气泡强调收藏价值。"
    ].join("\n");
  }

  return [
    ...base,
    "模版5：综合框架/体系类。布局采用多层次放射 + 分区结构，中心放大标题，周围拆成多个核心部分，用粗线条连接，关键亮点用星标与数据标注。"
  ].join("\n");
}

export function buildXiaohongshuImagePlan(input: {
  title: string;
  caption: string;
  imageSuggestions: string[];
}): XiaohongshuImagePlan {
  const suggestions = normalizeSuggestions(input);
  const mode = inferMode(input);
  const images: XiaohongshuImagePlanItem[] = suggestions.map((suggestion, index) => {
    const type = inferType({
      suggestion,
      index,
      title: input.title
    });
    const typeName = TYPE_NAMES[type];
    const colorScheme = inferColorScheme(`${input.title} ${input.caption} ${suggestion}`);
    const size = sizeForType(type, suggestion);
    const title = index === 0
      ? input.title.slice(0, 28)
      : titleFromSuggestion(suggestion, `配图 ${index + 1}`);

    return {
      id: `xhs-plan-${index + 1}`,
      title,
      type,
      typeName,
      size,
      colorScheme,
      prompt: templatePrompt({
        title,
        caption: input.caption,
        suggestion,
        index,
        total: suggestions.length,
        type,
        typeName,
        size,
        colorScheme
      })
    };
  });

  const decisionLines = [
    `决策：${mode}（${mode}）`,
    ...images.map(
      (image, index) =>
        `图${index + 1}：${image.title}（类型${image.type} - ${image.typeName}）`
    )
  ];

  return {
    mode,
    decision: decisionLines.join("\n"),
    images
  };
}
