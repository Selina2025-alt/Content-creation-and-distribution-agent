import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskSummaryBar } from "@/components/workspace/task-summary-bar";

describe("TaskSummaryBar", () => {
  it("renders compact links for returning home and opening the library", () => {
    render(
      <TaskSummaryBar
        backHref="/"
        prompt="写一篇关于智能体发展的文章"
        selectedPlatforms={["twitter"]}
        title="智能体发展观察"
      />
    );

    expect(screen.getByRole("link", { name: "返回主页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "打开内容库" })).toHaveAttribute(
      "href",
      "/library"
    );
  });

  it("keeps all selected platform chips in one non-wrapping row", () => {
    render(
      <TaskSummaryBar
        backHref="/"
        prompt="写一篇多平台内容"
        selectedPlatforms={["wechat", "xiaohongshu", "twitter", "videoScript"]}
        title="多平台内容"
      />
    );

    expect(screen.getByLabelText("已选平台")).toHaveClass(
      "task-summary__chips--single-row"
    );
    expect(screen.getByLabelText("已选平台")).toHaveClass(
      "task-summary__chips--full-visible"
    );
    expect(screen.getByText("公众号文章")).toBeInTheDocument();
    expect(screen.getByText("小红书笔记")).toBeInTheDocument();
    expect(screen.getByText("Twitter")).toBeInTheDocument();
    expect(screen.getByText("视频脚本")).toBeInTheDocument();
  });
});
