import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { TaskGenerationTrace } from "@/lib/types";

const traceFixture: TaskGenerationTrace = {
  statusLabel: "已完成 5 / 5 步",
  methodLabel: "结构化生成",
  providerLabel: "Prototype generation",
  steps: [
    {
      id: "parse",
      label: "解析需求",
      detail: "提取主题与受众",
      status: "completed"
    }
  ],
  skills: [],
  sources: []
};

describe("wechat publish flow", () => {
  it("opens wechat publish modal and submits selected account/type", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/wechat/accounts" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            accounts: [
              {
                name: "测试公众号",
                wechatAppid: "wx123456",
                username: "gh_test"
              }
            ],
            total: 1
          })
        };
      }

      if (String(input) === "/api/tasks/task-1/publish" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            message: "发布成功",
            status: "published"
          })
        };
      }

      throw new Error(`Unexpected request: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <WorkspaceShell
        initialBundle={{
          wechat: {
            title: "高效工作的 5 个底层逻辑",
            summary: "摘要",
            body: "正文",
            publishStatus: "idle"
          },
          xiaohongshu: null,
          twitter: null,
          videoScript: null
        }}
        initialHistory={[
          {
            id: "task-1",
            title: "高效工作的 5 个底层逻辑",
            updatedAt: "2026-04-20T00:00:00.000Z"
          }
        ]}
        initialTask={{
          id: "task-1",
          title: "高效工作的 5 个底层逻辑",
          userInput: "写一篇关于如何提高工作效率的内容",
          selectedPlatforms: ["wechat"],
          status: "ready",
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:00.000Z"
        }}
        initialTaskId="task-1"
        initialTrace={traceFixture}
      />
    );

    await user.click(screen.getByRole("button", { name: "发布到公众号" }));
    expect(await screen.findByText("选择发布公众号")).toBeInTheDocument();

    await user.click(screen.getByLabelText("小绿书（图文）"));
    await user.click(screen.getByRole("button", { name: "确认发布" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/task-1/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        platform: "wechat",
        wechatAppid: "wx123456",
        articleType: "newspic"
      })
    });
    expect(await screen.findByText("发布成功")).toBeInTheDocument();
  });
});
