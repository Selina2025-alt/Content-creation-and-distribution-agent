"use client";

import type { PlatformId } from "@/lib/types";

const platformOptions: Array<{
  id: PlatformId;
  label: string;
  tag: string;
  description: string;
}> = [
  {
    id: "wechat",
    label: "公众号文章",
    tag: "Long-form",
    description: "长文、深度观点、富文本编辑"
  },
  {
    id: "xiaohongshu",
    label: "小红书笔记",
    tag: "Lifestyle",
    description: "图文种草、9 图建议、短文案"
  },
  {
    id: "twitter",
    label: "Twitter",
    tag: "Thread-ready",
    description: "单条或 Thread，适合短观点输出"
  },
  {
    id: "videoScript",
    label: "视频脚本",
    tag: "Storyboard",
    description: "分镜、旁白、短视频结构"
  }
];

type PlatformMultiSelectProps = {
  value: PlatformId[];
  onChange: (nextValue: PlatformId[]) => void;
};

export function PlatformMultiSelect({
  value,
  onChange
}: PlatformMultiSelectProps) {
  function toggle(platform: PlatformId) {
    if (value.includes(platform)) {
      onChange(value.filter((item) => item !== platform));
      return;
    }

    onChange([...value, platform]);
  }

  return (
    <fieldset className="platform-select">
      <legend className="platform-select__legend">生成平台</legend>
      <div className="platform-select__grid">
        {platformOptions.map((option) => {
          const checked = value.includes(option.id);

          return (
            <label className="platform-card" key={option.id}>
              <input
                aria-label={option.label}
                checked={checked}
                onChange={() => toggle(option.id)}
                type="checkbox"
              />
              <span className="platform-card__surface">
                <span className="platform-card__tag">{option.tag}</span>
                <span className="platform-card__title">{option.label}</span>
                <span className="platform-card__description">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
