"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { ensureWechatCoverImagePlan } from "@/lib/content/wechat-cover-image-planning";
import type { PersistedWechatContent } from "@/lib/types";

type GenerateWechatCoverResponse = {
  code?: string;
  content?: PersistedWechatContent;
  detail?: string;
  message?: string;
};

const BUILTIN_WECHAT_IMAGE_SKILLS = [
  {
    id: "builtin-image-wechat-baoyu-cover",
    name: "JimLiu/baoyu-skills",
    summary: "默认策略：偏编辑封面，主标题层级清晰，适合公众号首图分发。"
  },
  {
    id: "builtin-image-wechat-md2wechat-cover",
    name: "geekjourneyx/md2wechat-skill",
    summary: "备选策略：偏 Hero 风格，强调 16:9 构图和标题可读性。"
  }
];

function getCoverFileName(src: string) {
  const cleanPath = src.split("?")[0]?.toLowerCase() ?? "";
  const extensionMatch = cleanPath.match(/\.(png|jpg|jpeg|webp)$/);
  const extension = extensionMatch?.[1] ?? "png";

  return `wechat-cover.${extension === "jpeg" ? "jpg" : extension}`;
}

function getSizeLabel(size?: string) {
  if (size === "landscape") {
    return "横版 16:9";
  }

  if (size === "square") {
    return "方版 1:1";
  }

  if (size === "portrait") {
    return "竖版 3:4";
  }

  return "自动";
}

function getVisualDirection(type?: number) {
  if (type === 1) {
    return "流程拆解型封面";
  }

  if (type === 2) {
    return "概念解释型封面";
  }

  if (type === 3) {
    return "对比冲突型封面";
  }

  if (type === 4) {
    return "工具清单型封面";
  }

  return "框架全景型封面";
}

export function ArticleEditor(props: {
  value: PersistedWechatContent;
  isEditing: boolean;
  onChange: (value: PersistedWechatContent) => void;
  taskId?: string;
}) {
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverStatusText, setCoverStatusText] = useState<string | null>(null);
  const contentWithPlan = useMemo(
    () => ensureWechatCoverImagePlan(props.value),
    [props.value]
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState(
    contentWithPlan.coverImagePlan.selectedImageId ?? contentWithPlan.coverImagePlan.images[0]?.id
  );
  const selectedCandidate = contentWithPlan.coverImagePlan.images.find(
    (candidate) => candidate.id === selectedCandidateId
  );
  const coverImageAsset = contentWithPlan.coverImageAsset;
  const hasReadyCoverImage = coverImageAsset?.status !== "failed" && Boolean(coverImageAsset?.src);
  const statusTone = coverStatusText?.includes("失败") ? "error" : "success";

  useEffect(() => {
    const nextSelectedId =
      contentWithPlan.coverImagePlan.selectedImageId ??
      contentWithPlan.coverImagePlan.images[0]?.id;

    setSelectedCandidateId(nextSelectedId);
  }, [contentWithPlan.coverImagePlan.images, contentWithPlan.coverImagePlan.selectedImageId]);

  function handleCandidateSelect(candidateId: string) {
    setSelectedCandidateId(candidateId);
    props.onChange({
      ...contentWithPlan,
      coverImagePlan: {
        ...contentWithPlan.coverImagePlan,
        selectedImageId: candidateId
      }
    });
  }

  async function handleGenerateCover() {
    if (!props.taskId) {
      setCoverStatusText("当前任务缺少 taskId，暂时无法生成首图。");
      return;
    }

    setIsGeneratingCover(true);
    setCoverStatusText(null);

    try {
      const response = await fetch(`/api/tasks/${props.taskId}/wechat-cover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          candidateId: selectedCandidateId
        })
      });
      const result = (await response.json()) as GenerateWechatCoverResponse;

      if (!response.ok || !result.content) {
        throw new Error(result.message ?? "公众号首图生成失败，请稍后再试。");
      }

      props.onChange({
        ...result.content,
        publishStatus: result.content.publishStatus ?? props.value.publishStatus
      });
      setCoverStatusText("公众号首图已生成，可直接下载或继续重生。");
    } catch (error) {
      setCoverStatusText(error instanceof Error ? error.message : "公众号首图生成失败，请稍后再试。");
    } finally {
      setIsGeneratingCover(false);
    }
  }

  return (
    <section className="editor-surface editor-surface--stacked">
      <div className="editor-field">
        <label htmlFor="article-title">文章标题</label>
        <input
          id="article-title"
          onChange={(event) =>
            props.onChange({ ...props.value, title: event.target.value })
          }
          readOnly={!props.isEditing}
          value={props.value.title}
        />
      </div>

      <div className="editor-field">
        <label htmlFor="article-summary">文章摘要</label>
        <textarea
          id="article-summary"
          onChange={(event) =>
            props.onChange({ ...props.value, summary: event.target.value })
          }
          readOnly={!props.isEditing}
          rows={4}
          value={props.value.summary}
        />
      </div>

      <section className="wechat-cover-studio">
        <header className="wechat-cover-studio__top">
          <div className="wechat-cover-studio__heading">
            <p className="wechat-cover-studio__eyebrow">WECHAT COVER LAB</p>
            <h3>公众号首图工作台</h3>
            <p>
              采用内置公众号生图技能驱动，不再固定走早期模板文案流程。未手动绑定时默认使用
              <strong> JimLiu/baoyu-skills </strong>，并保留
              <strong> geekjourneyx/md2wechat-skill </strong>作为辅助策略。当前策略默认生成
              <strong>无字视觉封面</strong>，避免糊字和乱码。
            </p>
          </div>
          <button
            className="wechat-cover-studio__generate"
            disabled={isGeneratingCover || !selectedCandidate}
            onClick={() => {
              void handleGenerateCover();
            }}
            type="button"
          >
            {isGeneratingCover ? "生成中..." : "生成公众号首图"}
          </button>
        </header>

        <div className="wechat-cover-studio__skill-strip">
          {BUILTIN_WECHAT_IMAGE_SKILLS.map((skill, index) => (
            <article className="wechat-cover-skill-card" key={skill.id}>
              <span className="wechat-cover-skill-card__tag">
                {index === 0 ? "默认技能" : "辅助技能"}
              </span>
              <strong>{skill.name}</strong>
              <p>{skill.summary}</p>
            </article>
          ))}
        </div>

        <div className="wechat-cover-studio__statusbar">
          <span className="wechat-cover-pill">模式：{contentWithPlan.coverImagePlan.mode}</span>
          {selectedCandidate ? (
            <>
              <span className="wechat-cover-pill">
                类型：{selectedCandidate.type} / {selectedCandidate.typeName}
              </span>
              <span className="wechat-cover-pill">尺寸：{getSizeLabel(selectedCandidate.size)}</span>
              <span className="wechat-cover-pill">
                配色：{selectedCandidate.colorScheme}
              </span>
            </>
          ) : null}
        </div>

        <div className="wechat-cover-studio__body">
          <section className="wechat-cover-studio__plans">
            <div className="wechat-cover-studio__section-head">
              <h4>候选封面方案</h4>
              <p>选择一个方案后再点击右上角生成，支持反复重生。</p>
            </div>
            <div className="wechat-cover-studio__candidate-grid">
              {contentWithPlan.coverImagePlan.images.map((candidate, index) => {
                const isSelected = candidate.id === selectedCandidateId;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`wechat-cover-plan${isSelected ? " is-selected" : ""}`}
                    key={candidate.id}
                    onClick={() => handleCandidateSelect(candidate.id)}
                    type="button"
                  >
                    <span className="wechat-cover-plan__index">方案 {index + 1}</span>
                    <strong className="wechat-cover-plan__title">{candidate.title}</strong>
                    <p className="wechat-cover-plan__direction">{getVisualDirection(candidate.type)}</p>
                    <div className="wechat-cover-plan__meta">
                      <span>{candidate.typeName}</span>
                      <span>{getSizeLabel(candidate.size)}</span>
                      <span>{candidate.colorScheme}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <details className="wechat-cover-studio__trace">
              <summary>查看分图决策与溯源</summary>
              <pre>{contentWithPlan.coverImagePlan.decision}</pre>
            </details>
          </section>

          <section className="wechat-cover-studio__result">
            <div className="wechat-cover-studio__section-head">
              <h4>首图结果</h4>
              <p>生成后可直接下载，用于公众号封面上传。</p>
            </div>

            {coverStatusText ? (
              <p
                aria-live="polite"
                className={`wechat-cover-studio__status wechat-cover-studio__status--${statusTone}`}
              >
                {coverStatusText}
              </p>
            ) : null}

            {coverImageAsset ? (
              <article className="wechat-cover-preview">
                <div className="wechat-cover-preview__media">
                  {hasReadyCoverImage ? (
                    <Image
                      alt={coverImageAsset.alt}
                      className="wechat-cover-preview__image"
                      height={1024}
                      sizes="(max-width: 960px) 100vw, 720px"
                      src={coverImageAsset.src}
                      unoptimized
                      width={768}
                    />
                  ) : (
                    <div className="wechat-cover-preview__error">
                      <p>首图生成失败</p>
                      {coverImageAsset.errorMessage ? (
                        <small>{coverImageAsset.errorMessage}</small>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="wechat-cover-preview__meta">
                  <strong>{coverImageAsset.title}</strong>
                  <span>
                    类型 {coverImageAsset.type} / {coverImageAsset.typeName}
                  </span>
                  <span>
                    {getSizeLabel(coverImageAsset.size)} / {coverImageAsset.colorScheme}
                  </span>
                  {hasReadyCoverImage ? (
                    <a
                      className="wechat-cover-preview__save"
                      download={getCoverFileName(coverImageAsset.src)}
                      href={coverImageAsset.src}
                    >
                      下载首图
                    </a>
                  ) : null}
                </div>
              </article>
            ) : (
              <div className="wechat-cover-studio__empty">
                <p>还没有生成首图，请先选择左侧候选方案，然后点击“生成公众号首图”。</p>
              </div>
            )}
          </section>
        </div>
      </section>

      <div className="editor-field">
        <label htmlFor="article-body">正文</label>
        <textarea
          id="article-body"
          onChange={(event) =>
            props.onChange({ ...props.value, body: event.target.value })
          }
          readOnly={!props.isEditing}
          rows={18}
          value={props.value.body}
        />
      </div>
    </section>
  );
}
