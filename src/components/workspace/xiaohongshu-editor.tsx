"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ensureXiaohongshuImageAssets,
  generateXiaohongshuImageAssets
} from "@/lib/content/xiaohongshu-image-card-generator";
import { buildXiaohongshuImagePlan } from "@/lib/content/xiaohongshu-image-planning";
import type { PersistedXiaohongshuContent } from "@/lib/types";

type RetryImageOptions = {
  silent?: boolean;
};

type BatchRetryState = {
  completed: number;
  failed: number;
  startedAt: number;
  status: "running" | "completed" | "cancelled";
  success: number;
  total: number;
};

export function XiaohongshuEditor(props: {
  value: PersistedXiaohongshuContent;
  isEditing: boolean;
  onChange: (value: PersistedXiaohongshuContent) => void;
  taskId?: string;
}) {
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [savedImageKeys, setSavedImageKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [retryingImageIds, setRetryingImageIds] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [batchRetryState, setBatchRetryState] = useState<BatchRetryState | null>(null);
  const [batchConcurrency, setBatchConcurrency] = useState(2);
  const [nowTick, setNowTick] = useState(Date.now());
  const inFlightControllersRef = useRef<Map<string, AbortController>>(new Map());
  const cancelBatchRef = useRef(false);
  const valueWithImages = ensureXiaohongshuImageAssets(props.value);
  const selectedImageEntry = valueWithImages.imageAssets
    .map((asset, index) => ({ asset, index }))
    .find(({ asset }) => asset.id === selectedImageId);
  const isBatchRunning = batchRetryState?.status === "running";
  const readyImageCount = valueWithImages.imageAssets.filter(
    (asset) =>
      asset.status !== "failed" &&
      !retryingImageIds.has(asset.id)
  ).length;
  const failedImageCount = valueWithImages.imageAssets.filter(
    (asset) => asset.status === "failed" && !retryingImageIds.has(asset.id)
  ).length;
  const failedImageIds = valueWithImages.imageAssets
    .filter((asset) => asset.status === "failed")
    .map((asset) => asset.id);
  const imageEntries = valueWithImages.imageAssets.map((asset, index) => ({
    asset,
    index
  }));
  const downloadableImageEntries = imageEntries.filter(
    ({ asset }) => asset.status !== "failed"
  );
  const batchElapsedMs = useMemo(() => {
    if (!batchRetryState) {
      return 0;
    }

    return (isBatchRunning ? nowTick : Date.now()) - batchRetryState.startedAt;
  }, [batchRetryState, isBatchRunning, nowTick]);

  useEffect(() => {
    if (!isBatchRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isBatchRunning]);

  useEffect(() => {
    if (!isBatchRunning) {
      return;
    }

    setNowTick(Date.now());
  }, [batchRetryState?.completed, batchRetryState?.failed, isBatchRunning]);

  function getImageFileExtension(src: string) {
    if (src.startsWith("data:image/svg")) {
      return "svg";
    }

    if (src.startsWith("data:image/png")) {
      return "png";
    }

    if (src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg")) {
      return "jpg";
    }

    if (src.startsWith("data:image/webp")) {
      return "webp";
    }

    const cleanPath = src.split("?")[0]?.toLowerCase() ?? "";
    const extensionMatch = cleanPath.match(/\.(png|jpg|jpeg|webp|gif|svg)$/);
    const extension = extensionMatch?.[1] ?? "png";

    return extension === "jpeg" ? "jpg" : extension;
  }

  function getImageDownloadName(index: number, src: string) {
    return `xiaohongshu-image-${index + 1}.${getImageFileExtension(src)}`;
  }

  function getImageSaveKey(asset: (typeof valueWithImages.imageAssets)[number]) {
    return `${asset.id}:${asset.src}`;
  }

  function markImageSaved(asset: (typeof valueWithImages.imageAssets)[number]) {
    setSavedImageKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);
      nextKeys.add(getImageSaveKey(asset));

      return nextKeys;
    });
  }

  function downloadImage(src: string, index: number) {
    const link = document.createElement("a");
    link.href = src;
    link.download = getImageDownloadName(index, src);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function downloadAllImages() {
    downloadableImageEntries.forEach(({ asset, index }) => {
      downloadImage(asset.src, index);
    });
    setSavedImageKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      downloadableImageEntries.forEach(({ asset }) => {
        nextKeys.add(getImageSaveKey(asset));
      });

      return nextKeys;
    });
  }

  function updateTitle(nextTitle: string) {
    const imagePlan = buildXiaohongshuImagePlan({
      title: nextTitle,
      caption: props.value.caption,
      imageSuggestions: valueWithImages.imageSuggestions
    });

    props.onChange({
      ...props.value,
      title: nextTitle,
      imagePlan,
      imageAssets: generateXiaohongshuImageAssets({
        title: nextTitle,
        caption: props.value.caption,
        imageSuggestions: valueWithImages.imageSuggestions,
        imagePlan
      })
    });
  }

  function updateImageSuggestion(index: number, nextValue: string) {
    const nextSuggestions = [...valueWithImages.imageSuggestions];
    nextSuggestions[index] = nextValue;
    const imagePlan = buildXiaohongshuImagePlan({
      title: props.value.title,
      caption: props.value.caption,
      imageSuggestions: nextSuggestions
    });

    props.onChange({
      ...props.value,
      imageSuggestions: nextSuggestions,
      imagePlan,
      imageAssets: generateXiaohongshuImageAssets({
        title: props.value.title,
        caption: props.value.caption,
        imageSuggestions: nextSuggestions,
        imagePlan
      })
    });
  }

  async function retryImage(
    imageId: string,
    options?: RetryImageOptions
  ): Promise<boolean> {
    if (!props.taskId) {
      return false;
    }

    const controller = new AbortController();

    inFlightControllersRef.current.set(imageId, controller);
    setRetryingImageIds((current) => {
      const next = new Set(current);
      next.add(imageId);
      return next;
    });

    if (!options?.silent) {
      setRetryMessage(null);
    }

    try {
      const response = await fetch(
        `/api/tasks/${props.taskId}/xiaohongshu-images/${imageId}/retry`,
        {
          method: "POST",
          signal: controller.signal
        }
      );
      const result = (await response.json()) as {
        code?: string;
        content?: PersistedXiaohongshuContent;
        message?: string;
      };

      if (!response.ok || !result.content) {
        throw new Error(result.message ?? "图片重新生成失败");
      }

      props.onChange({
        ...result.content,
        publishStatus: result.content.publishStatus ?? props.value.publishStatus
      });

      if (!options?.silent) {
        setRetryMessage("单张配图已重新生成并保存到本地。");
      }

      return true;
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === "AbortError";

      if (!options?.silent && !isAbortError) {
        setRetryMessage(error instanceof Error ? error.message : "图片重新生成失败");
      }

      return false;
    } finally {
      inFlightControllersRef.current.delete(imageId);
      setRetryingImageIds((current) => {
        const next = new Set(current);
        next.delete(imageId);
        return next;
      });
    }
  }

  async function retryFailedImagesInBatch() {
    if (!props.taskId || isBatchRunning || failedImageIds.length === 0) {
      return;
    }

    cancelBatchRef.current = false;
    const queue = [...failedImageIds];
    let completed = 0;
    let success = 0;
    let failed = 0;

    setRetryMessage(null);
    setBatchRetryState({
      completed: 0,
      failed: 0,
      startedAt: Date.now(),
      status: "running",
      success: 0,
      total: queue.length
    });

    const workers = Array.from({
      length: Math.min(Math.max(batchConcurrency, 1), queue.length)
    }).map(async () => {
      while (!cancelBatchRef.current) {
        const imageId = queue.shift();

        if (!imageId) {
          break;
        }

        const ok = await retryImage(imageId, { silent: true });
        completed += 1;
        success += ok ? 1 : 0;
        failed += ok ? 0 : 1;

        setBatchRetryState((current) =>
          current
            ? {
                ...current,
                completed,
                failed,
                success
              }
            : current
        );
      }
    });

    await Promise.all(workers);
    const wasCancelled = cancelBatchRef.current;

    setBatchRetryState((current) =>
      current
        ? {
            ...current,
            completed,
            failed,
            status: wasCancelled ? "cancelled" : "completed",
            success
          }
        : current
    );

    if (wasCancelled) {
      setRetryMessage("批量任务已取消。");
      cancelBatchRef.current = false;
      return;
    }

    setRetryMessage(`批量任务完成：成功 ${success} / 失败 ${failed}`);
  }

  function cancelBatchRetry() {
    if (!isBatchRunning) {
      return;
    }

    cancelBatchRef.current = true;
    inFlightControllersRef.current.forEach((controller) => controller.abort());
    inFlightControllersRef.current.clear();
  }

  function getAssetStatusLabel(asset: (typeof valueWithImages.imageAssets)[number]) {
    if (retryingImageIds.has(asset.id)) {
      return "生成中";
    }

    if (asset.status === "failed") {
      return "生成失败";
    }

    if (savedImageKeys.has(getImageSaveKey(asset))) {
      return "已保存";
    }

    if (asset.provider === "siliconflow") {
      return "已生成";
    }

    return "本地兜底";
  }

  return (
    <section className="editor-surface editor-surface--stacked">
      <div className="xiaohongshu-preview">
        <div className="xiaohongshu-preview__header">
          <div className="editor-section__heading">
            <h3>配图生成</h3>
            <p>已根据标题和图片提示生成 9 张小红书轮播卡片，可继续编辑提示词。</p>
          </div>
          <div className="xiaohongshu-preview__header-actions">
            <button
              className="xiaohongshu-bulk-save"
              disabled={downloadableImageEntries.length === 0}
              onClick={downloadAllImages}
              type="button"
            >
              批量保存 {downloadableImageEntries.length} 张配图
            </button>
            <button
              className="xiaohongshu-batch-retry"
              disabled={failedImageIds.length === 0 || isBatchRunning || !props.taskId}
              onClick={() => {
                void retryFailedImagesInBatch();
              }}
              type="button"
            >
              {isBatchRunning ? "批量重试中..." : `批量重试失败图 (${failedImageIds.length})`}
            </button>
            {isBatchRunning ? (
              <button
                className="xiaohongshu-batch-cancel"
                onClick={cancelBatchRetry}
                type="button"
              >
                取消生成
              </button>
            ) : null}
          </div>
        </div>

        <div className="xiaohongshu-status-row" aria-live="polite">
          <span className="xiaohongshu-status-row__summary">
            图片状态：{readyImageCount} 已就绪 / {failedImageCount} 失败
          </span>

          {batchRetryState ? (
            <span className="xiaohongshu-status-row__summary">
              批量任务：{batchRetryState.completed}/{batchRetryState.total}，
              成功 {batchRetryState.success} / 失败 {batchRetryState.failed}
            </span>
          ) : null}

          {batchRetryState ? (
            <span className="xiaohongshu-status-row__summary">
              耗时：{Math.max(0, Math.round(batchElapsedMs / 1000))}s
              {batchRetryState.completed > 0
                ? `，平均 ${Math.max(
                    1,
                    Math.round(batchElapsedMs / batchRetryState.completed / 1000)
                  )}s/张`
                : ""}
            </span>
          ) : null}

          {retryingImageIds.size > 0 ? (
            <span className="xiaohongshu-status-pill xiaohongshu-status-pill--generating">
              {retryingImageIds.size} 张生成中
            </span>
          ) : null}
          {retryMessage ? (
            <span className="xiaohongshu-status-row__message">{retryMessage}</span>
          ) : null}
        </div>

        <div className="xiaohongshu-batch-settings">
          <label htmlFor="xiaohongshu-batch-concurrency">并发数</label>
          <select
            id="xiaohongshu-batch-concurrency"
            disabled={isBatchRunning}
            onChange={(event) => {
              setBatchConcurrency(Number(event.target.value));
            }}
            value={batchConcurrency}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </div>

        <div className="xiaohongshu-carousel" aria-label="小红书配图预览">
          {valueWithImages.imageAssets.map((asset, index) => {
            const statusLabel = getAssetStatusLabel(asset);
            const canRetry =
              Boolean(props.taskId) &&
              !props.isEditing &&
              asset.status === "failed" &&
              !isBatchRunning;

            return (
              <article className="xiaohongshu-image-card" key={asset.id}>
                <button
                  aria-label={`放大查看图 ${index + 1}`}
                  className="xiaohongshu-image-card__visual-button"
                  onClick={() => setSelectedImageId(asset.id)}
                  type="button"
                >
                  <Image
                    alt={asset.alt}
                    className="xiaohongshu-image-card__visual"
                    height={1440}
                    sizes="(max-width: 720px) 78vw, 320px"
                    src={asset.src}
                    unoptimized
                    width={1080}
                  />
                </button>
                <div className="xiaohongshu-image-card__meta">
                  <div className="xiaohongshu-image-card__status">
                    <span>图 {index + 1}</span>
                    <span
                      className={`xiaohongshu-status-pill xiaohongshu-status-pill--${
                        asset.status === "failed"
                          ? "failed"
                          : retryingImageIds.has(asset.id)
                            ? "generating"
                            : "ready"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <strong>{asset.title}</strong>
                  {asset.errorMessage ? (
                    <small className="xiaohongshu-image-card__error">
                      {asset.errorMessage}
                    </small>
                  ) : null}
                  <div className="xiaohongshu-image-card__actions">
                    {asset.status !== "failed" ? (
                      <a
                        className="xiaohongshu-image-save"
                        download={getImageDownloadName(index, asset.src)}
                        href={asset.src}
                        onClick={() => markImageSaved(asset)}
                      >
                        保存图 {index + 1}
                      </a>
                    ) : null}
                    {canRetry ? (
                      <button
                        aria-label={`重新生成图 ${index + 1}`}
                        className="xiaohongshu-image-card__retry"
                        disabled={retryingImageIds.size > 0 && !retryingImageIds.has(asset.id)}
                        onClick={() => {
                          void retryImage(asset.id);
                        }}
                        type="button"
                      >
                        {retryingImageIds.has(asset.id) ? "生成中..." : "重新生成"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="xiaohongshu-plan">
        <div className="xiaohongshu-plan__summary">
          <span>分图策略</span>
          <strong>{valueWithImages.imagePlan.mode}</strong>
        </div>
        <p>{valueWithImages.imagePlan.decision.split("\n")[0]}</p>
        <div className="xiaohongshu-plan__grid">
          {valueWithImages.imagePlan.images.map((image, index) => (
            <article className="xiaohongshu-plan-card" key={image.id}>
              <span>图 {index + 1}</span>
              <strong>{image.title}</strong>
              <small>
                类型{image.type} · {image.typeName}
              </small>
              <small>
                {image.size} · {image.colorScheme}
              </small>
            </article>
          ))}
        </div>
      </div>

      <div className="editor-field">
        <label htmlFor="xh-title">笔记标题</label>
        <input
          id="xh-title"
          onChange={(event) => updateTitle(event.target.value)}
          readOnly={!props.isEditing}
          value={props.value.title}
        />
      </div>

      <div className="editor-field">
        <label htmlFor="xh-caption">文案</label>
        <textarea
          id="xh-caption"
          onChange={(event) =>
            props.onChange({ ...props.value, caption: event.target.value })
          }
          readOnly={!props.isEditing}
          rows={10}
          value={props.value.caption}
        />
      </div>

      <div className="editor-section">
        <div className="editor-section__heading">
          <h3>配图提示词</h3>
          <p>每条提示词对应上方一张轮播图，最多 9 张。</p>
        </div>
        <div className="xiaohongshu-prompt-grid">
          {valueWithImages.imageSuggestions.map((suggestion, index) => {
            const inputId = `xh-image-prompt-${index}`;

            return (
              <label
                className="editor-mini-card"
                htmlFor={inputId}
                key={`image-prompt-${index}`}
              >
                <span>第 {index + 1} 张配图提示词</span>
                <textarea
                  id={inputId}
                  onChange={(event) =>
                    updateImageSuggestion(index, event.target.value)
                  }
                  readOnly={!props.isEditing}
                  rows={3}
                  value={suggestion}
                />
              </label>
            );
          })}
        </div>
      </div>

      {props.value.hashtags.length > 0 ? (
        <div className="xiaohongshu-tags" aria-label="小红书标签">
          {props.value.hashtags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      ) : null}

      {selectedImageEntry ? (
        <div
          className="xiaohongshu-lightbox"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedImageId(null);
            }
          }}
          role="presentation"
        >
          <section
            aria-label={`图 ${selectedImageEntry.index + 1}`}
            aria-modal="true"
            className="xiaohongshu-lightbox__dialog"
            role="dialog"
          >
            <div className="xiaohongshu-lightbox__header">
              <div>
                <span>图 {selectedImageEntry.index + 1}</span>
                <h3>{selectedImageEntry.asset.title}</h3>
                <p>可右键复制图片，或使用保存按钮下载。</p>
              </div>
              <div className="xiaohongshu-lightbox__actions">
                <a
                  className="xiaohongshu-image-save xiaohongshu-image-save--strong"
                  download={getImageDownloadName(
                    selectedImageEntry.index,
                    selectedImageEntry.asset.src
                  )}
                  href={selectedImageEntry.asset.src}
                  onClick={() => markImageSaved(selectedImageEntry.asset)}
                >
                  保存这张图
                </a>
                <button
                  aria-label="关闭大图预览"
                  onClick={() => setSelectedImageId(null)}
                  type="button"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="xiaohongshu-lightbox__image-wrap">
              <Image
                alt={selectedImageEntry.asset.alt}
                className="xiaohongshu-lightbox__image"
                height={1440}
                sizes="min(92vw, 720px)"
                src={selectedImageEntry.asset.src}
                unoptimized
                width={1080}
              />
            </div>
            <p className="xiaohongshu-lightbox__prompt">
              {selectedImageEntry.asset.prompt}
            </p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
