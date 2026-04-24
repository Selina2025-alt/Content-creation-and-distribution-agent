import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { WechatLibraryShell } from "@/components/library/wechat-library-shell";

describe("WechatLibraryShell", () => {
  it("renders wechat articles, workspace links, and recent actions", () => {
    render(
      <WechatLibraryShell
        items={[
          {
            taskId: "task-1",
            title: "高效工作的 5 个底层逻辑",
            summary: "从注意力、节奏、工具和复盘四个层面拆解高效工作。",
            publishStatus: "published",
            userInput: "写一篇关于提高工作效率的公众号文章",
            updatedAt: "2026-04-10T10:00:00.000Z"
          }
        ]}
        recentActions={[
          {
            id: "action-1",
            taskId: "task-1",
            actionType: "task_created",
            payload: {
              title: "高效工作的 5 个底层逻辑"
            },
            createdAt: "2026-04-10T10:00:00.000Z"
          },
          {
            id: "action-2",
            taskId: "task-1",
            actionType: "wechat_published",
            payload: {
              platform: "wechat"
            },
            createdAt: "2026-04-10T10:10:00.000Z"
          }
        ]}
      />
    );

    expect(
      screen.getByRole("heading", { name: "内容库" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "高效工作的 5 个底层逻辑" })
    ).toBeInTheDocument();
    expect(screen.getByText("已发布")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "打开工作台 高效工作的 5 个底层逻辑" })
    ).toHaveAttribute("href", "/workspace/task-1");
    expect(screen.getByText("任务已生成")).toBeInTheDocument();
    expect(screen.getByText("公众号模拟发布成功")).toBeInTheDocument();
  });

  it("filters articles by search keyword", async () => {
    const user = userEvent.setup();

    render(
      <WechatLibraryShell
        items={[
          {
            taskId: "task-1",
            title: "高效工作的 5 个底层逻辑",
            summary: "效率提升文章",
            publishStatus: "idle",
            userInput: "写效率文章",
            updatedAt: "2026-04-10T10:00:00.000Z"
          },
          {
            taskId: "task-2",
            title: "智能体行业观察",
            summary: "智能体专题文章",
            publishStatus: "idle",
            userInput: "写 AI 行业观察",
            updatedAt: "2026-04-10T11:00:00.000Z"
          }
        ]}
        recentActions={[]}
      />
    );

    await user.type(screen.getByLabelText("搜索内容库"), "智能体");

    expect(screen.queryByText("高效工作的 5 个底层逻辑")).not.toBeInTheDocument();
    expect(screen.getByText("智能体行业观察")).toBeInTheDocument();
  });
});
