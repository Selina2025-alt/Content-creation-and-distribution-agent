import type { PlatformId } from "@/lib/types";

const platformLabels: Record<PlatformId, string> = {
  wechat: "公众号文章",
  xiaohongshu: "小红书笔记",
  twitter: "Twitter",
  videoScript: "视频脚本"
};

export function PlatformTabs(props: {
  activePlatform: PlatformId;
  availablePlatforms: PlatformId[];
  onChange: (platform: PlatformId) => void;
}) {
  return (
    <div aria-label="平台标签" className="platform-tabs" role="tablist">
      {props.availablePlatforms.map((platform) => {
        const selected = props.activePlatform === platform;

        return (
          <button
            aria-selected={selected}
            className={`platform-tabs__tab${selected ? " platform-tabs__tab--active" : ""}`}
            key={platform}
            onClick={() => props.onChange(platform)}
            role="tab"
            type="button"
          >
            {platformLabels[platform]}
          </button>
        );
      })}
    </div>
  );
}
