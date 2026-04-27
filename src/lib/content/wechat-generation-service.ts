import {
  createSiliconFlowChatCompletion,
  getSiliconFlowConfig
} from "@/lib/content/siliconflow-client";
import type { WebSearchResult, WechatContentBody } from "@/lib/types";

interface GenerateWechatContentInput {
  prompt: string;
  rules: string[];
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

export function parseWechatContent(rawContent: string): WechatContentBody {
  const parsed = JSON.parse(extractJsonObject(rawContent)) as Partial<WechatContentBody>;
  const title = parsed.title?.trim();
  const summary = parsed.summary?.trim();
  const body = parsed.body?.trim();

  if (!title || !summary || !body) {
    throw new Error("Model response is missing required wechat fields");
  }

  return {
    title,
    summary,
    body
  };
}

export async function generateWechatContent(
  input: GenerateWechatContentInput
): Promise<WechatContentBody | null> {
  if (!getSiliconFlowConfig()) {
    return null;
  }

  const rulesBlock =
    input.rules.length > 0
      ? input.rules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")
      : "1. Write in clear, publishable Chinese.\n2. Produce a complete article instead of an outline.";
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
          "You are an expert Chinese WeChat public account writer and research editor. Return valid JSON only. " +
          'The JSON schema is {"title": string, "summary": string, "body": string}. ' +
          "Do not wrap the JSON with markdown or extra explanation. " +
          "When reference material is provided, synthesize it into the article with source-aware wording instead of copying snippets."
      },
      {
        role: "user",
        content: [
          "Please generate a polished, research-backed WeChat public account article.",
          "",
          `User requirement:\n${input.prompt}`,
          "",
          `Writing rules:\n${rulesBlock}`,
          "",
          `Reference material:\n${referenceBlock}`,
          "",
          "Requirements:",
          "1. title: a concrete article title suitable for WeChat.",
          "2. summary: 80-140 Chinese characters.",
          "3. body: a complete article in Markdown, with a strong opening, clear thesis, structured sections, examples, counterpoints, and a closing.",
          "4. If references are provided, add a short '资料来源' section at the end using the source titles and URLs.",
          "5. Do not return placeholders or an outline."
        ].join("\n")
      }
    ],
    temperature: 0.7,
    maxTokens: 6000
  });

  return parseWechatContent(rawContent);
}
