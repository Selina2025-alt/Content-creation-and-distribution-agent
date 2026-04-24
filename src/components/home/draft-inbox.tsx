"use client";

import type { DraftRecord, PlatformId } from "@/lib/types";

const platformLabels: Record<PlatformId, string> = {
  wechat: "公众号",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  videoScript: "视频脚本"
};

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function DraftInbox(props: {
  activeDraftId: string | null;
  drafts: DraftRecord[];
  isLoading: boolean;
  libraryTaskIds: string[];
  archivingDraftId?: string | null;
  onAddToLibrary: (draft: DraftRecord) => void;
  onContinueDraft: (draft: DraftRecord) => void;
  onCreateDraft: () => void;
  onDeleteDraft: (draftId: string) => void;
}) {
  return (
    <section className="draft-inbox">
      <div className="draft-inbox__header">
        <div>
          <p className="draft-inbox__eyebrow">Draft Inbox</p>
          <h3 className="draft-inbox__title">需求草稿箱</h3>
        </div>
        <button
          className="draft-inbox__create"
          onClick={props.onCreateDraft}
          type="button"
        >
          新建草稿
        </button>
      </div>

      <p className="draft-inbox__hint">
        自动保留你的需求草稿，随时切回来继续扩写或重新生成。
      </p>

      {props.isLoading ? (
        <div className="draft-inbox__empty">正在读取草稿箱...</div>
      ) : null}

      {!props.isLoading && props.drafts.length === 0 ? (
        <div className="draft-inbox__empty">
          还没有保存的需求草稿。先写下一条想做的主题，系统会自动帮你存起来。
        </div>
      ) : null}

      <div className="draft-inbox__list">
        {props.drafts.map((draft) => {
          const isActive = draft.id === props.activeDraftId;
          const canArchive =
            draft.status === "generated" && Boolean(draft.lastGeneratedTaskId);
          const isArchived =
            canArchive &&
            props.libraryTaskIds.includes(draft.lastGeneratedTaskId as string);
          const isArchiving = props.archivingDraftId === draft.id;

          return (
            <article
              className={`draft-card${isActive ? " draft-card--active" : ""}`}
              key={draft.id}
            >
              <div className="draft-card__meta">
                <span className="draft-card__status">
                  {draft.status === "generated" ? "已生成过" : "草稿中"}
                </span>
                <span>{formatUpdatedAt(draft.updatedAt)}</span>
              </div>
              <h4 className="draft-card__title">{draft.title}</h4>
              <p className="draft-card__prompt">{draft.prompt || "等待补充需求内容。"}</p>
              <div className="draft-card__chips">
                {draft.selectedPlatforms.length > 0 ? (
                  draft.selectedPlatforms.map((platform) => (
                    <span className="draft-card__chip" key={platform}>
                      {platformLabels[platform]}
                    </span>
                  ))
                ) : (
                  <span className="draft-card__chip draft-card__chip--muted">
                    尚未选择平台
                  </span>
                )}
              </div>
              <div className="draft-card__actions">
                <button
                  aria-label={`继续编辑 ${draft.title}`}
                  className="draft-card__action draft-card__action--primary"
                  onClick={() => props.onContinueDraft(draft)}
                  type="button"
                >
                  {isActive ? "正在编辑" : "继续编辑"}
                </button>

                {canArchive ? (
                  isArchived ? (
                    <button
                      className="draft-card__action draft-card__action--muted"
                      disabled
                      type="button"
                    >
                      已加入内容库
                    </button>
                  ) : (
                    <button
                      aria-label={`加入内容库 ${draft.title}`}
                      className="draft-card__action draft-card__action--accent"
                      disabled={isArchiving}
                      onClick={() => props.onAddToLibrary(draft)}
                      type="button"
                    >
                      {isArchiving ? "加入中..." : "加入内容库"}
                    </button>
                  )
                ) : null}

                <button
                  aria-label={`删除草稿 ${draft.title}`}
                  className="draft-card__action"
                  onClick={() => props.onDeleteDraft(draft.id)}
                  type="button"
                >
                  删除
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
