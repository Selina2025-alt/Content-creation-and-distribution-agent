import { persistGeneratedImage } from "@/lib/assets/generated-asset-service";
import {
  createSiliconFlowImageGeneration,
  getSiliconFlowImageConfig
} from "@/lib/content/siliconflow-client";
import { ensureWechatCoverImagePlan } from "@/lib/content/wechat-cover-image-planning";
import { getPlatformSetting } from "@/lib/db/repositories/platform-settings-repository";
import {
  getSkillById,
  getSkillLearningResult,
  listSkills
} from "@/lib/db/repositories/skill-repository";
import { ensureBuiltinImageSkills } from "@/lib/skills/builtin-image-skills";
import type { WechatContentBody, WechatCoverImageAsset } from "@/lib/types";

const DEFAULT_WECHAT_COVER_SKILL_ID = "builtin-image-wechat-md2wechat-cover";
const WECHAT_COVER_FALLBACK_SKILL_ID = "builtin-image-wechat-baoyu-cover";
type SkillRow = NonNullable<ReturnType<typeof getSkillById>>;

const SKILL_STYLE_PRESETS: Record<string, string[]> = {
  "builtin-image-wechat-baoyu-cover": [
    "Composition: one clear subject with generous negative space.",
    "Visual texture: premium editorial, cinematic lighting, sharp edges, clean layers.",
    "Meaning delivery: communicate by metaphor and scene, never by words."
  ],
  "builtin-image-wechat-md2wechat-cover": [
    "Composition: 16:9 hero scene, clear foreground subject, depth in background.",
    "Visual texture: modern, clean, broadcast-ready; avoid noisy decorations.",
    "Content guardrail: no title overlay, no logo, no watermark, no UI element."
  ]
};

const PROMPT_LEAK_PATTERNS: RegExp[] = [
  /\bbaoyu\b/gi,
  /\bmd2wechat\b/gi,
  /\bjimliu\b/gi,
  /\bgeekjourneyx\b/gi,
  /\bgithub\b/gi,
  /\bskill(s)?\b/gi,
  /\bwechat\s*cover\b/gi,
  /sourceRef/gi
];

const PLATFORM_NOISE_PATTERNS: RegExp[] = [
  /\bwechat\b/gi,
  /微信/gi,
  /公众号/gi,
  /朋友圈/gi,
  /小红书/gi,
  /\bins\b/gi,
  /\binstagram\b/gi,
  /抖音/gi,
  /\btiktok\b/gi,
  /\btwitter\b/gi,
  /\bfacebook\b/gi,
  /\byoutube\b/gi,
  /\bbilibili\b/gi,
  /微博/gi,
  /快手/gi,
  /\bapp\b/gi,
  /\bui\b/gi,
  /界面/gi,
  /截图/gi,
  /角标/gi,
  /状态栏/gi,
  /导航栏/gi
];

const COVER_IMAGE_CLEANUP_INSTRUCTION = [
  "Artifact cleanup pass for article cover image:",
  "- Keep only the core visual scene and subject; preserve composition quality.",
  "- Remove every logo, watermark, badge, app icon, corner mark, and platform identity.",
  "- Remove all text fragments, letters, words, numbers, labels, and tiny corner symbols.",
  "- Remove phone/device frames, status bars, chat windows, UI overlays, and interface chrome.",
  "- Keep all four corners clean and empty. Keep the final result as a pure textless scene."
].join("\n");

function toSiliconFlowImageSize(size?: "portrait" | "landscape" | "square") {
  switch (size) {
    case "square":
      return "1024x1024";
    case "portrait":
      return "768x1024";
    case "landscape":
    default:
      return "1024x576";
  }
}

function pickCandidate(input: {
  content: ReturnType<typeof ensureWechatCoverImagePlan>;
  candidateId?: string;
}) {
  const plan = input.content.coverImagePlan;

  if (input.candidateId) {
    const matchedCandidate = plan.images.find((item) => item.id === input.candidateId);

    if (matchedCandidate) {
      return matchedCandidate;
    }
  }

  if (plan.selectedImageId) {
    const selectedCandidate = plan.images.find((item) => item.id === plan.selectedImageId);

    if (selectedCandidate) {
      return selectedCandidate;
    }
  }

  return plan.images[0];
}

function sanitizeStyleText(value: string) {
  const compacted = value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/`+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return PROMPT_LEAK_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, ""),
    compacted
  )
    .replace(/\s{2,}/g, " ")
    .replace(/^[-:;,.\s]+|[-:;,.\s]+$/g, "")
    .trim();
}

function scrubPlatformNoise(value: string) {
  const compacted = value.replace(/\s+/g, " ").trim();
  const stripped = PLATFORM_NOISE_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, ""),
    compacted
  );

  return stripped.replace(/\s{2,}/g, " ").trim();
}

function normalizeSemanticAliases(value: string) {
  return value
    .replace(/\bsocial media\b/gi, "daily life scene")
    .replace(/\bcontent platform\b/gi, "theme context")
    .replace(/\bapp interface\b/gi, "real scene");
}

function deriveSkillStyleDirectives(skill: SkillRow) {
  const preset = SKILL_STYLE_PRESETS[skill.id];

  if (preset?.length) {
    return preset;
  }

  const learning = getSkillLearningResult(skill.id);
  const candidates = [learning?.summary ?? skill.summary, ...(learning?.rules ?? []).slice(0, 2)]
    .map((line) => sanitizeStyleText(line))
    .filter(Boolean)
    .slice(0, 3);

  return candidates.length > 0
    ? candidates
    : [
        "Style rule: clear composition, strong subject hierarchy, and a text-free final image."
      ];
}

function resolveWechatCoverSkillInstructions() {
  ensureBuiltinImageSkills();

  const savedSetting = getPlatformSetting("wechat") as
    | { image_skill_ids_json?: string }
    | null;
  const selectedImageSkillIds = savedSetting?.image_skill_ids_json
    ? (JSON.parse(savedSetting.image_skill_ids_json) as string[])
    : [];

  const allReadyImageSkills = listSkills().filter(
    (skill) => skill.skillKind === "image" && skill.status === "ready"
  );
  const selectedSkills = selectedImageSkillIds
    .map((skillId) => getSkillById(skillId))
    .filter((skill): skill is SkillRow => Boolean(skill))
    .filter((skill) => skill.skillKind === "image" && skill.status === "ready");
  const defaultSkill =
    getSkillById(DEFAULT_WECHAT_COVER_SKILL_ID) ??
    getSkillById(WECHAT_COVER_FALLBACK_SKILL_ID) ??
    allReadyImageSkills[0] ??
    null;
  const activeSkills = selectedSkills.length > 0 ? selectedSkills : defaultSkill ? [defaultSkill] : [];

  if (activeSkills.length === 0) {
    return "";
  }

  const styleLines = activeSkills.flatMap((skill, index) => {
    const rules = deriveSkillStyleDirectives(skill);

    return [`style channel ${index + 1}:`, ...rules.map((rule) => `- ${rule}`)];
  });

  return [
    "Article hero-cover style constraints (design guidance only, never render these words into the final image):",
    ...styleLines,
    "Hard constraints: NO visible words, NO letters, NO numbers, NO logo, NO watermark, NO UI screenshot, NO branding badge.",
    "Zero-branding safety: NO platform names, NO social-app identity, NO chat bubble logos, NO product marks, NO corner symbols.",
    "Corner safety: keep all four corners clean; NO badges, NO app marks, NO platform names, NO corner icons.",
    "Relevance guardrail: remove unrelated symbols, stickers, UI fragments, and decorative marks not tied to the article meaning.",
    "Scene purity: render a pure visual scene only; no phone frame, no app header bar, no fake interface chrome.",
    "Human character is allowed when relevant: realistic portrait, stylized cartoon, anime-like illustration, or minimalist silhouette.",
    "If any text artifact appears, treat image as invalid and regenerate."
  ].join("\n");
}

async function generateCoverWithCleanup(input: {
  prompt: string;
  candidateTitle: string;
  size?: "portrait" | "landscape" | "square";
}) {
  const imageSize = toSiliconFlowImageSize(input.size);
  const firstPassImage = await createSiliconFlowImageGeneration({
    prompt: input.prompt,
    imageSize
  });

  const cleanupPrompt = [
    COVER_IMAGE_CLEANUP_INSTRUCTION,
    `Theme anchor (semantic only, do not render as text): ${input.candidateTitle}`,
    "If any text/logo/icon/corner badge remains, regenerate until completely clean."
  ].join("\n");

  try {
    return await createSiliconFlowImageGeneration({
      prompt: cleanupPrompt,
      image: firstPassImage,
      imageSize
    });
  } catch {
    try {
      return await createSiliconFlowImageGeneration({
        prompt: `${input.prompt}\n\n${cleanupPrompt}`,
        imageSize
      });
    } catch {
      return firstPassImage;
    }
  }
}

export async function generateWechatCoverImage(input: {
  content: WechatContentBody;
  candidateId?: string;
}) {
  const skillInstruction = resolveWechatCoverSkillInstructions();
  const ensuredContent = ensureWechatCoverImagePlan(input.content);
  const imageConfig = getSiliconFlowImageConfig();

  if (!imageConfig) {
    throw new Error("SiliconFlow image generation is not configured");
  }

  const candidate = pickCandidate({
    content: ensuredContent,
    candidateId: input.candidateId
  });

  if (!candidate) {
    throw new Error("No cover image candidate is available");
  }

  const promptDraft = skillInstruction
    ? `${skillInstruction}\n\n${candidate.prompt}`
    : candidate.prompt;
  const prompt = normalizeSemanticAliases(scrubPlatformNoise(promptDraft));
  const generatedSrc = await generateCoverWithCleanup({
    prompt,
    candidateTitle: candidate.title,
    size: candidate.size
  });
  const persistedImage = await persistGeneratedImage({
    src: generatedSrc,
    platform: "wechat",
    assetId: candidate.id
  });

  const nextCoverImageAsset: WechatCoverImageAsset = {
    id: candidate.id,
    title: candidate.title,
    prompt,
    alt: `公众号首图：${candidate.title}`,
    src: persistedImage.src,
    originalSrc: persistedImage.originalSrc,
    provider: "siliconflow",
    status: "ready",
    type: candidate.type,
    typeName: candidate.typeName,
    size: candidate.size,
    colorScheme: candidate.colorScheme
  };

  return {
    content: {
      ...ensuredContent,
      coverImagePlan: {
        ...ensuredContent.coverImagePlan,
        selectedImageId: candidate.id
      },
      coverImageAsset: nextCoverImageAsset
    },
    coverImageAsset: nextCoverImageAsset
  };
}
