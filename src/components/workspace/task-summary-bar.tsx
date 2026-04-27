import Link from "next/link";

import type { PlatformId } from "@/lib/types";

const platformLabels: Record<PlatformId, string> = {
  wechat: "公众号文章",
  xiaohongshu: "小红书笔记",
  twitter: "Twitter",
  videoScript: "视频脚本"
};

export function TaskSummaryBar(props: {
  title: string;
  prompt: string;
  selectedPlatforms: PlatformId[];
  backHref?: string;
}) {
  return (
    <section className="task-summary">
      <div className="task-summary__content">
        {props.backHref ? (
          <div className="task-summary__links">
            <Link className="page-return-link page-return-link--subtle" href={props.backHref}>
              <svg
                aria-hidden="true"
                fill="none"
                height="12"
                viewBox="0 0 16 16"
                width="12"
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
            <Link className="page-return-link page-return-link--subtle" href="/library">
              <span>打开内容库</span>
            </Link>
          </div>
        ) : null}
        <p className="task-summary__eyebrow">Current Task</p>
        <h1 className="task-summary__title">{props.title}</h1>
        <p className="task-summary__prompt">{props.prompt}</p>
      </div>
      <div
        aria-label="已选平台"
        className="task-summary__chips task-summary__chips--single-row task-summary__chips--full-visible"
      >
        {props.selectedPlatforms.map((platform) => (
          <span className="task-summary__chip" key={platform}>
            {platformLabels[platform]}
          </span>
        ))}
      </div>
    </section>
  );
}
