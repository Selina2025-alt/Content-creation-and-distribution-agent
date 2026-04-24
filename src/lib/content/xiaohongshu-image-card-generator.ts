import { buildXiaohongshuImagePlan } from "@/lib/content/xiaohongshu-image-planning";
import type {
  XiaohongshuColorScheme,
  XiaohongshuImageAsset,
  XiaohongshuImagePlan,
  XiaohongshuImagePlanItem,
  XiaohongshuImageType
} from "@/lib/types";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440;

const palettes: Record<
  XiaohongshuColorScheme,
  {
    paper: string;
    wash: string;
    accent: string;
    accentDeep: string;
    accentSoft: string;
    ink: string;
    muted: string;
  }
> = {
  warm: {
    paper: "#fff6e8",
    wash: "#fbe2c1",
    accent: "#f08a4b",
    accentDeep: "#8f2f18",
    accentSoft: "#ffd79f",
    ink: "#241815",
    muted: "#745347"
  },
  cool: {
    paper: "#eff7fb",
    wash: "#d4ebf6",
    accent: "#57a7d8",
    accentDeep: "#1f5272",
    accentSoft: "#bde6fb",
    ink: "#16222c",
    muted: "#526879"
  },
  vibrant: {
    paper: "#fff1f4",
    wash: "#ffe0a8",
    accent: "#f65f78",
    accentDeep: "#8d1f3a",
    accentSoft: "#a8f0c6",
    ink: "#22161b",
    muted: "#7a4b58"
  },
  classic: {
    paper: "#f7efe2",
    wash: "#ead6b7",
    accent: "#b88a2f",
    accentDeep: "#273f6b",
    accentSoft: "#f0d17a",
    ink: "#191817",
    muted: "#5d5145"
  }
};

const typeLabels: Record<XiaohongshuImageType, string> = {
  1: "流程步骤",
  2: "概念拆解",
  3: "对比分析",
  4: "清单工具",
  5: "体系框架"
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function titleFromSuggestion(suggestion: string, fallback: string) {
  const normalized = suggestion.replace(/^第?\s*\d+\s*张?图?[：:.-]?\s*/, "").trim();
  const [beforeColon] = normalized.split(/[：:]/);

  return (beforeColon || fallback).trim().slice(0, 18);
}

function cleanText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/Series\s+\d+\s+of\s+\d+[，,。.]?/gi, "")
    .replace(/模板\d[：:][^。]*。?/g, "")
    .trim();
}

function splitText(value: string, maxLength = 12, maxLines = 4) {
  const clean = cleanText(value);
  const lines: string[] = [];

  for (let index = 0; index < clean.length && lines.length < maxLines; index += maxLength) {
    lines.push(clean.slice(index, index + maxLength));
  }

  return lines.length > 0 ? lines : ["小红书配图"];
}

function splitIdeaPieces(value: string) {
  return cleanText(value)
    .replace(/^(封面|流程|概念|对比|清单|框架|场景|总结|CTA)[：:]\s*/, "")
    .split(/[。；;，,、\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !/^尺寸|^配色|^视觉风格/.test(item));
}

function fallbackPointsForType(type: XiaohongshuImageType) {
  if (type === 1) {
    return ["先看痛点", "再拆步骤", "最后复盘"];
  }

  if (type === 2) {
    return ["核心概念", "关键关系", "使用边界"];
  }

  if (type === 3) {
    return ["错误做法", "推荐做法", "立刻调整"];
  }

  if (type === 4) {
    return ["今天就用", "低成本开始", "可复制模板"];
  }

  return ["主线地图", "关键模块", "行动闭环"];
}

function getCardPoints(input: {
  caption?: string;
  suggestion: string;
  type: XiaohongshuImageType;
}) {
  const points = [
    ...splitIdeaPieces(input.suggestion),
    ...splitIdeaPieces(input.caption ?? "")
  ];
  const uniquePoints = Array.from(new Set(points))
    .map((point) => point.slice(0, 22))
    .filter(Boolean)
    .slice(0, 5);

  return uniquePoints.length >= 3 ? uniquePoints : fallbackPointsForType(input.type);
}

function renderTextLines(input: {
  lines: string[];
  x: number;
  y: number;
  fontSize: number;
  lineHeight: number;
  fill: string;
  weight?: number;
  opacity?: number;
  anchor?: "start" | "middle";
}) {
  return input.lines
    .map(
      (line, index) =>
        `<text x="${input.x}" y="${input.y + index * input.lineHeight}" font-size="${input.fontSize}" font-weight="${input.weight ?? 500}" fill="${input.fill}" opacity="${input.opacity ?? 1}" text-anchor="${input.anchor ?? "start"}">${escapeXml(line)}</text>`
    )
    .join("");
}

function renderBullet(input: {
  x: number;
  y: number;
  width: number;
  index: number;
  label: string;
  palette: (typeof palettes)[XiaohongshuColorScheme];
}) {
  const labelLines = splitText(input.label, 13, 2);
  return `
    <g>
      <rect x="${input.x}" y="${input.y}" width="${input.width}" height="116" rx="28" fill="#fffaf4" opacity="0.92" />
      <circle cx="${input.x + 44}" cy="${input.y + 54}" r="24" fill="${input.palette.accent}" opacity="0.9" />
      <text x="${input.x + 44}" y="${input.y + 63}" font-size="22" font-weight="900" fill="#fffaf4" text-anchor="middle">${input.index}</text>
      ${renderTextLines({
        lines: labelLines,
        x: input.x + 86,
        y: input.y + 48,
        fontSize: 25,
        lineHeight: 34,
        fill: input.palette.ink,
        weight: 800
      })}
    </g>
  `;
}

function renderFlowModule(points: string[], palette: (typeof palettes)[XiaohongshuColorScheme]) {
  const steps = points.slice(0, 4);
  return `
    <g transform="translate(94 680)">
      <path d="M78 72 C270 8 390 116 578 56 C700 18 804 40 890 92" fill="none" stroke="${palette.accent}" stroke-width="14" stroke-linecap="round" opacity="0.32" />
      ${steps
        .map((point, index) =>
          renderBullet({
            x: 0,
            y: index * 136,
            width: 892,
            index: index + 1,
            label: point,
            palette
          })
        )
        .join("")}
    </g>
  `;
}

function renderConceptModule(points: string[], palette: (typeof palettes)[XiaohongshuColorScheme]) {
  const bubbles = points.slice(0, 4);
  const positions = [
    [96, 58],
    [600, 58],
    [96, 316],
    [600, 316]
  ];

  return `
    <g transform="translate(92 710)">
      <circle cx="446" cy="212" r="138" fill="${palette.accent}" opacity="0.88" />
      <circle cx="446" cy="212" r="162" fill="none" stroke="${palette.accentDeep}" stroke-width="4" stroke-dasharray="12 14" opacity="0.36" />
      <text x="446" y="198" text-anchor="middle" font-size="30" font-weight="900" fill="#fffaf4">核心</text>
      <text x="446" y="240" text-anchor="middle" font-size="30" font-weight="900" fill="#fffaf4">概念</text>
      ${bubbles
        .map((point, index) => {
          const [x, y] = positions[index];
          return `
            <g>
              <path d="M446 212 L${x + 108} ${y + 56}" stroke="${palette.accentDeep}" stroke-width="4" stroke-dasharray="8 10" opacity="0.28" />
              <rect x="${x}" y="${y}" width="218" height="116" rx="34" fill="#fffaf4" opacity="0.94" />
              ${renderTextLines({
                lines: splitText(point, 8, 2),
                x: x + 109,
                y: y + 48,
                fontSize: 23,
                lineHeight: 32,
                fill: palette.ink,
                weight: 800,
                anchor: "middle"
              })}
            </g>
          `;
        })
        .join("")}
    </g>
  `;
}

function renderComparisonModule(points: string[], palette: (typeof palettes)[XiaohongshuColorScheme]) {
  const left = points[0] ?? "旧做法";
  const right = points[1] ?? "新做法";
  const conclusion = points[2] ?? "先从一个动作开始";

  return `
    <g transform="translate(86 700)">
      <rect x="0" y="0" width="420" height="420" rx="44" fill="#fffaf4" opacity="0.94" />
      <rect x="478" y="0" width="420" height="420" rx="44" fill="#fffaf4" opacity="0.94" />
      <text x="210" y="82" text-anchor="middle" font-size="36" font-weight="900" fill="${palette.accentDeep}">别这样</text>
      <text x="688" y="82" text-anchor="middle" font-size="36" font-weight="900" fill="${palette.accentDeep}">换成这样</text>
      <text x="449" y="226" text-anchor="middle" font-size="48" font-weight="900" fill="${palette.accent}">VS</text>
      ${renderTextLines({
        lines: splitText(left, 10, 4),
        x: 210,
        y: 166,
        fontSize: 28,
        lineHeight: 42,
        fill: palette.ink,
        weight: 800,
        anchor: "middle"
      })}
      ${renderTextLines({
        lines: splitText(right, 10, 4),
        x: 688,
        y: 166,
        fontSize: 28,
        lineHeight: 42,
        fill: palette.ink,
        weight: 800,
        anchor: "middle"
      })}
      <rect x="92" y="468" width="714" height="92" rx="34" fill="${palette.accent}" opacity="0.92" />
      ${renderTextLines({
        lines: splitText(conclusion, 18, 1),
        x: 449,
        y: 526,
        fontSize: 30,
        lineHeight: 36,
        fill: "#fffaf4",
        weight: 900,
        anchor: "middle"
      })}
    </g>
  `;
}

function renderChecklistModule(points: string[], palette: (typeof palettes)[XiaohongshuColorScheme]) {
  const items = points.slice(0, 5);
  return `
    <g transform="translate(94 676)">
      <rect x="0" y="0" width="892" height="596" rx="48" fill="#fffaf4" opacity="0.94" />
      ${items
        .map((point, index) => {
          const y = 56 + index * 96;
          return `
            <g>
              <rect x="54" y="${y - 34}" width="52" height="52" rx="16" fill="${palette.accent}" opacity="0.88" />
              <path d="M66 ${y - 8} L78 ${y + 6} L102 ${y - 22}" fill="none" stroke="#fffaf4" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
              ${renderTextLines({
                lines: splitText(point, 18, 1),
                x: 134,
                y,
                fontSize: 31,
                lineHeight: 36,
                fill: palette.ink,
                weight: 850
              })}
              <path d="M54 ${y + 42} H828" stroke="${palette.accentDeep}" stroke-width="2" stroke-dasharray="8 12" opacity="0.12" />
            </g>
          `;
        })
        .join("")}
    </g>
  `;
}

function renderFrameworkModule(points: string[], palette: (typeof palettes)[XiaohongshuColorScheme]) {
  const blocks = points.slice(0, 4);
  const positions = [
    [0, 0],
    [476, 0],
    [0, 260],
    [476, 260]
  ];

  return `
    <g transform="translate(92 704)">
      <path d="M446 44 C608 42 756 152 806 292 C862 452 738 560 446 560 C154 560 30 452 86 292 C136 152 284 42 446 44Z" fill="${palette.wash}" opacity="0.58" />
      ${blocks
        .map((point, index) => {
          const [x, y] = positions[index];
          return `
            <g>
              <rect x="${x}" y="${y}" width="416" height="206" rx="42" fill="#fffaf4" opacity="0.94" />
              <text x="${x + 44}" y="${y + 62}" font-size="25" font-weight="900" fill="${palette.accent}">Part ${index + 1}</text>
              ${renderTextLines({
                lines: splitText(point, 11, 3),
                x: x + 44,
                y: y + 114,
                fontSize: 29,
                lineHeight: 39,
                fill: palette.ink,
                weight: 850
              })}
            </g>
          `;
        })
        .join("")}
      <circle cx="446" cy="256" r="98" fill="${palette.accentDeep}" opacity="0.92" />
      <text x="446" y="246" text-anchor="middle" font-size="28" font-weight="900" fill="#fffaf4">知识</text>
      <text x="446" y="286" text-anchor="middle" font-size="28" font-weight="900" fill="#fffaf4">地图</text>
    </g>
  `;
}

function renderModule(input: {
  type: XiaohongshuImageType;
  points: string[];
  palette: (typeof palettes)[XiaohongshuColorScheme];
}) {
  if (input.type === 1) {
    return renderFlowModule(input.points, input.palette);
  }

  if (input.type === 2) {
    return renderConceptModule(input.points, input.palette);
  }

  if (input.type === 3) {
    return renderComparisonModule(input.points, input.palette);
  }

  if (input.type === 4) {
    return renderChecklistModule(input.points, input.palette);
  }

  return renderFrameworkModule(input.points, input.palette);
}

function getFallbackSuggestions(title: string) {
  return [
    `封面：${title}，醒目标题和生活方式场景`,
    "场景图：真实桌面、手机、电脑和笔记本",
    "痛点图：把用户当前卡住的问题视觉化",
    "方法图：三到五个步骤做成清晰卡片",
    "细节图：关键动作的近景特写",
    "对比图：行动前后状态并排呈现",
    "清单图：可收藏的方法列表",
    "总结图：一句话概括核心观点",
    "结尾图：收藏关注 CTA，清爽生活场景"
  ];
}

export function normalizeXiaohongshuImageSuggestions(input: {
  title: string;
  imageSuggestions: string[];
}) {
  const suggestions = input.imageSuggestions
    .map((suggestion) => suggestion.trim())
    .filter(Boolean)
    .slice(0, 9);

  for (const fallback of getFallbackSuggestions(input.title)) {
    if (suggestions.length >= 9) {
      break;
    }

    suggestions.push(fallback);
  }

  return suggestions;
}

function buildCardSvg(input: {
  title: string;
  caption?: string;
  prompt: string;
  suggestion: string;
  index: number;
  total: number;
  planItem?: XiaohongshuImagePlanItem;
}) {
  const type = input.planItem?.type ?? 5;
  const palette = palettes[input.planItem?.colorScheme ?? "warm"];
  const titleLines = splitText(input.title, 11, 4);
  const subtitle = input.suggestion.replace(/^(封面|流程|概念|对比|清单|框架|场景|总结|CTA)[：:]\s*/, "");
  const subtitleLines = splitText(subtitle, 19, 2);
  const points = getCardPoints({
    caption: input.caption,
    suggestion: input.suggestion,
    type
  });
  const moduleSvg = renderModule({
    type,
    points,
    palette
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" data-card-version="xhs-v2" role="img">
      <title>${escapeXml(input.title)}</title>
      <desc>小红书知识卡：${escapeXml(input.suggestion)}</desc>
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${palette.paper}" />
          <stop offset="0.56" stop-color="#fffaf2" />
          <stop offset="1" stop-color="${palette.wash}" />
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="26" stdDeviation="32" flood-color="${palette.accentDeep}" flood-opacity="0.18" />
        </filter>
        <pattern id="grain" width="42" height="42" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="10" r="1.2" fill="${palette.accentDeep}" opacity="0.08" />
          <circle cx="32" cy="24" r="1" fill="${palette.accent}" opacity="0.1" />
        </pattern>
      </defs>
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)" />
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#grain)" />
      <circle cx="922" cy="134" r="220" fill="${palette.accentSoft}" opacity="0.54" />
      <circle cx="128" cy="1246" r="280" fill="${palette.accent}" opacity="0.13" />
      <path d="M54 498 C240 430 376 564 560 494 S820 402 1012 488" fill="none" stroke="${palette.accent}" stroke-width="16" stroke-linecap="round" opacity="0.28" />
      <rect x="54" y="54" width="972" height="1332" rx="72" fill="#fffaf4" opacity="0.82" filter="url(#softShadow)" />
      <rect x="78" y="78" width="924" height="1284" rx="58" fill="none" stroke="${palette.accentDeep}" stroke-width="3" stroke-dasharray="14 18" opacity="0.16" />
      <g transform="translate(96 114)">
        <rect x="0" y="0" width="286" height="54" rx="27" fill="${palette.accentDeep}" opacity="0.94" />
        <text x="143" y="36" font-size="23" font-weight="900" fill="#fffaf4" text-anchor="middle">小红书知识卡</text>
        <text x="850" y="36" font-size="26" font-weight="900" fill="${palette.accentDeep}" text-anchor="end">${input.index + 1}/${input.total}</text>
      </g>
      <g transform="translate(96 214)">
        ${renderTextLines({
          lines: titleLines,
          x: 0,
          y: 66,
          fontSize: 66,
          lineHeight: 78,
          fill: palette.ink,
          weight: 900
        })}
      </g>
      <g transform="translate(96 542)">
        <rect x="0" y="0" width="196" height="46" rx="23" fill="${palette.accent}" opacity="0.9" />
        <text x="98" y="31" font-size="22" font-weight="900" fill="#fffaf4" text-anchor="middle">${escapeXml(typeLabels[type])}</text>
        ${renderTextLines({
          lines: subtitleLines,
          x: 226,
          y: 31,
          fontSize: 25,
          lineHeight: 36,
          fill: palette.muted,
          weight: 760
        })}
      </g>
      ${moduleSvg}
      <g transform="translate(96 1310)">
        <rect x="0" y="0" width="888" height="72" rx="36" fill="${palette.accentDeep}" opacity="0.95" />
        <text x="444" y="46" text-anchor="middle" font-size="28" font-weight="900" fill="#fffaf4">收藏后照着做 · 发布前可继续替换真实素材</text>
      </g>
    </svg>
  `.trim();
}

function isCurrentLocalCardAsset(asset: XiaohongshuImageAsset) {
  if (asset.provider === "siliconflow") {
    return true;
  }

  if (asset.provider === "local-svg" && asset.status) {
    return true;
  }

  return asset.src.includes("xhs-v2");
}

export function generateXiaohongshuImageAssets(input: {
  title: string;
  imageSuggestions: string[];
  caption?: string;
  imagePlan?: XiaohongshuImagePlan;
}): XiaohongshuImageAsset[] {
  const suggestions = normalizeXiaohongshuImageSuggestions(input);
  const imagePlan =
    input.imagePlan ??
    buildXiaohongshuImagePlan({
      title: input.title,
      caption: input.caption ?? input.title,
      imageSuggestions: suggestions
    });

  return suggestions.map((suggestion, index) => {
    const planItem = imagePlan.images[index];
    const prompt = planItem?.prompt ?? suggestion;
    const title = index === 0
      ? input.title.slice(0, 22)
      : planItem?.title ?? titleFromSuggestion(suggestion, `配图 ${index + 1}`);
    const svg = buildCardSvg({
      title,
      caption: input.caption,
      prompt,
      suggestion,
      index,
      total: suggestions.length,
      planItem
    });

    return {
      id: `xhs-image-${index + 1}`,
      title,
      prompt,
      alt: `小红书配图 ${index + 1}：${title}`,
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      provider: "local-svg",
      status: "ready",
      type: planItem?.type,
      typeName: planItem?.typeName,
      size: planItem?.size,
      colorScheme: planItem?.colorScheme
    };
  });
}

export function ensureXiaohongshuImageAssets<T extends {
  title: string;
  caption?: string;
  imageSuggestions: string[];
  imagePlan?: XiaohongshuImagePlan;
  imageAssets?: XiaohongshuImageAsset[];
}>(content: T): T & {
  imageAssets: XiaohongshuImageAsset[];
  imagePlan: XiaohongshuImagePlan;
} {
  const imageSuggestions = normalizeXiaohongshuImageSuggestions({
    title: content.title,
    imageSuggestions: content.imageSuggestions
  });
  const imagePlan =
    content.imagePlan ??
    buildXiaohongshuImagePlan({
      title: content.title,
      caption: content.caption ?? content.title,
      imageSuggestions
    });

  if (
    content.imageAssets &&
    content.imageAssets.length >= imageSuggestions.length &&
    content.imageAssets.slice(0, imageSuggestions.length).every(isCurrentLocalCardAsset)
  ) {
    return {
      ...content,
      imageSuggestions,
      imagePlan,
      imageAssets: content.imageAssets
    };
  }

  return {
    ...content,
    imageSuggestions,
    imagePlan,
    imageAssets: generateXiaohongshuImageAssets({
      title: content.title,
      caption: content.caption,
      imageSuggestions,
      imagePlan
    })
  };
}
