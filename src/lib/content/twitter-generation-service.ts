import {
  createSiliconFlowChatCompletion,
  getSiliconFlowConfig
} from "@/lib/content/siliconflow-client";
import { TWITTER_BUILTIN_SKILL_PROMPT } from "@/lib/content/twitter-built-in-skill";
import type { TwitterContentBody, TwitterMode, WebSearchResult } from "@/lib/types";

interface GenerateTwitterContentInput {
  prompt: string;
  rules: string[];
  language?: string;
  modePreference?: TwitterMode;
  webSearchResults?: WebSearchResult[];
}

const defaultTwitterVoiceRules = [
  "角色：你为一位在推特上畅所欲言的人代写推文。他并非表演型思想领袖，而只是分享自己真实想法的人。",
  "嗓音：说话要像在和一位聪明的朋友发短信，而不是在写宣言。",
  "允许不确定：可以自然使用“我觉得”、“也许”、“不太确定，但是”，不要装作拥有终极答案。",
  "具体胜于抽象：优先写具体观察、细节和真实判断，少写宏大论断。",
  "别摆出说教者姿态：你不是提词员、老师，也不是与观众有距离感的人。",
  "Lens：对人工智能炒作保持怀疑，重视品味和人类判断，能注意到别人忽略的细节；但不要强求 AI 视角，只有真正相关时才使用。",
  "反模式：避免箴言饼干式深刻寓意，例如“X 与 Y 无关，而是与 Z 有关”。",
  "反模式：避免过于明显的钩子-转折-笑点结构，不要让每个词都像在故意追求大胆或有力。",
  "反模式：避免标签堆砌，默认不加 hashtags，除非用户明确要求。",
  "质量门槛：先写 3 个候选版本，分别检查具体性、自然度、信息增量，再选择最像真人的一条或一组。",
  "字数限制：每条推文不超过 280 个字符，但不要为了简洁牺牲行文流畅性。",
  "任务：根据用户想法即兴写，别像为了博眼球而精心打磨过。"
];

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

function normalizeMode(value: unknown, tweets: string[]): TwitterMode {
  if (value === "single" || value === "thread") {
    return value;
  }

  return tweets.length > 1 ? "thread" : "single";
}

function normalizeLanguage(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "English";
}

function isEnglishLanguage(language: string) {
  return /^(en|english)$/iu.test(language.trim());
}

function containsHanCharacters(value: string) {
  return /\p{Script=Han}/u.test(value);
}

function needsLanguageRepair(content: TwitterContentBody, language: string) {
  return isEnglishLanguage(language) && content.tweets.some(containsHanCharacters);
}

function stripThreadPrefix(tweet: string) {
  return tweet
    .replace(/^\s*\d+\s*\/\s*\d+\s*/u, "")
    .replace(/^\s*\d+[.、]\s*/u, "")
    .trim();
}

function tidyTweet(tweet: string) {
  return tweet.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function hasOverLimitTweets(content: TwitterContentBody) {
  return content.tweets.some((tweet) => tweet.length > 280);
}

function hardLimitTweet(tweet: string) {
  const tidy = tidyTweet(tweet);

  if (tidy.length <= 280) {
    return tidy;
  }

  const candidate = tidy.slice(0, 279).trimEnd();
  const boundary = Math.max(
    candidate.lastIndexOf("."),
    candidate.lastIndexOf("!"),
    candidate.lastIndexOf("?"),
    candidate.lastIndexOf(";")
  );
  const wordBoundary = candidate.lastIndexOf(" ");
  const cutPoint = boundary >= 120 ? boundary + 1 : wordBoundary >= 120 ? wordBoundary : 279;
  const limited = candidate.slice(0, cutPoint).trimEnd();

  return /[.!?。！？]$/u.test(limited) ? limited : `${limited}.`;
}

function coerceContentForMode(
  content: TwitterContentBody,
  modePreference: TwitterMode | undefined,
  language: string
): TwitterContentBody {
  if (modePreference === "single") {
    const mergedTweet = content.tweets.map(stripThreadPrefix).filter(Boolean).join(" ");

    return {
      mode: "single",
      language,
      tweets: [tidyTweet(mergedTweet)]
    };
  }

  if (modePreference === "thread") {
    return {
      mode: "thread",
      language,
      tweets: content.tweets.map(stripThreadPrefix).map(tidyTweet).filter(Boolean)
    };
  }

  return {
    ...content,
    language
  };
}

function buildModeInstruction(modePreference: TwitterMode | undefined) {
  if (modePreference === "single") {
    return [
      "模式约束：强制输出 Single。",
      "只返回 mode: \"single\" 和 exactly one tweet。",
      "这条推文必须像一个完整念头，不要写成 Thread 的第一条，也不要出现 1/5、Thread、续更等标记。"
    ].join("\n");
  }

  if (modePreference === "thread") {
    return [
      "模式约束：强制输出 Thread。",
      "只返回 mode: \"thread\" 和 5-10 条 tweets。",
      "每条都要能单独读懂，但整体要从观察、问题、具体例子、方法或判断，走到一个自然收束。"
    ].join("\n");
  }

  return [
    "模式约束：Auto。",
    "你先判断用户需求是否值得展开：一个切口足够清楚就 single；需要上下文、例子或推演就 thread。"
  ].join("\n");
}

async function repairContentLanguage(input: {
  content: TwitterContentBody;
  language: string;
  modePreference?: TwitterMode;
}) {
  const rawContent = await createSiliconFlowChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are a strict Twitter/X language repair pass. Return valid JSON only. " +
          'The JSON schema is {"mode": "single" | "thread", "language": string, "tweets": string[]}. ' +
          "Preserve the original meaning, mode, and tweet count unless the selected mode requires a single tweet. " +
          "Every tweet must stay under 280 characters."
      },
      {
        role: "user",
        content: [
          `Rewrite these Twitter/X tweets into ${input.language}.`,
          isEnglishLanguage(input.language)
            ? "Remove all Chinese Han characters. Translate names or concepts naturally into English instead of leaving Chinese text."
            : `Use ${input.language} consistently.`,
          "Keep the voice casual, specific, and non-performative.",
          "Return JSON only.",
          "",
          `Mode preference: ${input.modePreference ?? input.content.mode}`,
          `Original JSON:\n${JSON.stringify(input.content, null, 2)}`
        ].join("\n")
      }
    ],
    temperature: 0.35,
    maxTokens: 2400
  });

  return parseTwitterContent(rawContent);
}

async function repairContentLength(input: {
  content: TwitterContentBody;
  language: string;
  modePreference?: TwitterMode;
}) {
  const rawContent = await createSiliconFlowChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are a strict Twitter/X length repair pass. Return valid JSON only. " +
          'The JSON schema is {"mode": "single" | "thread", "language": string, "tweets": string[]}. ' +
          "Preserve the original meaning, mode, language, and tweet count unless the selected mode requires a single tweet."
      },
      {
        role: "user",
        content: [
          "Rewrite these Twitter/X tweets so every tweet is a complete thought under 280 characters.",
          "Do not use ellipses, unfinished sentences, \"the rest\", \"continued\", placeholders, or thread fragments.",
          `Write in ${input.language}.`,
          "Keep the voice casual, specific, and non-performative.",
          "Return JSON only.",
          "",
          `Mode preference: ${input.modePreference ?? input.content.mode}`,
          `Original JSON:\n${JSON.stringify(input.content, null, 2)}`
        ].join("\n")
      }
    ],
    temperature: 0.35,
    maxTokens: 2400
  });

  return parseTwitterContent(rawContent);
}

export function parseTwitterContent(rawContent: string): TwitterContentBody {
  const parsed = JSON.parse(extractJsonObject(rawContent)) as {
    language?: unknown;
    mode?: unknown;
    tweets?: unknown;
  };
  const tweets = Array.isArray(parsed.tweets)
    ? parsed.tweets
        .filter((tweet): tweet is string => typeof tweet === "string")
        .map(tidyTweet)
        .filter(Boolean)
    : [];

  if (tweets.length === 0) {
    throw new Error("Model response is missing required Twitter tweets");
  }

  return {
    language: normalizeLanguage(parsed.language),
    mode: normalizeMode(parsed.mode, tweets),
    tweets
  };
}

export async function generateTwitterContent(
  input: GenerateTwitterContentInput
): Promise<TwitterContentBody | null> {
  if (!getSiliconFlowConfig()) {
    return null;
  }

  const outputLanguage = normalizeLanguage(input.language);
  const rulesBlock = [TWITTER_BUILTIN_SKILL_PROMPT, ...defaultTwitterVoiceRules, ...input.rules]
    .map((rule, index) => `${index + 1}. ${rule}`)
    .join("\n");
  const referenceBlock =
    input.webSearchResults && input.webSearchResults.length > 0
      ? input.webSearchResults
          .map(
            (result, index) =>
              `${index + 1}. ${result.title}\n   URL: ${result.url}\n   Note: ${result.snippet}`
          )
          .join("\n")
      : "No external search material was provided.";
  const modeInstruction = buildModeInstruction(input.modePreference);

  const rawContent = await createSiliconFlowChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You write Twitter/X posts for a smart, kind, non-performative person sharing real thoughts. " +
          "The output should feel like a text to an intelligent friend, not a manifesto. Return valid JSON only. " +
          'The JSON schema is {"mode": "single" | "thread", "language": string, "tweets": string[]}. ' +
          "The selected output language is a hard requirement and overrides the language of the source prompt. " +
          "Do not wrap the JSON with markdown or extra explanation. " +
          "Every tweet must be self-contained, natural, and no longer than 280 characters."
      },
      {
        role: "user",
        content: [
          `Please generate a publish-ready Twitter/X post. Output language: ${outputLanguage}.`,
          "The language selector overrides the language used in the user requirement.",
          isEnglishLanguage(outputLanguage)
            ? "Even if the user requirement is written in Chinese, synthesize and write the tweets in natural English. Do not include Chinese Han characters."
            : `Write the tweets in ${outputLanguage} unless the user explicitly asks for a different output language.`,
          "",
          `User requirement:\n${input.prompt}`,
          "",
          `Mode preference:\n${modeInstruction}`,
          "",
          `Writing rules:\n${rulesBlock}`,
          "",
          `Reference material:\n${referenceBlock}`,
          "",
          "Requirements:",
          `0. Write all tweets in ${outputLanguage}. If the user did not specify a language, English is the default.`,
          "1. 每条推文只讲一个清楚念头，不要把公众号标题压缩成短句。",
          "2. 先写 3 个候选版本，在心里按“具体性、信息增量、真人感”打分，只输出选择最像真人的一条或一组。",
          "3. Single 必须是一个完整观点；Thread 必须有连续推进，不要只是把段落切成多条。",
          "4. Keep every tweet under 280 characters.",
          "5. Avoid placeholders, generic motivational filler, empty slogans, hashtags, and obvious engagement bait.",
          "6. When references are provided, synthesize the useful points without copying snippets."
        ].join("\n")
      }
    ],
    temperature: 0.82,
    maxTokens: 3600
  });

  let generatedContent = coerceContentForMode(
    parseTwitterContent(rawContent),
    input.modePreference,
    outputLanguage
  );

  if (needsLanguageRepair(generatedContent, outputLanguage)) {
    const repairedContent = await repairContentLanguage({
      content: generatedContent,
      language: outputLanguage,
      modePreference: input.modePreference
    });

    generatedContent = coerceContentForMode(repairedContent, input.modePreference, outputLanguage);
  }

  if (hasOverLimitTweets(generatedContent)) {
    const repairedContent = await repairContentLength({
      content: generatedContent,
      language: outputLanguage,
      modePreference: input.modePreference
    });

    generatedContent = coerceContentForMode(repairedContent, input.modePreference, outputLanguage);
  }

  if (needsLanguageRepair(generatedContent, outputLanguage)) {
    const repairedContent = await repairContentLanguage({
      content: generatedContent,
      language: outputLanguage,
      modePreference: input.modePreference
    });

    generatedContent = coerceContentForMode(repairedContent, input.modePreference, outputLanguage);
  }

  if (hasOverLimitTweets(generatedContent)) {
    return {
      ...generatedContent,
      tweets: generatedContent.tweets.map(hardLimitTweet)
    };
  }

  return generatedContent;
}
