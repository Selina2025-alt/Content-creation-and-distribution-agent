import { NextResponse } from "next/server";

import { resolveGenerationContext } from "@/lib/content/generation-context-service";
import { generateTaskContentBundle } from "@/lib/content/mock-generation-service";
import { toUserFacingError } from "@/lib/content/error-feedback";
import { buildTaskGenerationTrace } from "@/lib/content/task-generation-trace";
import { searchWebForContent } from "@/lib/content/web-search-service";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  createHistoryAction,
  listHistoryActions
} from "@/lib/db/repositories/history-action-repository";
import {
  getTaskBundle,
  replaceTaskContents,
  upsertTaskPlatformContent
} from "@/lib/db/repositories/task-content-repository";
import {
  getTaskById,
  renameTask
} from "@/lib/db/repositories/task-repository";
import type {
  GeneratedTaskContentBundle,
  PlatformId,
  TwitterMode
} from "@/lib/types";

export const runtime = "nodejs";

async function readRegenerateBody(request: Request) {
  try {
    return (await request.json()) as {
      enableWebSearch?: boolean;
      enableXiaohongshuImageGeneration?: boolean;
      platform?: PlatformId;
      twitterLanguage?: string;
      twitterModePreference?: TwitterMode;
    };
  } catch {
    return {};
  }
}

function normalizeTwitterModePreference(value: unknown): TwitterMode | undefined {
  return value === "auto" || value === "single" || value === "thread" ? value : undefined;
}

function normalizeTwitterLanguage(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "English";
}

function normalizeTargetPlatform(
  value: unknown,
  selectedPlatforms: PlatformId[]
): PlatformId | undefined {
  return selectedPlatforms.find((platform) => platform === value);
}

function getContentMeta(
  platform: PlatformId,
  content: NonNullable<GeneratedTaskContentBundle[PlatformId]>
) {
  switch (platform) {
    case "wechat": {
      const article = content as NonNullable<GeneratedTaskContentBundle["wechat"]>;

      return {
        contentType: "article",
        title: article.title
      };
    }
    case "xiaohongshu": {
      const note = content as NonNullable<GeneratedTaskContentBundle["xiaohongshu"]>;

      return {
        contentType: "note",
        title: note.title
      };
    }
    case "twitter": {
      const twitter = content as NonNullable<GeneratedTaskContentBundle["twitter"]>;

      return {
        contentType: twitter.mode === "single" ? "tweet" : "thread",
        title: twitter.mode === "single" ? "Twitter Single" : "Twitter Thread"
      };
    }
    case "videoScript": {
      const script = content as NonNullable<GeneratedTaskContentBundle["videoScript"]>;

      return {
        contentType: "script",
        title: script.title
      };
    }
  }
}

function getPreviousWebSearchPreference(taskId: string) {
  const previousGenerationAction = listHistoryActions().find(
    (action) =>
      action.taskId === taskId &&
      (action.actionType === "task_regenerated" ||
        action.actionType === "task_created") &&
      typeof action.payload.enableWebSearch === "boolean"
  );

  return Boolean(previousGenerationAction?.payload.enableWebSearch);
}

function getPreviousXiaohongshuImageGenerationPreference(taskId: string) {
  const previousGenerationAction = listHistoryActions().find(
    (action) =>
      action.taskId === taskId &&
      (action.actionType === "task_regenerated" ||
        action.actionType === "task_created") &&
      typeof action.payload.enableXiaohongshuImageGeneration === "boolean"
  );

  return Boolean(previousGenerationAction?.payload.enableXiaohongshuImageGeneration);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  migrateDatabase();

  const { taskId } = await context.params;
  const task = getTaskById(taskId);

  if (!task) {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
  }

  try {
    const body = await readRegenerateBody(request);
    const targetPlatform = normalizeTargetPlatform(body.platform, task.selectedPlatforms);

    if (body.platform && !targetPlatform) {
      return NextResponse.json(
        { message: "Requested platform is not enabled for this task" },
        { status: 400 }
      );
    }

    const targetPlatforms = targetPlatform ? [targetPlatform] : task.selectedPlatforms;
    const twitterModePreference = normalizeTwitterModePreference(
      body.twitterModePreference
    );
    const twitterLanguage =
      targetPlatforms.includes("twitter")
        ? normalizeTwitterLanguage(body.twitterLanguage)
        : undefined;
    const enableWebSearch =
      typeof body.enableWebSearch === "boolean"
        ? body.enableWebSearch
        : getPreviousWebSearchPreference(taskId);
    const enableXiaohongshuImageGeneration =
      typeof body.enableXiaohongshuImageGeneration === "boolean"
        ? body.enableXiaohongshuImageGeneration
        : getPreviousXiaohongshuImageGenerationPreference(taskId);
    const generationContext = resolveGenerationContext(targetPlatforms);
    const webSearch = await searchWebForContent({
      enabled: enableWebSearch,
      prompt: task.userInput
    });
    const bundle = await generateTaskContentBundle({
      prompt: task.userInput,
      platforms: targetPlatforms,
      appliedSkillNamesByPlatform: generationContext.appliedRulesByPlatform,
      imageRulesByPlatform: generationContext.imageRulesByPlatform,
      enableXiaohongshuImageGeneration,
      twitterLanguage,
      twitterModePreference,
      webSearchResults: webSearch.results
    });
    const generationTrace = buildTaskGenerationTrace({
      prompt: task.userInput,
      platforms: targetPlatforms,
      skills: generationContext.skillSnapshots,
      webSearch
    });
    let title =
      bundle.wechat?.title ??
      bundle.xiaohongshu?.title ??
      bundle.videoScript?.title ??
      task.title;

    if (targetPlatform) {
      const generatedContent = bundle[targetPlatform];

      if (!generatedContent) {
        throw new Error("Target platform did not return generated content");
      }

      const meta = getContentMeta(targetPlatform, generatedContent);

      upsertTaskPlatformContent({
        taskId,
        platform: targetPlatform,
        contentType: meta.contentType,
        title: meta.title,
        body: generatedContent
      });

      title = targetPlatform === "twitter" ? task.title : meta.title;
    } else {
      replaceTaskContents(taskId, bundle);
    }

    renameTask(taskId, title);
    createHistoryAction({
      taskId,
      actionType: "task_regenerated",
      payload: {
        title,
        platforms: targetPlatforms,
        targetPlatform: targetPlatform ?? null,
        enableWebSearch,
        enableXiaohongshuImageGeneration,
        twitterLanguage,
        twitterModePreference,
        generationTrace
      }
    });

    return NextResponse.json({
      task: getTaskById(taskId),
      bundle: getTaskBundle(taskId),
      trace: generationTrace
    });
  } catch (error) {
    const mappedError = toUserFacingError(error);

    return NextResponse.json(
      {
        code: mappedError.code,
        message: mappedError.message,
        detail: mappedError.detail
      },
      { status: 502 }
    );
  }
}
