export type PlatformId = "wechat" | "xiaohongshu" | "twitter" | "videoScript";
export type PlatformSkillSelections = Record<PlatformId, string[]>;

export type TaskStatus = "draft" | "generating" | "ready" | "failed";
export type PublishStatus = "idle" | "publishing" | "published" | "failed";
export type TwitterMode = "auto" | "single" | "thread";
export type SkillSourceType = "zip" | "github" | "prompt";
export type SkillKind = "content" | "image";
export type DraftStatus = "draft" | "generated";

export interface TaskRecord {
  id: string;
  title: string;
  userInput: string;
  selectedPlatforms: PlatformId[];
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DraftRecord {
  id: string;
  title: string;
  prompt: string;
  selectedPlatforms: PlatformId[];
  status: DraftStatus;
  lastGeneratedTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WechatContentBody {
  title: string;
  summary: string;
  body: string;
  coverImagePlan?: WechatCoverImagePlan;
  coverImageAsset?: WechatCoverImageAsset;
}

export interface XiaohongshuContentBody {
  title: string;
  caption: string;
  imageSuggestions: string[];
  imagePlan?: XiaohongshuImagePlan;
  imageAssets?: XiaohongshuImageAsset[];
  hashtags: string[];
}

export type XiaohongshuImageMode = "Simple Mode" | "Series Mode";
export type XiaohongshuImageType = 1 | 2 | 3 | 4 | 5;
export type XiaohongshuImageSize = "portrait" | "landscape" | "square";
export type XiaohongshuColorScheme = "warm" | "cool" | "vibrant" | "classic";

export interface XiaohongshuImagePlanItem {
  id: string;
  title: string;
  type: XiaohongshuImageType;
  typeName: string;
  size: XiaohongshuImageSize;
  colorScheme: XiaohongshuColorScheme;
  prompt: string;
}

export interface XiaohongshuImagePlan {
  mode: XiaohongshuImageMode;
  decision: string;
  images: XiaohongshuImagePlanItem[];
}

export interface WechatCoverImagePlan {
  mode: XiaohongshuImageMode;
  decision: string;
  images: XiaohongshuImagePlanItem[];
  selectedImageId?: string;
}

export interface WechatCoverImageAsset {
  id: string;
  title: string;
  prompt: string;
  alt: string;
  src: string;
  originalSrc?: string;
  provider: "siliconflow";
  status?: "ready" | "failed" | "generating";
  errorMessage?: string;
  type?: XiaohongshuImageType;
  typeName?: string;
  size?: XiaohongshuImageSize;
  colorScheme?: XiaohongshuColorScheme;
}

export interface XiaohongshuImageAsset {
  id: string;
  title: string;
  prompt: string;
  alt: string;
  src: string;
  originalSrc?: string;
  provider: "local-svg" | "siliconflow";
  status?: "ready" | "failed" | "generating";
  errorMessage?: string;
  type?: XiaohongshuImageType;
  typeName?: string;
  size?: XiaohongshuImageSize;
  colorScheme?: XiaohongshuColorScheme;
}

export interface TwitterContentBody {
  mode: TwitterMode;
  language?: string;
  tweets: string[];
}

export interface VideoScene {
  shot: string;
  copy: string;
  visual: string;
  subtitle: string;
  pace: string;
  audio: string;
  effect: string;
  voiceover?: string;
}

export interface VideoScriptContentBody {
  title: string;
  scenes: VideoScene[];
}

export interface GeneratedTaskContentBundle {
  wechat: WechatContentBody | null;
  xiaohongshu: XiaohongshuContentBody | null;
  twitter: TwitterContentBody | null;
  videoScript: VideoScriptContentBody | null;
}

export type PersistedWechatContent = WechatContentBody & {
  publishStatus: PublishStatus;
};

export type PersistedXiaohongshuContent = XiaohongshuContentBody & {
  publishStatus: PublishStatus;
};

export type PersistedTwitterContent = TwitterContentBody & {
  publishStatus: PublishStatus;
};

export type PersistedVideoScriptContent = VideoScriptContentBody & {
  publishStatus: PublishStatus;
};

export interface PersistedGeneratedTaskContentBundle {
  wechat: PersistedWechatContent | null;
  xiaohongshu: PersistedXiaohongshuContent | null;
  twitter: PersistedTwitterContent | null;
  videoScript: PersistedVideoScriptContent | null;
}

export interface PlatformContentRecord {
  id: string;
  taskId: string;
  platform: PlatformId;
  contentType: string;
  title: string;
  bodyJson: string;
  publishStatus: PublishStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSettingRecord {
  platform: PlatformId;
  baseRulesJson: string;
  enabledSkillIdsJson: string;
  imageSkillIdsJson: string;
  updatedAt: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  sourceType: SkillSourceType;
  sourceRef: string;
  summary: string;
  status: string;
  skillKind?: SkillKind;
  createdAt: string;
  updatedAt: string;
}

export interface SkillLearningResultRecord {
  skillId: string;
  summary: string;
  rules: string[];
  platformHints: string[];
  keywords: string[];
  examplesSummary: string[];
  updatedAt: string;
}

export interface SkillFilePreview {
  path: string;
  content: string;
}

export interface SkillDetailPayload {
  skill: SkillRecord;
  learningResult: SkillLearningResultRecord | null;
  files: string[];
  selectedFile: SkillFilePreview | null;
}

export interface HistoryActionRecord {
  id: string;
  taskId: string;
  actionType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface GenerationTraceStep {
  id: string;
  label: string;
  detail: string;
  status: "completed";
}

export interface GenerationTraceSkill {
  platform: PlatformId;
  name: string;
  sourceRef: string;
  sourceType: SkillSourceType;
  skillKind?: SkillKind;
}

export interface GenerationTraceSource {
  id: string;
  label: string;
  detail: string;
  kind: "prompt" | "external-search" | "system";
  url?: string;
}

export interface TaskGenerationTrace {
  statusLabel: string;
  methodLabel: string;
  providerLabel: string;
  steps: GenerationTraceStep[];
  skills: GenerationTraceSkill[];
  sources: GenerationTraceSource[];
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchTrace {
  enabled: boolean;
  provider: string;
  query: string;
  queries?: string[];
  results: WebSearchResult[];
  error?: string;
}

export interface LibraryEntryRecord {
  taskId: string;
  sourceDraftId: string | null;
  platform: PlatformId;
  createdAt: string;
  updatedAt: string;
}

export interface WechatLibraryItem {
  taskId: string;
  title: string;
  summary: string;
  publishStatus: PublishStatus;
  userInput: string;
  updatedAt: string;
}

export interface WechatLibraryDetail extends WechatLibraryItem {
  body: string;
}

export interface WechatLibraryPayload {
  items: WechatLibraryItem[];
  recentActions: HistoryActionRecord[];
}
