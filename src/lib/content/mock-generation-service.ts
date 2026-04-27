import { efficiencyFixture } from "@/lib/content/sample-fixtures";
import { generateTwitterContent } from "@/lib/content/twitter-generation-service";
import { generateVideoScriptContent } from "@/lib/content/video-script-generation-service";
import { generateWechatContent } from "@/lib/content/wechat-generation-service";
import { ensureXiaohongshuImageAssets } from "@/lib/content/xiaohongshu-image-card-generator";
import { generateXiaohongshuContent } from "@/lib/content/xiaohongshu-generation-service";
import { resolvePlatformRules } from "@/lib/platform/platform-rule-resolver";
import type {
  GeneratedTaskContentBundle,
  PlatformId,
  TwitterContentBody,
  TwitterMode,
  VideoScriptContentBody,
  WebSearchResult,
  WechatContentBody,
  XiaohongshuContentBody
} from "@/lib/types";

function includesAllPlatforms(platforms: PlatformId[]) {
  return (
    platforms.length === 4 &&
    platforms.includes("wechat") &&
    platforms.includes("xiaohongshu") &&
    platforms.includes("twitter") &&
    platforms.includes("videoScript")
  );
}

function shouldUseEfficiencyFixture(prompt: string, platforms: PlatformId[]) {
  const normalizedPrompt = prompt.replace(/\s+/g, "");

  return (
    includesAllPlatforms(platforms) &&
    (normalizedPrompt.includes("提高工作效率") ||
      normalizedPrompt.includes("高效工作"))
  );
}

function buildSkillNote(skillNames: string[]) {
  if (skillNames.length === 0) {
    return null;
  }

  return `已应用技能：${skillNames.join("、")}。`;
}

function buildFallbackWechat(prompt: string): WechatContentBody {
  return {
    title: "待完善的公众号选题",
    summary: "这是一个用于原型演示的公众号草稿摘要。",
    body: `${prompt}\n\n这是一个为原型阶段准备的公众号草稿。后续这里会替换成真实模型生成内容。`
  };
}

function buildFallbackXiaohongshu(prompt: string): XiaohongshuContentBody {
  const topic = prompt
    .replace(/^写一篇关于/, "")
    .replace(/的小红书.*$/, "")
    .replace(/的内容.*$/, "")
    .trim() || "这件事";
  const title = `${topic}别再瞎摸索！这 5 步真的有效`;
  const caption = [
    `如果你也在研究「${topic}」，先别急着收藏一堆资料。真正拉开差距的，通常不是你看过多少教程，而是有没有把一个问题拆成能马上执行的步骤。`,
    "",
    "我现在会用一个很简单的顺序来做：先找准最痛的卡点，再把目标拆成 3 个小任务；每个任务只配一个工具，避免一开始就陷入工具焦虑；做完以后立刻写一段复盘，把有效动作沉淀成自己的模板。",
    "",
    "具体可以这样试：",
    "1. 用一句话写清楚你到底想解决什么问题。",
    "2. 找 1 个最小练习任务，不要一上来做大项目。",
    "3. 每天只记录一个关键收获，别让笔记变成资料坟场。",
    "4. 把可复用的步骤整理成清单，下次直接照着跑。",
    "5. 每周挑一个成果发出来，用输出倒逼理解。",
    "",
    "这套方法不花哨，但胜在能坚持、能复用、能看到反馈。建议先收藏，今晚就选一个小任务跑一遍。你会发现，进步不是突然开窍，而是每一天少走一点弯路。"
  ].join("\n");

  return ensureXiaohongshuImageAssets({
    title,
    caption,
    imageSuggestions: [
      `封面：${title}，强钩子标题和温暖学习场景`,
      `流程：围绕${topic}从卡点识别到最小行动的 5 步路径`,
      `概念：解释${topic}为什么不能只靠收藏教程`,
      "对比：资料囤积式学习 vs 项目驱动式学习",
      "清单：每天可以照做的 5 个行动动作",
      "框架：卡点、任务、工具、复盘、输出的闭环",
      "场景：真实桌面、笔记本、手机和 AI 工具界面",
      "总结：少走弯路的核心提醒",
      "CTA：收藏这份方法，今晚就做一个小任务"
    ],
    hashtags: ["小红书运营", "AI学习", "自我提升", "学习方法", "效率工具"]
  });
}

function buildFallbackTwitter(prompt: string, language = "English"): TwitterContentBody {
  if (prompt.length > 180) {
    return {
      mode: "thread",
      language,
      tweets: [
        `1/3 ${prompt}`,
        "2/3 This is a prototype thread draft. We will replace it with real generation later.",
        "3/3 You can keep editing, copying, or publishing this thread from the workspace."
      ]
    };
  }

  return {
    mode: "single",
    language,
    tweets: [prompt]
  };
}

function buildFallbackVideoScript(prompt: string): VideoScriptContentBody {
  return {
    title: "视频脚本草稿",
    scenes: [
      {
        shot: "01",
        copy: `今天我们聊一个很具体的问题：${prompt}`,
        visual: "人物进入画面，桌面或屏幕上出现主题关键词。",
        subtitle: "今天聊一个真实问题",
        pace: "快节奏开场，3 秒内进入主题",
        audio: "轻快背景音乐，开场加提示音",
        effect: "标题弹入、镜头轻推近"
      },
      {
        shot: "02",
        copy: "先用一个清晰框架拆解问题，再给出可执行的方法。",
        visual: "关键词卡片依次出现，配合简单流程箭头。",
        subtitle: "先拆问题，再给方法",
        pace: "中等节奏，给观众理解时间",
        audio: "背景音乐降低，保留轻节拍",
        effect: "卡片滑入、关键词高亮"
      },
      {
        shot: "03",
        copy: "最后用一句行动建议收束，让观众知道看完后第一步该做什么。",
        visual: "总结卡片出现，人物完成一个明确动作。",
        subtitle: "看完先做第一步",
        pace: "节奏放缓，强化记忆点",
        audio: "音乐收束，尾部加轻提示音",
        effect: "总结字幕定格、淡出转场"
      }
    ]
  };
}

function applyWechatSkillNote(content: WechatContentBody, skillNames: string[]) {
  const note = buildSkillNote(skillNames);

  if (!note) {
    return content;
  }

  return {
    ...content,
    summary: `${note}${content.summary}`,
    body: `${note}\n\n${content.body}`
  };
}

function enrichWechatWithSearchResults(
  content: WechatContentBody,
  webSearchResults: WebSearchResult[]
) {
  if (webSearchResults.length === 0) {
    return content;
  }

  const references = webSearchResults
    .slice(0, 5)
    .map((result, index) => `${index + 1}. [${result.title}](${result.url}) - ${result.snippet}`)
    .join("\n");

  return {
    ...content,
    summary: `${content.summary} 已结合联网检索资料，可在创作过程里回溯来源。`,
    body: `${content.body}\n\n## 资料来源\n\n${references}`
  };
}

function applyXiaohongshuSkillNote(
  content: XiaohongshuContentBody,
  skillNames: string[]
) {
  const note = buildSkillNote(skillNames);

  if (!note) {
    return content;
  }

  return ensureXiaohongshuImageAssets({
    ...content,
    caption: `${note}\n\n${content.caption}`
  });
}

function applyTwitterSkillNote(content: TwitterContentBody, skillNames: string[]) {
  const note = buildSkillNote(skillNames);

  if (!note || content.tweets.length === 0) {
    return content;
  }

  return {
    ...content,
    tweets: [`${content.tweets[0]}\n\n${note}`, ...content.tweets.slice(1)]
  };
}

function applyVideoSkillNote(content: VideoScriptContentBody, skillNames: string[]) {
  const note = buildSkillNote(skillNames);

  if (!note || content.scenes.length === 0) {
    return content;
  }

  return {
    ...content,
    scenes: content.scenes.map((scene, index) =>
      index === 0
        ? {
            ...scene,
            copy: `${note}${scene.copy || scene.voiceover || ""}`,
            voiceover: `${note}${scene.copy || scene.voiceover || ""}`
          }
        : scene
    )
  };
}

function applySkillNotes(
  bundle: GeneratedTaskContentBundle,
  appliedSkillNamesByPlatform: Partial<Record<PlatformId, string[]>>
): GeneratedTaskContentBundle {
  return {
    wechat: bundle.wechat
      ? applyWechatSkillNote(
          { ...bundle.wechat },
          appliedSkillNamesByPlatform.wechat ?? []
        )
      : null,
    xiaohongshu: bundle.xiaohongshu
      ? applyXiaohongshuSkillNote(
          { ...bundle.xiaohongshu },
          appliedSkillNamesByPlatform.xiaohongshu ?? []
        )
      : null,
    twitter: bundle.twitter
      ? applyTwitterSkillNote(
          {
            ...bundle.twitter,
            tweets: [...bundle.twitter.tweets]
          },
          appliedSkillNamesByPlatform.twitter ?? []
        )
      : null,
    videoScript: bundle.videoScript
      ? applyVideoSkillNote(
          {
            ...bundle.videoScript,
            scenes: bundle.videoScript.scenes.map((scene) => ({ ...scene }))
          },
          appliedSkillNamesByPlatform.videoScript ?? []
        )
      : null
  };
}

export async function generateTaskContentBundle(input: {
  prompt: string;
  platforms: PlatformId[];
  appliedSkillNamesByPlatform: Partial<Record<PlatformId, string[]>>;
  imageRulesByPlatform?: Partial<Record<PlatformId, string[]>>;
  enableXiaohongshuImageGeneration?: boolean;
  twitterLanguage?: string;
  twitterModePreference?: TwitterMode;
  webSearchResults?: WebSearchResult[];
}): Promise<GeneratedTaskContentBundle> {
  const appliedRulesByPlatform = input.platforms.reduce<
    Partial<Record<PlatformId, string[]>>
  >((result, platform) => {
    result[platform] = resolvePlatformRules({
      platform,
      baseRules: [],
      appliedSkillSummaries: input.appliedSkillNamesByPlatform[platform] ?? []
    });

    return result;
  }, {});

  const baseBundle = shouldUseEfficiencyFixture(input.prompt, input.platforms)
    ? {
        ...efficiencyFixture,
        xiaohongshu: efficiencyFixture.xiaohongshu
          ? ensureXiaohongshuImageAssets(efficiencyFixture.xiaohongshu)
          : null
      }
    : {
        wechat: input.platforms.includes("wechat")
          ? buildFallbackWechat(input.prompt)
          : null,
        xiaohongshu: input.platforms.includes("xiaohongshu")
          ? buildFallbackXiaohongshu(input.prompt)
          : null,
        twitter: input.platforms.includes("twitter")
          ? buildFallbackTwitter(input.prompt, input.twitterLanguage?.trim() || "English")
          : null,
        videoScript: input.platforms.includes("videoScript")
          ? buildFallbackVideoScript(input.prompt)
          : null
      };
  const researchedBundle: GeneratedTaskContentBundle = {
    ...baseBundle,
    wechat: baseBundle.wechat
      ? enrichWechatWithSearchResults(
          baseBundle.wechat,
          input.webSearchResults ?? []
        )
      : null
  };
  const mockBundle = applySkillNotes(
    researchedBundle,
    appliedRulesByPlatform
  );

  let finalBundle = mockBundle;

  if (input.platforms.includes("wechat")) {
    const generatedWechat = await generateWechatContent({
      prompt: input.prompt,
      rules: appliedRulesByPlatform.wechat ?? [],
      webSearchResults: input.webSearchResults ?? []
    });

    if (generatedWechat) {
      finalBundle = {
        ...finalBundle,
        wechat: generatedWechat
      };
    }
  }

  if (input.platforms.includes("xiaohongshu")) {
    const generatedXiaohongshu = await generateXiaohongshuContent({
      prompt: input.prompt,
      rules: appliedRulesByPlatform.xiaohongshu ?? [],
      imageRules: input.imageRulesByPlatform?.xiaohongshu ?? [],
      enableImageGeneration: Boolean(input.enableXiaohongshuImageGeneration),
      webSearchResults: input.webSearchResults ?? []
    });

    if (generatedXiaohongshu) {
      finalBundle = {
        ...finalBundle,
        xiaohongshu: generatedXiaohongshu
      };
    }
  }

  if (input.platforms.includes("twitter")) {
    const generatedTwitter = await generateTwitterContent({
      language: input.twitterLanguage,
      modePreference: input.twitterModePreference,
      prompt: input.prompt,
      rules: appliedRulesByPlatform.twitter ?? [],
      webSearchResults: input.webSearchResults ?? []
    });

    if (generatedTwitter) {
      finalBundle = {
        ...finalBundle,
        twitter: generatedTwitter
      };
    }
  }

  if (input.platforms.includes("videoScript")) {
    const generatedVideoScript = await generateVideoScriptContent({
      prompt: input.prompt,
      rules: appliedRulesByPlatform.videoScript ?? [],
      webSearchResults: input.webSearchResults ?? []
    });

    if (generatedVideoScript) {
      finalBundle = {
        ...finalBundle,
        videoScript: generatedVideoScript
      };
    }
  }

  return finalBundle;
}
