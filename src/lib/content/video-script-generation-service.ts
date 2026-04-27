import {
  createSiliconFlowChatCompletion,
  getSiliconFlowConfig
} from "@/lib/content/siliconflow-client";
import type { VideoScriptContentBody, WebSearchResult } from "@/lib/types";

interface GenerateVideoScriptContentInput {
  prompt: string;
  rules: string[];
  webSearchResults?: WebSearchResult[];
}

type RawScene = Record<string, unknown>;

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

function readString(scene: RawScene, keys: string[]) {
  for (const key of keys) {
    const value = scene[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function buildSubtitle(copy: string) {
  return copy.length > 24 ? `${copy.slice(0, 24)}...` : copy;
}

function normalizeScene(scene: RawScene, index: number) {
  const shot =
    readString(scene, ["shot", "镜号", "镜头"]) ||
    String(index + 1).padStart(2, "0");
  const copy = readString(scene, ["copy", "文案内容", "voiceover", "旁白"]);
  const visual = readString(scene, ["visual", "画面建议", "画面"]);

  if (!copy || !visual) {
    throw new Error("Model response is missing required video scene fields");
  }

  return {
    shot,
    copy,
    visual,
    subtitle: readString(scene, ["subtitle", "字幕重点"]) || buildSubtitle(copy),
    pace: readString(scene, ["pace", "节奏"]) || "中等节奏",
    audio: readString(scene, ["audio", "音效/音乐", "音效", "音乐"]) || "轻背景音乐",
    effect: readString(scene, ["effect", "特效"]) || "基础转场"
  };
}

export function parseVideoScriptContent(rawContent: string): VideoScriptContentBody {
  const parsed = JSON.parse(extractJsonObject(rawContent)) as {
    title?: unknown;
    scenes?: unknown;
  };
  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : "";

  if (!title || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error("Model response is missing required video script fields");
  }

  return {
    title,
    scenes: parsed.scenes.map((scene, index) =>
      normalizeScene(scene as RawScene, index)
    )
  };
}

export async function generateVideoScriptContent(
  input: GenerateVideoScriptContentInput
): Promise<VideoScriptContentBody | null> {
  if (!getSiliconFlowConfig()) {
    return null;
  }

  const rulesBlock =
    input.rules.length > 0
      ? input.rules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")
      : "1. 使用中文输出。\n2. 按短视频分镜脚本创作，不要写成文章。";
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
          "You are an expert short-video scriptwriter, director, and post-production planner. Return valid JSON only. " +
          'The JSON schema is {"title": string, "scenes": [{"shot": string, "copy": string, "visual": string, "subtitle": string, "pace": string, "audio": string, "effect": string}]}. ' +
          "Do not wrap the JSON with markdown or extra explanation."
      },
      {
        role: "user",
        content: [
          "Please generate a production-ready 3-minute short-video script in Chinese.",
          "",
          `User requirement:\n${input.prompt}`,
          "",
          `Creative rules:\n${rulesBlock}`,
          "",
          `Reference material:\n${referenceBlock}`,
          "",
          "Requirements:",
          "1. title: a concrete short-video script title.",
          "2. scenes: 6-10 shots unless the user explicitly asks for another length.",
          "3. Every scene must include exactly these production fields: shot, copy, visual, subtitle, pace, audio, effect.",
          "4. copy is the spoken/script text for the shot, not a vague outline.",
          "5. visual must describe what the viewer sees.",
          "6. subtitle should be short and punchy.",
          "7. pace, audio, and effect must be actionable editing guidance.",
          "8. Do not return placeholders."
        ].join("\n")
      }
    ],
    temperature: 0.72,
    maxTokens: 5000
  });

  return parseVideoScriptContent(rawContent);
}
