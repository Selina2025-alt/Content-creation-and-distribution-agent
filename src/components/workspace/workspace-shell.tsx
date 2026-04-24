"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ArticleEditor } from "@/components/workspace/article-editor";
import {
  ContentActions,
  type ContentExportFormat
} from "@/components/workspace/content-actions";
import { GenerationTracePanel } from "@/components/workspace/generation-trace-panel";
import { HistorySidebar } from "@/components/workspace/history-sidebar";
import { PlatformTabs } from "@/components/workspace/platform-tabs";
import { TaskSummaryBar } from "@/components/workspace/task-summary-bar";
import { TwitterEditor } from "@/components/workspace/twitter-editor";
import { VideoScriptEditor } from "@/components/workspace/video-script-editor";
import { WechatPublishModal } from "@/components/workspace/wechat-publish-modal";
import { XiaohongshuPublishConfirmModal } from "@/components/workspace/xiaohongshu-publish-confirm-modal";
import { XiaohongshuPublishQrModal } from "@/components/workspace/xiaohongshu-publish-qr-modal";
import { XiaohongshuEditor } from "@/components/workspace/xiaohongshu-editor";
import type {
  PersistedGeneratedTaskContentBundle,
  PersistedVideoScriptContent,
  PlatformId,
  TaskGenerationTrace,
  TaskRecord
} from "@/lib/types";

type HistoryItem = {
  id: string;
  title: string;
  updatedAt: string;
};

type RegenerateTaskResponse = {
  task?: TaskRecord;
  bundle?: PersistedGeneratedTaskContentBundle;
  trace?: TaskGenerationTrace | null;
  code?: string;
  detail?: string;
  message?: string;
};

type ApiErrorPayload = {
  code?: string;
  detail?: unknown;
  message?: string;
};

type PublishTaskResponse = {
  code?: string;
  detail?: unknown;
  message?: string;
  noteId?: string;
  publishUrl?: string;
  qrImageUrl?: string;
  status?: string;
};

type ImageRetryResponse = {
  code?: string;
  content?: PersistedGeneratedTaskContentBundle["xiaohongshu"];
  message?: string;
};

type WechatPublishSelection = {
  wechatAppid: string;
  articleType: "news" | "newspic";
};

const platformLabels: Record<PlatformId, string> = {
  wechat: "公众号文章",
  xiaohongshu: "小红书笔记",
  twitter: "Twitter",
  videoScript: "视频脚本"
};

const videoScriptCopyHeaders = [
  "镜号",
  "文案内容",
  "画面建议",
  "字幕重点",
  "节奏",
  "音效/音乐",
  "特效"
];

function cleanTableCell(value: string | undefined) {
  return (value ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}

function formatVideoScriptAsTable(content: PersistedVideoScriptContent) {
  const rows = content.scenes.map((scene, index) =>
    [
      scene.shot || String(index + 1).padStart(2, "0"),
      scene.copy || scene.voiceover || "",
      scene.visual,
      scene.subtitle,
      scene.pace,
      scene.audio,
      scene.effect
    ]
      .map(cleanTableCell)
      .join("\t")
  );

  return [content.title, "", videoScriptCopyHeaders.join("\t"), ...rows].join("\n");
}

function extractFileNameFromDisposition(headerValue: string | null) {
  if (!headerValue) {
    return null;
  }

  const encodedMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);

  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }

  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i);

  return plainMatch?.[1] ?? null;
}

export function WorkspaceShell(props: {
  initialTaskId: string;
  initialTask: TaskRecord;
  initialHistory: HistoryItem[];
  initialBundle: PersistedGeneratedTaskContentBundle;
  initialIsInLibrary?: boolean;
  initialTrace?: TaskGenerationTrace | null;
}) {
  const [historyItems, setHistoryItems] = useState(props.initialHistory);
  const [task, setTask] = useState(props.initialTask);
  const [bundle, setBundle] = useState(props.initialBundle);
  const [trace, setTrace] = useState<TaskGenerationTrace | null>(
    props.initialTrace ?? null
  );
  const [activePlatform, setActivePlatform] = useState<PlatformId>(
    props.initialTask.selectedPlatforms[0] ?? "wechat"
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isWechatPublishModalOpen, setIsWechatPublishModalOpen] = useState(false);
  const [isXiaohongshuPublishModalOpen, setIsXiaohongshuPublishModalOpen] =
    useState(false);
  const [xiaohongshuPublishResult, setXiaohongshuPublishResult] = useState<{
    noteId?: string;
    publishUrl: string;
    qrImageUrl?: string;
  } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRefreshingExpiredXiaohongshuImages, setIsRefreshingExpiredXiaohongshuImages] =
    useState(false);
  const [isExportingFormat, setIsExportingFormat] =
    useState<ContentExportFormat | null>(null);
  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);
  const [isInLibrary, setIsInLibrary] = useState(props.initialIsInLibrary ?? false);
  const [publishError, setPublishError] = useState<ApiErrorPayload | null>(null);
  const [enableXiaohongshuImageGeneration, setEnableXiaohongshuImageGeneration] =
    useState(
      Boolean(
        (props.initialBundle.xiaohongshu?.imageAssets ?? []).some(
          (asset) => asset.provider === "siliconflow"
        )
      )
    );
  const [statusText, setStatusText] = useState("内容已就绪");
  const isFirstRender = useRef(true);
  const suppressAutosaveStatus = useRef(false);

  const activeLabel = platformLabels[activePlatform];
  const publishLabel =
    activePlatform === "wechat"
      ? "发布到公众号"
      : activePlatform === "xiaohongshu"
        ? "发布到小红书"
        : "发布";
  const currentContent = bundle[activePlatform];
  const canAddToLibrary = activePlatform === "wechat" && Boolean(bundle.wechat);
  const showExpiredImageQuickFix =
    activePlatform === "xiaohongshu" &&
    publishError?.code === "XIAOHONGSHU_IMAGE_EXPIRED";
  const exportOptions = useMemo(() => {
    const options: Array<{ format: ContentExportFormat; label: string }> = [
      { format: "markdown", label: "Markdown" },
      { format: "html", label: "HTML" }
    ];

    if (activePlatform === "xiaohongshu") {
      options.push({ format: "image-package", label: "图片包" });
    }

    if (activePlatform === "videoScript") {
      options.push({ format: "video-script-doc", label: "脚本文档" });
    }

    return options;
  }, [activePlatform]);

  const contentPreview = useMemo(() => {
    if (!currentContent) {
      return "当前平台暂时没有内容。";
    }

    if ("title" in currentContent && typeof currentContent.title === "string") {
      return currentContent.title;
    }

    return "这里会显示当前平台的编辑器与操作区。";
  }, [currentContent]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (suppressAutosaveStatus.current) {
      suppressAutosaveStatus.current = false;
      return;
    }

    setStatusText("Saving draft...");

    const timer = window.setTimeout(() => {
      setStatusText("Autosaved locally");
    }, 450);

    return () => window.clearTimeout(timer);
  }, [bundle]);

  useEffect(() => {
    setPublishError(null);
  }, [activePlatform]);

  function handleRename(taskId: string, title: string) {
    setHistoryItems((items) =>
      items.map((item) => (item.id === taskId ? { ...item, title } : item))
    );

    if (task.id === taskId) {
      setTask((currentTask) => ({
        ...currentTask,
        title
      }));
    }
  }

  function handleDelete(taskId: string) {
    setHistoryItems((items) => items.filter((item) => item.id !== taskId));
  }

  function handleSelectTask(taskId: string) {
    if (taskId === task.id) {
      return;
    }

    setStatusText("正在打开对应创作工作台...");
  }

  function updateCurrentPlatformContent(
    nextValue: PersistedGeneratedTaskContentBundle[PlatformId]
  ) {
    setBundle((currentBundle) => ({
      ...currentBundle,
      [activePlatform]: nextValue
    }));
  }

  async function handleCopy() {
    if (!currentContent) {
      return;
    }

    const serialized =
      activePlatform === "videoScript" && bundle.videoScript
        ? formatVideoScriptAsTable(bundle.videoScript)
        : JSON.stringify(currentContent, null, 2);

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(serialized);
      setStatusText(
        activePlatform === "videoScript"
          ? "已复制表格到剪贴板"
          : "已复制到剪贴板"
      );
      return;
    }

    setStatusText("当前环境不支持系统剪贴板");
  }

  async function handlePublish(
    selection?: WechatPublishSelection,
    options?: { xiaohongshuConfirmed?: boolean }
  ) {
    if (activePlatform === "videoScript") {
      return false;
    }

    if (activePlatform === "wechat" && !selection) {
      setIsWechatPublishModalOpen(true);
      return false;
    }

    if (activePlatform === "xiaohongshu" && !options?.xiaohongshuConfirmed) {
      setIsXiaohongshuPublishModalOpen(true);
      return false;
    }

    setIsPublishing(true);
    setPublishError(null);

    try {
      const response = await fetch(`/api/tasks/${props.initialTaskId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          platform: activePlatform,
          ...(selection ?? {})
        })
      });

      const result = (await response.json()) as PublishTaskResponse;

      if (!response.ok) {
        setPublishError({
          code: result.code,
          detail: result.detail,
          message: result.message
        });
        throw new Error(result.message ?? "发布失败，请稍后再试");
      }

      suppressAutosaveStatus.current = true;
      setBundle((currentBundle) => {
        const platformContent = currentBundle[activePlatform];

        if (!platformContent) {
          return currentBundle;
        }

        return {
          ...currentBundle,
          [activePlatform]: {
            ...platformContent,
            publishStatus: result.status ?? "published"
          }
        };
      });
      const successStatusText =
        activePlatform === "wechat"
          ? "成功保存到草稿箱"
          : activePlatform === "xiaohongshu"
            ? "发布请求已创建，请扫码继续"
          : result.message ?? "发布成功";
      const normalizedSuccessStatusText =
        activePlatform === "xiaohongshu"
          ? "发布链接已创建，请扫码后在手机端选择账号继续发布"
          : successStatusText;
      setStatusText(normalizedSuccessStatusText);
      setPublishError(null);

      if (activePlatform === "xiaohongshu" && result.publishUrl) {
        setXiaohongshuPublishResult({
          publishUrl: result.publishUrl,
          qrImageUrl: result.qrImageUrl,
          noteId: result.noteId
        });
        setIsXiaohongshuPublishModalOpen(false);
      }

      return true;
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "发布失败，请稍后再试"
      );
      return false;
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleWechatPublishConfirm(selection: WechatPublishSelection) {
    const success = await handlePublish(selection);

    if (success) {
      setIsWechatPublishModalOpen(false);
    }
  }

  async function handleRefreshExpiredXiaohongshuImages() {
    if (activePlatform !== "xiaohongshu" || !bundle.xiaohongshu) {
      return;
    }

    const imageIds = bundle.xiaohongshu.imageAssets.map((asset) => asset.id);

    if (imageIds.length === 0) {
      setStatusText("当前没有可重生成的配图。");
      return;
    }

    setIsRefreshingExpiredXiaohongshuImages(true);
    setStatusText("正在重生成配图并替换...");

    let successCount = 0;
    let failedCount = 0;
    let latestContent = bundle.xiaohongshu;

    for (const imageId of imageIds) {
      try {
        const response = await fetch(
          `/api/tasks/${props.initialTaskId}/xiaohongshu-images/${imageId}/retry`,
          {
            method: "POST"
          }
        );

        const result = (await response.json()) as ImageRetryResponse;

        if (!response.ok || !result.content) {
          failedCount += 1;
          continue;
        }

        latestContent = {
          ...result.content,
          publishStatus: latestContent.publishStatus ?? result.content.publishStatus
        };
        successCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    if (successCount > 0) {
      suppressAutosaveStatus.current = true;
      setBundle((currentBundle) => ({
        ...currentBundle,
        xiaohongshu: latestContent
      }));
      setPublishError(null);
    }

    if (failedCount === 0) {
      setStatusText("配图已重新生成并替换，请重新发布。");
    } else if (successCount > 0) {
      setStatusText(`配图已部分更新（成功 ${successCount} / 失败 ${failedCount}），请重试。`);
    } else {
      setStatusText("配图重生成失败，请稍后重试。");
    }

    setIsRefreshingExpiredXiaohongshuImages(false);
  }

  async function handleAddToLibrary() {
    if (!canAddToLibrary || isInLibrary) {
      return;
    }

    setIsAddingToLibrary(true);

    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          taskId: props.initialTaskId
        })
      });

      if (!response.ok) {
        throw new Error("Failed to add this article to the library");
      }

      setIsInLibrary(true);
      setStatusText("已加入内容库");
    } catch {
      setStatusText("加入内容库失败，请稍后再试");
    } finally {
      setIsAddingToLibrary(false);
    }
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    setPublishError(null);
    setStatusText(`重新生成 ${activeLabel} 中...`);

    try {
      const regenerateBody: Record<string, unknown> = {
        platform: activePlatform
      };

      if (activePlatform === "twitter" && bundle.twitter) {
        regenerateBody.twitterLanguage = bundle.twitter.language?.trim() || "English";
        regenerateBody.twitterModePreference = bundle.twitter.mode;
      }

      if (activePlatform === "xiaohongshu") {
        regenerateBody.enableXiaohongshuImageGeneration =
          enableXiaohongshuImageGeneration;
      }
      const response = await fetch(`/api/tasks/${props.initialTaskId}/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(regenerateBody)
      });
      const result = (await response.json()) as RegenerateTaskResponse;

      if (!response.ok || !result.task || !result.bundle) {
        throw new Error(result.message ?? "Failed to regenerate this task");
      }

      suppressAutosaveStatus.current = true;
      setTask(result.task);
      setBundle(result.bundle);
      setTrace(result.trace ?? null);
      setIsEditing(false);
      setHistoryItems((items) =>
        items.map((item) =>
          item.id === result.task?.id
            ? {
                ...item,
                title: result.task.title,
                updatedAt: result.task.updatedAt
              }
            : item
        )
      );

      if (!result.bundle[activePlatform]) {
        const nextPlatform =
          result.task.selectedPlatforms.find((platform) => Boolean(result.bundle?.[platform])) ??
          result.task.selectedPlatforms[0] ??
          activePlatform;

        setActivePlatform(nextPlatform);
      }

      setStatusText("重新生成完成");
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "重新生成失败，请稍后再试"
      );
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleExport(format: ContentExportFormat) {
    setIsExportingFormat(format);

    try {
      const response = await fetch(
        `/api/tasks/${props.initialTaskId}/export?format=${encodeURIComponent(format)}`
      );

      if (!response.ok) {
        const payload = (await response.json()) as ApiErrorPayload;
        throw new Error(payload.message ?? "导出失败，请稍后再试");
      }

      const blob = await response.blob();
      const fallbackFileNames: Record<ContentExportFormat, string> = {
        markdown: "task-export.md",
        html: "task-export.html",
        "image-package": "xiaohongshu-images.zip",
        "video-script-doc": "video-script.md"
      };
      const fileName =
        extractFileNameFromDisposition(response.headers.get("Content-Disposition")) ??
        fallbackFileNames[format];
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      setStatusText(`已导出 ${fileName}`);
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "导出失败，请稍后再试"
      );
    } finally {
      setIsExportingFormat(null);
    }
  }

  function renderEditor() {
    if (activePlatform === "wechat" && bundle.wechat) {
      return (
        <ArticleEditor
          isEditing={isEditing}
          onChange={updateCurrentPlatformContent}
          taskId={props.initialTaskId}
          value={bundle.wechat}
        />
      );
    }

    if (activePlatform === "xiaohongshu" && bundle.xiaohongshu) {
      return (
        <XiaohongshuEditor
          isEditing={isEditing}
          onChange={updateCurrentPlatformContent}
          taskId={props.initialTaskId}
          value={bundle.xiaohongshu}
        />
      );
    }

    if (activePlatform === "twitter" && bundle.twitter) {
      return (
        <TwitterEditor
          isEditing={isEditing}
          onChange={updateCurrentPlatformContent}
          value={bundle.twitter}
        />
      );
    }

    if (activePlatform === "videoScript" && bundle.videoScript) {
      return (
        <VideoScriptEditor
          isEditing={isEditing}
          onChange={updateCurrentPlatformContent}
          value={bundle.videoScript}
        />
      );
    }

    return (
      <div className="workspace-card__body">
        <p className="workspace-card__description">当前平台暂时没有内容。</p>
      </div>
    );
  }

  return (
    <main className="workspace-layout">
      <HistorySidebar
        activeTaskId={task.id}
        items={historyItems}
        onDelete={handleDelete}
        onRename={handleRename}
        onSelect={handleSelectTask}
      />

      <section className="workspace-canvas">
        <TaskSummaryBar
          backHref="/"
          prompt={task.userInput}
          selectedPlatforms={task.selectedPlatforms}
          title={task.title}
        />

        <GenerationTracePanel trace={trace} />

        <div className="workspace-card">
          <PlatformTabs
            activePlatform={activePlatform}
            availablePlatforms={task.selectedPlatforms}
            onChange={setActivePlatform}
          />

          {activePlatform === "xiaohongshu" ? (
            <div className="workspace-card__platform-toggle">
              <label className="research-toggle">
                <input
                  aria-label="启用小红书AI生图"
                  checked={enableXiaohongshuImageGeneration}
                  onChange={(event) =>
                    setEnableXiaohongshuImageGeneration(event.target.checked)
                  }
                  type="checkbox"
                />
                <span className="research-toggle__visual" aria-hidden="true" />
                <span className="research-toggle__copy">
                  <strong>启用小红书AI生图</strong>
                  <small>
                    默认关闭。开启后点击“重新生成”才会调用生图模型，测试阶段更省 token。
                  </small>
                </span>
              </label>
            </div>
          ) : null}

          <ContentActions
            canAddToLibrary={canAddToLibrary}
            canPublish={activePlatform !== "videoScript"}
            exportOptions={exportOptions}
            isAddingToLibrary={isAddingToLibrary}
            isEditing={isEditing}
            isExportingFormat={isExportingFormat}
            isInLibrary={isInLibrary}
            isPublishing={isPublishing}
            isRegenerating={isRegenerating}
            quickFixAction={
              showExpiredImageQuickFix
                ? {
                    label: "一键重生成配图并替换",
                    loadingLabel: "配图重生成中...",
                    onClick: () => {
                      void handleRefreshExpiredXiaohongshuImages();
                    },
                    isLoading: isRefreshingExpiredXiaohongshuImages,
                    disabled: isPublishing || isRegenerating
                  }
                : undefined
            }
            publishLabel={publishLabel}
            onAddToLibrary={() => {
              void handleAddToLibrary();
            }}
            onCopy={() => {
              void handleCopy();
            }}
            onExport={(format) => {
              void handleExport(format);
            }}
            onPublish={() => {
              void handlePublish();
            }}
            onRegenerate={() => {
              void handleRegenerate();
            }}
            onToggleEdit={() => setIsEditing((current) => !current)}
            statusText={statusText}
          />

          <div className="workspace-card__body">
            <p className="workspace-card__eyebrow">{activeLabel}</p>
            <h2 className="workspace-card__title">当前正在查看 {activeLabel} 内容</h2>
            <p className="workspace-card__description">{contentPreview}</p>
            {renderEditor()}
          </div>
        </div>

        <WechatPublishModal
          isOpen={isWechatPublishModalOpen}
          isSubmitting={isPublishing}
          onClose={() => setIsWechatPublishModalOpen(false)}
          onConfirm={(selection) => {
            void handleWechatPublishConfirm(selection);
          }}
        />

        <XiaohongshuPublishConfirmModal
          isOpen={isXiaohongshuPublishModalOpen}
          isSubmitting={isPublishing}
          onClose={() => setIsXiaohongshuPublishModalOpen(false)}
          onConfirm={() => {
            setIsXiaohongshuPublishModalOpen(false);
            void handlePublish(undefined, {
              xiaohongshuConfirmed: true
            });
          }}
        />

        <XiaohongshuPublishQrModal
          isOpen={Boolean(xiaohongshuPublishResult?.publishUrl)}
          onClose={() => setXiaohongshuPublishResult(null)}
          publishUrl={xiaohongshuPublishResult?.publishUrl ?? null}
          noteId={xiaohongshuPublishResult?.noteId}
          qrImageUrl={xiaohongshuPublishResult?.qrImageUrl}
        />
      </section>
    </main>
  );
}
