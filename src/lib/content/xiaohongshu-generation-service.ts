import {
  createSiliconFlowChatCompletion,
  getSiliconFlowConfig
} from "@/lib/content/siliconflow-client";
import { XIAOHONGSHU_BUILTIN_SKILL_PROMPT } from "@/lib/content/xiaohongshu-built-in-skill";
import { enhanceXiaohongshuImagesWithSiliconFlow } from "@/lib/content/xiaohongshu-image-generation-service";
import { ensureXiaohongshuImageAssets } from "@/lib/content/xiaohongshu-image-card-generator";
import { buildXiaohongshuImagePlan } from "@/lib/content/xiaohongshu-image-planning";
import type { WebSearchResult, XiaohongshuContentBody } from "@/lib/types";

interface GenerateXiaohongshuContentInput {
  prompt: string;
  rules: string[];
  imageRules?: string[];
  enableImageGeneration?: boolean;
  webSearchResults?: WebSearchResult[];
}

function extractJsonObject(rawContent: string) {
  const fencedMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? rawContent.trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model response does not contain a JSON object");
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function fillImageSuggestions(suggestions: string[], title: string) {
  const result = suggestions.slice(0, 9);
  const defaults = [
    `封面：${title}，大标题和生活方式场景`,
    "场景图：真实办公桌或学习桌，突出代入感",
    "方法图：把核心步骤做成清晰卡片",
    "对比图：低效状态和高效状态并排呈现",
    "清单图：可收藏的方法列表",
    "细节图：手机、电脑、笔记本组成的工作流",
    "过程图：从混乱到清晰的流程变化",
    "总结图：一句话收束核心观点",
    "结尾图：收藏关注 CTA 和温暖生活场景"
  ];

  for (const fallback of defaults) {
    if (result.length >= 9) {
      break;
    }

    result.push(fallback);
  }

  return result;
}

export function parseXiaohongshuContent(rawContent: string): XiaohongshuContentBody {
  const parsed = JSON.parse(extractJsonObject(rawContent)) as {
    title?: unknown;
    caption?: unknown;
    imageSuggestions?: unknown;
    hashtags?: unknown;
  };
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const caption = typeof parsed.caption === "string" ? parsed.caption.trim() : "";

  if (!title || !caption) {
    throw new Error("Model response is missing required Xiaohongshu fields");
  }

  const content = {
    title,
    caption,
    imageSuggestions: fillImageSuggestions(
      normalizeStringArray(parsed.imageSuggestions),
      title
    ),
    hashtags: normalizeStringArray(parsed.hashtags)
  };

  return ensureXiaohongshuImageAssets({
    ...content,
    imagePlan: buildXiaohongshuImagePlan({
      title,
      caption,
      imageSuggestions: content.imageSuggestions
    })
  });
}

export async function generateXiaohongshuContent(
  input: GenerateXiaohongshuContentInput
): Promise<XiaohongshuContentBody | null> {
  if (!getSiliconFlowConfig()) {
    return null;
  }

  const mergedRules = [...input.rules, ...(input.imageRules ?? [])];
  const userRulesBlock =
    mergedRules.length > 0
      ? mergedRules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")
      : "1. 使用中文输出。\n2. 文案要短、狠、可收藏，有真实经验感。\n3. 必须给出 9 张图的配图提示词。";
  const rulesBlock = [
    XIAOHONGSHU_BUILTIN_SKILL_PROMPT,
    "",
    "【用户自定义规则】",
    userRulesBlock
  ].join("\n");
  const referenceBlock =
    input.webSearchResults && input.webSearchResults.length > 0
      ? input.webSearchResults
          .map(
            (result, index) =>
              `${index + 1}. ${result.title}\n   URL: ${result.url}\n   Note: ${result.snippet}`
          )
          .join("\n")
      : "No external search material was provided.";

  const rawContent = await createSiliconFlowChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are an expert Xiaohongshu content strategist, viral copywriter, and visual planner. Return valid JSON only. " +
          'The JSON schema is {"title": string, "caption": string, "imageSuggestions": string[], "hashtags": string[]}. ' +
          "Do not wrap the JSON with markdown or extra explanation."
      },
      {
        role: "user",
        content: [
          "Please generate a publish-ready Xiaohongshu note in Chinese.",
          "",
          `User requirement:\n${input.prompt}`,
          "",
          `Creative rules:\n${rulesBlock}`,
          "",
          `Reference material:\n${referenceBlock}`,
          "",
          "Requirements:",
          "1. title: catchy, concrete, and suitable for Xiaohongshu, with audience/pain point/benefit.",
          "2. caption: 500-800 Chinese characters, with a 3-line hook, concise methods, personal tone, and a save/comment CTA.",
          "3. imageSuggestions: exactly 9 separate Chinese image prompt seeds. Cover the final carousel: cover, process, concept, comparison, checklist, framework, scene, summary, CTA.",
          "4. hashtags: 4-8 Xiaohongshu tags without #.",
          "5. Do not return placeholders, drafts, or generic demo copy.",
          "6. Follow the built-in image workflow. The local app will convert imageSuggestions into imagePlan and generated cards."
        ].join("\n")
      }
    ],
    temperature: 0.78,
    maxTokens: 5200
  });

  const parsedContent = parseXiaohongshuContent(rawContent);

  if (!input.enableImageGeneration) {
    return parsedContent;
  }

  return enhanceXiaohongshuImagesWithSiliconFlow(parsedContent);
}
