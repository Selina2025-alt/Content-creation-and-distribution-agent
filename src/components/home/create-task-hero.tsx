"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition
} from "react";
import { useRouter } from "next/navigation";

import { DraftInbox } from "@/components/home/draft-inbox";
import { GenerationProgress } from "@/components/home/generation-progress";
import { HomeLibraryPreview } from "@/components/home/home-library-preview";
import { PlatformMultiSelect } from "@/components/home/platform-multi-select";
import type { DraftRecord, PlatformId, WechatLibraryItem } from "@/lib/types";

const AUTOSAVE_DELAY_MS = 600;

function buildDraftTitle(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "未命名草稿";
  }

  return normalized.slice(0, 24);
}

export function CreateTaskHero() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [platforms, setPlatforms] = useState<PlatformId[]>([]);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [libraryItems, setLibraryItems] = useState<WechatLibraryItem[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [enableXiaohongshuImageGeneration, setEnableXiaohongshuImageGeneration] =
    useState(false);
  const [isDraftsLoading, setIsDraftsLoading] = useState(true);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [archivingDraftId, setArchivingDraftId] = useState<string | null>(null);
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const deferredPrompt = useDeferredValue(prompt);
  const promptLength = deferredPrompt.trim().length;
  const isXiaohongshuSelected = platforms.includes("xiaohongshu");
  const isHydratingDraft = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const saveDraftPromiseRef = useRef<Promise<DraftRecord | null> | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadHomeData() {
      try {
        const [draftsResponse, libraryResponse] = await Promise.all([
          fetch("/api/drafts"),
          fetch("/api/library")
        ]);

        if (draftsResponse.ok && !isCancelled) {
          const payload = (await draftsResponse.json()) as DraftRecord[];
          setDrafts(payload);
        }

        if (libraryResponse.ok && !isCancelled) {
          const payload = (await libraryResponse.json()) as {
            items: WechatLibraryItem[];
          };
          setLibraryItems(payload.items);
        }
      } catch {
        if (!isCancelled) {
          setDrafts([]);
          setLibraryItems([]);
        }
      } finally {
        if (!isCancelled) {
          setIsDraftsLoading(false);
          setIsLibraryLoading(false);
        }
      }
    }

    void loadHomeData();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isXiaohongshuSelected) {
      setEnableXiaohongshuImageGeneration(false);
    }
  }, [isXiaohongshuSelected]);

  const persistDraftSnapshot = useCallback(async () => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (saveDraftPromiseRef.current) {
      return saveDraftPromiseRef.current;
    }

    const hasMeaningfulContent =
      prompt.trim().length > 0 || platforms.length > 0 || activeDraftId !== null;

    if (!hasMeaningfulContent) {
      setIsDraftDirty(false);
      return null;
    }

    const saveOperation = (async () => {
      setIsDraftSaving(true);

      try {
        if (activeDraftId) {
          const response = await fetch(`/api/drafts/${activeDraftId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              title: buildDraftTitle(prompt),
              prompt,
              selectedPlatforms: platforms
            })
          });

          if (!response.ok) {
            return null;
          }

          const savedDraft = (await response.json()) as DraftRecord;

          setDrafts((current) =>
            current.map((draft) => (draft.id === savedDraft.id ? savedDraft : draft))
          );
          setIsDraftDirty(false);

          return savedDraft;
        }

        if (!prompt.trim()) {
          setIsDraftDirty(false);
          return null;
        }

        const response = await fetch("/api/drafts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: buildDraftTitle(prompt),
            prompt,
            selectedPlatforms: platforms
          })
        });

        if (!response.ok) {
          return null;
        }

        const savedDraft = (await response.json()) as DraftRecord;

        setActiveDraftId(savedDraft.id);
        setDrafts((current) => [
          savedDraft,
          ...current.filter((draft) => draft.id !== savedDraft.id)
        ]);
        setIsDraftDirty(false);

        return savedDraft;
      } finally {
        setIsDraftSaving(false);
      }
    })();

    saveDraftPromiseRef.current = saveOperation;

    try {
      return await saveOperation;
    } finally {
      saveDraftPromiseRef.current = null;
    }
  }, [activeDraftId, platforms, prompt]);

  useEffect(() => {
    if (isHydratingDraft.current) {
      isHydratingDraft.current = false;
      return;
    }

    if (!isDraftDirty) {
      return;
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraftSnapshot();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [activeDraftId, isDraftDirty, persistDraftSnapshot]);

  async function handleSubmit() {
    if (!prompt.trim()) {
      setFormError("先写下你的创作需求，我们再开始生成。");
      return;
    }

    if (platforms.length === 0) {
      setFormError("至少选择一个要生成的平台。");
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    try {
      const savedDraft =
        isDraftDirty || (!activeDraftId && prompt.trim())
          ? await persistDraftSnapshot()
          : null;
      const sourceDraftId = savedDraft?.id ?? activeDraftId ?? undefined;
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          platforms,
          sourceDraftId,
          enableWebSearch,
          enableXiaohongshuImageGeneration
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          message?: string;
        };

        throw new Error(payload.message ?? "Failed to create task");
      }

      const task = (await response.json()) as { id: string };

      if (sourceDraftId) {
        setDrafts((current) =>
          current.map((draft) =>
            draft.id === sourceDraftId
              ? {
                  ...draft,
                  title: buildDraftTitle(prompt),
                  prompt,
                  selectedPlatforms: platforms,
                  status: "generated",
                  lastGeneratedTaskId: task.id,
                  updatedAt: new Date().toISOString()
                }
              : draft
          )
        );
      }

      startTransition(() => {
        router.push(`/workspace/${task.id}`);
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "生成任务时出了点问题，请稍后再试。"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueDraft(draft: DraftRecord) {
    if (draft.status === "generated" && draft.lastGeneratedTaskId) {
      startTransition(() => {
        router.push(`/workspace/${draft.lastGeneratedTaskId}`);
      });
      return;
    }

    isHydratingDraft.current = true;
    setActiveDraftId(draft.id);
    setPrompt(draft.prompt);
    setPlatforms(draft.selectedPlatforms);
    setEnableWebSearch(false);
    setEnableXiaohongshuImageGeneration(false);
    setFormError("");
    setIsDraftDirty(false);
  }

  function handleCreateDraft() {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setActiveDraftId(null);
    setPrompt("");
    setPlatforms([]);
    setEnableWebSearch(false);
    setEnableXiaohongshuImageGeneration(false);
    setFormError("");
    setIsDraftDirty(false);
  }

  async function handleDeleteDraft(draftId: string) {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    await fetch(`/api/drafts/${draftId}`, {
      method: "DELETE"
    });

    setDrafts((current) => current.filter((draft) => draft.id !== draftId));

    if (draftId === activeDraftId) {
      handleCreateDraft();
    }
  }

  async function handleAddToLibrary(draft: DraftRecord) {
    setArchivingDraftId(draft.id);
    setFormError("");

    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          draftId: draft.id
        })
      });

      if (!response.ok) {
        throw new Error("Failed to archive article");
      }

      const payload = (await response.json()) as {
        item: WechatLibraryItem | null;
      };

      const archivedItem = payload.item;

      if (archivedItem) {
        setLibraryItems((current) => [
          archivedItem,
          ...current.filter((item) => item.taskId !== archivedItem.taskId)
        ]);
      }
    } catch {
      setFormError("加入内容库时出了点问题，请稍后再试。");
    } finally {
      setArchivingDraftId(null);
    }
  }

  return (
    <section className="hero-shell">
      <div className="hero-panel">
        <div className="hero-panel__header">
          <div>
            <h2 className="hero-panel__title">把需求丢进来，剩下交给系统</h2>
            <p className="hero-panel__hint">
              一句话讲清主题、受众和风格，我们会按平台差异拆成可编辑内容。
            </p>
          </div>

          <div className="hero-panel__header-actions">
            <span className="hero-panel__badge">Prototype</span>
            <Link
              aria-label="打开内容库"
              className="hero-panel__icon-link"
              href="/library"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="16"
                viewBox="0 0 24 24"
                width="16"
              >
                <path
                  d="M5.5 5.75A2.25 2.25 0 0 1 7.75 3.5H18.5v15.25A1.75 1.75 0 0 0 16.75 17H7.75A2.25 2.25 0 0 0 5.5 19.25V5.75Zm0 13.5A2.25 2.25 0 0 1 7.75 17H18.5M9 7.5h6m-6 3h6m-6 3h4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.2"
                />
              </svg>
            </Link>
            <Link
              aria-label="打开设置"
              className="hero-panel__icon-link"
              href="/settings"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="16"
                viewBox="0 0 24 24"
                width="16"
              >
                <path
                  d="M12 3.25a2.75 2.75 0 0 1 2.75 2.75v.28c.45.18.88.42 1.28.7l.23-.14a2.75 2.75 0 1 1 2.75 4.77l-.24.14c.03.27.05.54.05.82s-.02.55-.05.82l.24.14a2.75 2.75 0 1 1-2.75 4.77l-.23-.14c-.4.28-.83.52-1.28.7V18a2.75 2.75 0 1 1-5.5 0v-.28a5.8 5.8 0 0 1-1.28-.7l-.23.14a2.75 2.75 0 1 1-2.75-4.77l.24-.14a6.54 6.54 0 0 1-.05-.82c0-.28.02-.55.05-.82l-.24-.14a2.75 2.75 0 1 1 2.75-4.77l.23.14c.4-.28.83-.52 1.28-.7V6A2.75 2.75 0 0 1 12 3.25Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.2"
                />
                <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="prompt-field">
          <label className="prompt-field__label" htmlFor="creation-prompt">
            创作需求
          </label>
          <textarea
            aria-label="创作需求"
            className="prompt-field__textarea"
            id="creation-prompt"
            onChange={(event) => {
              setPrompt(event.target.value);
              setIsDraftDirty(true);
            }}
            placeholder="例如：写一篇关于如何提高工作效率的内容，面向 25-35 岁知识工作者，风格清晰、有方法论、有案例。"
            value={prompt}
          />
          <div className="prompt-field__meta">
            <div className="prompt-field__meta-group">
              <span className="prompt-field__meta-hint">写得越具体，生成结果越稳。</span>
              <span className="prompt-field__meta-status">
                {isDraftSaving
                  ? "正在保存草稿..."
                  : activeDraftId
                    ? "已连接到草稿箱"
                    : "尚未生成草稿"}
              </span>
            </div>
            <span>{promptLength} chars</span>
          </div>
        </div>

        <PlatformMultiSelect
          onChange={(nextPlatforms) => {
            setPlatforms(nextPlatforms);
            setIsDraftDirty(true);
          }}
          value={platforms}
        />

        <label className="research-toggle">
          <input
            aria-label="启用联网搜索"
            checked={enableWebSearch}
            onChange={(event) => setEnableWebSearch(event.target.checked)}
            type="checkbox"
          />
          <span className="research-toggle__visual" aria-hidden="true" />
          <span className="research-toggle__copy">
            <strong>启用联网搜索</strong>
            <small>生成公众号文章前检索资料，并在创作过程里保留来源。</small>
          </span>
        </label>

        <label className="research-toggle">
          <input
            aria-label="启用小红书AI生图"
            checked={enableXiaohongshuImageGeneration}
            disabled={!isXiaohongshuSelected}
            onChange={(event) =>
              setEnableXiaohongshuImageGeneration(event.target.checked)
            }
            type="checkbox"
          />
          <span className="research-toggle__visual" aria-hidden="true" />
          <span className="research-toggle__copy">
            <strong>启用小红书AI生图</strong>
            <small>
              默认关闭以节省 token；仅在需要时开启，生成阶段才会调用小红书图片模型。
            </small>
          </span>
        </label>

        <div className="hero-panel__footer">
          <div>
            {formError ? (
              <p className="hero-panel__error" role="alert">
                {formError}
              </p>
            ) : (
              <p className="hero-panel__subtle">
                当前选择会同步保存到草稿箱，生成后仍可继续修改需求再出新版本。
              </p>
            )}
          </div>

          <div className="hero-panel__actions">
            <GenerationProgress visible={isSubmitting} />
            <button
              className="hero-submit"
              disabled={isSubmitting}
              onClick={handleSubmit}
              type="button"
            >
              生成多平台内容
            </button>
          </div>
        </div>
      </div>

      <div className="hero-secondary-grid">
        <DraftInbox
          activeDraftId={activeDraftId}
          archivingDraftId={archivingDraftId}
          drafts={drafts}
          isLoading={isDraftsLoading}
          libraryTaskIds={libraryItems.map((item) => item.taskId)}
          onAddToLibrary={(draft) => {
            void handleAddToLibrary(draft);
          }}
          onContinueDraft={handleContinueDraft}
          onCreateDraft={handleCreateDraft}
          onDeleteDraft={(draftId) => {
            void handleDeleteDraft(draftId);
          }}
        />

        <HomeLibraryPreview items={libraryItems} isLoading={isLibraryLoading} />
      </div>

      <aside className="hero-sidecard">
        <p className="hero-sidecard__title">This Flow Includes</p>
        <div className="hero-sidecard__list">
          <article className="hero-sidecard__item">
            <strong>需求起草</strong>
            <p>首页自动保留多条需求草稿，随时恢复继续写。</p>
          </article>
          <article className="hero-sidecard__item">
            <strong>多平台拆创作</strong>
            <p>一次输入后，先完成公众号生成，后续再扩到更多平台。</p>
          </article>
          <article className="hero-sidecard__item">
            <strong>内容沉淀</strong>
            <p>已归档文章会进入内容库预览，后续按文章维度回看和继续编辑。</p>
          </article>
        </div>
      </aside>
    </section>
  );
}
