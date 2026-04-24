"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import type { HistoryActionRecord, WechatLibraryItem } from "@/lib/types";

const publishStatusLabels = {
  idle: "未发布",
  publishing: "发布中",
  published: "已发布",
  failed: "发布失败"
} as const;

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatActionLabel(action: HistoryActionRecord) {
  if (action.actionType === "task_created") {
    return "任务已生成";
  }

  if (action.actionType === "wechat_published") {
    return "公众号模拟发布成功";
  }

  if (action.actionType === "library_saved") {
    return "已加入内容库";
  }

  return action.actionType;
}

function buildActionDetail(action: HistoryActionRecord) {
  if (typeof action.payload.title === "string") {
    return action.payload.title;
  }

  if (typeof action.payload.platform === "string") {
    return `平台：${action.payload.platform}`;
  }

  return `任务 ID：${action.taskId}`;
}

export function WechatLibraryShell(props: {
  items: WechatLibraryItem[];
  recentActions: HistoryActionRecord[];
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return props.items;
    }

    return props.items.filter((item) =>
      `${item.title} ${item.summary} ${item.userInput}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [deferredQuery, props.items]);

  return (
    <main className="library-layout">
      <aside className="library-nav">
        <Link className="page-return-link" href="/">
          <svg
            aria-hidden="true"
            fill="none"
            height="14"
            viewBox="0 0 16 16"
            width="14"
          >
            <path
              d="M6.5 3.5 2.5 8l4 4.5M3 8h10.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
          <span>返回主页</span>
        </Link>

        <p className="library-nav__eyebrow">Content Library</p>
        <h1 className="library-nav__title">内容库</h1>
        <p className="library-nav__description">
          这里收纳你主动加入内容库的公众号文章。列表只看标题和摘要，正文进入详情页查看。
        </p>

        <div className="library-nav__actions">
          <Link className="library-nav__action" href="/">
            新建需求
          </Link>
          <Link
            className="library-nav__action library-nav__action--ghost"
            href="/settings"
          >
            打开设置
          </Link>
        </div>
      </aside>

      <section className="library-content">
        <div className="library-toolbar">
          <div>
            <p className="library-toolbar__eyebrow">Wechat Articles</p>
            <h2 className="library-toolbar__title">公众号文章资产</h2>
          </div>
          <label className="library-search" htmlFor="library-search">
            <span className="library-search__label">搜索内容库</span>
            <input
              aria-label="搜索内容库"
              id="library-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="按标题、摘要或来源需求搜索"
              type="search"
              value={query}
            />
          </label>
        </div>

        <div className="library-main-grid">
          <section className="library-articles">
            {filteredItems.length === 0 ? (
              <div className="library-empty">
                还没有匹配的公众号文章。先回到首页，把草稿箱里已生成的文章加入内容库。
              </div>
            ) : (
              filteredItems.map((item) => (
                <article className="library-article-card" key={item.taskId}>
                  <div className="library-article-card__meta">
                    <span className="library-article-card__platform">公众号文章</span>
                    <span className="library-article-card__status">
                      {publishStatusLabels[item.publishStatus]}
                    </span>
                  </div>
                  <h3 className="library-article-card__title">{item.title}</h3>
                  <p className="library-article-card__summary">{item.summary}</p>
                  <p className="library-article-card__source">{item.userInput}</p>
                  <div className="library-article-card__footer">
                    <span>{formatUpdatedAt(item.updatedAt)}</span>
                    <div className="library-article-card__links">
                      <Link
                        aria-label={`查看正文 ${item.title}`}
                        className="library-article-card__link library-article-card__link--ghost"
                        href={`/library/${item.taskId}`}
                      >
                        查看正文
                      </Link>
                      <Link
                        aria-label={`打开工作台 ${item.title}`}
                        className="library-article-card__link"
                        href={`/workspace/${item.taskId}`}
                      >
                        打开工作台
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="library-timeline">
            <div className="library-timeline__header">
              <p className="library-timeline__eyebrow">Recent Actions</p>
              <h2 className="library-timeline__title">最近操作</h2>
            </div>

            {props.recentActions.length === 0 ? (
              <div className="library-empty library-empty--compact">
                还没有操作记录。生成、归档或发布内容后，这里会自动留下时间线。
              </div>
            ) : (
              <div className="library-timeline__list">
                {props.recentActions.map((action) => (
                  <article className="library-timeline__item" key={action.id}>
                    <div className="library-timeline__dot" />
                    <div>
                      <strong>{formatActionLabel(action)}</strong>
                      <p>{buildActionDetail(action)}</p>
                      <span>{formatUpdatedAt(action.createdAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
