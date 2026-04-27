"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

type HistoryItem = {
  id: string;
  title: string;
  updatedAt: string;
};

type HistorySidebarProps = {
  items: HistoryItem[];
  activeTaskId: string;
  onSelect: (taskId: string) => void;
  onRename: (taskId: string, title: string) => void;
  onDelete: (taskId: string) => void;
};

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function HistorySidebar({
  items,
  activeTaskId,
  onSelect,
  onRename,
  onDelete
}: HistorySidebarProps) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        item.title.toLowerCase().includes(deferredQuery.toLowerCase())
      ),
    [deferredQuery, items]
  );

  function startRename(item: HistoryItem) {
    setEditingId(item.id);
    setDraftTitle(item.title);
  }

  function submitRename() {
    if (!editingId || !draftTitle.trim()) {
      setEditingId(null);
      return;
    }

    onRename(editingId, draftTitle.trim());
    setEditingId(null);
  }

  return (
    <aside className="history-sidebar">
      <div className="history-sidebar__header">
        <p className="history-sidebar__eyebrow">History</p>
        <h2 className="history-sidebar__title">创作记录</h2>
      </div>

      <input
        className="history-sidebar__search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索历史记录"
        type="search"
        value={query}
      />

      <div className="history-sidebar__list">
        {filteredItems.map((item) => {
          const isActive = item.id === activeTaskId;
          const isEditing = editingId === item.id;

          return (
            <article
              className={`history-card${isActive ? " history-card--active" : ""}`}
              key={item.id}
            >
              <Link
                className="history-card__select"
                href={`/workspace/${item.id}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="history-card__title">{item.title}</span>
                <span className="history-card__time">
                  {formatUpdatedAt(item.updatedAt)}
                </span>
              </Link>

              {isEditing ? (
                <div className="history-card__rename">
                  <input
                    aria-label="重命名任务"
                    className="history-card__rename-input"
                    onChange={(event) => setDraftTitle(event.target.value)}
                    value={draftTitle}
                  />
                  <button
                    className="history-card__action"
                    onClick={submitRename}
                    type="button"
                  >
                    保存标题
                  </button>
                </div>
              ) : (
                <div className="history-card__actions">
                  <button
                    aria-label={`重命名 ${item.title}`}
                    className="history-card__action"
                    onClick={() => startRename(item)}
                    type="button"
                  >
                    重命名
                  </button>
                  <button
                    aria-label={`删除 ${item.title}`}
                    className="history-card__action history-card__action--danger"
                    onClick={() => onDelete(item.id)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {filteredItems.length === 0 ? (
          <div className="history-sidebar__empty">没有匹配到历史记录。</div>
        ) : null}
      </div>
    </aside>
  );
}
