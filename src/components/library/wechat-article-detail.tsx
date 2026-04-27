import Link from "next/link";

import type { WechatLibraryDetail } from "@/lib/types";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function WechatArticleDetail(props: { detail: WechatLibraryDetail }) {
  return (
    <main className="library-detail-layout">
      <div className="library-detail-shell">
        <div className="library-detail-toolbar">
          <Link className="page-return-link" href="/library">
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
            <span>返回内容库</span>
          </Link>
          <Link className="page-return-link page-return-link--subtle" href="/">
            返回主页
          </Link>
        </div>

        <article className="library-detail-card">
          <p className="library-detail-card__eyebrow">Wechat Article</p>
          <h1 className="library-detail-card__title">{props.detail.title}</h1>
          <p className="library-detail-card__summary">{props.detail.summary}</p>
          <div className="library-detail-card__meta">
            <span>最近更新：{formatUpdatedAt(props.detail.updatedAt)}</span>
            <Link href={`/workspace/${props.detail.taskId}`}>打开工作台继续编辑</Link>
          </div>

          <section className="library-detail-card__body">
            {props.detail.body.split(/\n{2,}/).map((paragraph, index) => (
              <p key={`${props.detail.taskId}-paragraph-${index}`}>
                {paragraph.trim()}
              </p>
            ))}
          </section>
        </article>
      </div>
    </main>
  );
}
