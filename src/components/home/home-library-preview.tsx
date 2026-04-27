import Link from "next/link";

import type { WechatLibraryItem } from "@/lib/types";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function HomeLibraryPreview(props: {
  items: WechatLibraryItem[];
  isLoading?: boolean;
}) {
  return (
    <aside className="hero-library-card">
      <div>
        <p className="hero-library-card__eyebrow">Content Library</p>
        <h3 className="hero-library-card__title">内容库</h3>
        <p className="hero-library-card__description">
          已归档的公众号文章会显示在这里。首页只预览标题和摘要，点开后再查看正文。
        </p>
      </div>

      <div className="hero-library-card__list">
        {props.isLoading ? (
          <div className="hero-library-card__empty">正在读取内容库预览...</div>
        ) : props.items.length === 0 ? (
          <div className="hero-library-card__empty">
            还没有加入内容库的文章。先在左侧草稿箱里把已生成的文章加入内容库，这里就会出现预览。
          </div>
        ) : (
          props.items.map((item) => (
            <Link
              aria-label={`查看文章 ${item.title}`}
              className="hero-library-card__item"
              href={`/library/${item.taskId}`}
              key={item.taskId}
            >
              <div className="hero-library-card__item-header">
                <strong>{item.title}</strong>
                <span>{formatUpdatedAt(item.updatedAt)}</span>
              </div>
              <p>{item.summary}</p>
            </Link>
          ))
        )}
      </div>

      <Link className="hero-library-card__link" href="/library">
        打开内容库
      </Link>
    </aside>
  );
}
