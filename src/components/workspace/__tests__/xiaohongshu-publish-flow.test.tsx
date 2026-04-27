import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { TaskGenerationTrace } from "@/lib/types";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,test-qr")
  }
}));

const traceFixture: TaskGenerationTrace = {
  statusLabel: "done",
  methodLabel: "structured generation",
  providerLabel: "prototype",
  steps: [
    {
      id: "parse",
      label: "parse request",
      detail: "extract intent",
      status: "completed"
    }
  ],
  skills: [],
  sources: []
};

function createWorkspace() {
  return (
    <WorkspaceShell
      initialBundle={{
        wechat: null,
        xiaohongshu: {
          title: "小红书测试标题",
          caption: "小红书测试正文",
          imageSuggestions: ["封面图"],
          imageAssets: [
            {
              id: "img-1",
              title: "封面",
              prompt: "封面提示词",
              alt: "封面",
              src: "https://cdn.example.com/cover.png",
              originalSrc: "https://cdn.example.com/cover.png",
              provider: "siliconflow"
            }
          ],
          hashtags: ["效率"],
          publishStatus: "idle"
        },
        twitter: null,
        videoScript: null
      }}
      initialHistory={[
        {
          id: "task-1",
          title: "小红书测试标题",
          updatedAt: "2026-04-22T00:00:00.000Z"
        }
      ]}
      initialTask={{
        id: "task-1",
        title: "小红书测试标题",
        userInput: "写一篇效率提升的小红书笔记",
        selectedPlatforms: ["xiaohongshu"],
        status: "ready",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z"
      }}
      initialTaskId="task-1"
      initialTrace={traceFixture}
    />
  );
}

function clickPublishButton(user: ReturnType<typeof userEvent.setup>) {
  const publishButton = document.querySelector<HTMLButtonElement>(
    ".content-actions__publish"
  );
  expect(publishButton).not.toBeNull();
  return user.click(publishButton!);
}

describe("xiaohongshu publish flow", () => {
  it("shows pre-publish confirm modal and then opens QR modal", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/tasks/task-1/publish" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            message: "发布请求已创建，请扫码继续",
            noteId: "note-id-1",
            publishUrl: "https://note.example.com/publish?token=123",
            qrImageUrl: "https://note.example.com/qr.png",
            status: "published"
          })
        };
      }

      throw new Error(`Unexpected request: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    render(createWorkspace());

    await clickPublishButton(user);

    expect(
      await screen.findByRole("heading", { name: "确认创建小红书发布链接" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认创建链接" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/task-1/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        platform: "xiaohongshu"
      })
    });

    expect(
      await screen.findByRole("heading", { name: "扫码继续发布到小红书" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("发布链接已创建，请扫码后在手机端选择账号继续发布")
    ).toBeInTheDocument();
  });

  it("keeps expired-image quick fix working after publish confirm", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/tasks/task-1/publish" && init?.method === "POST") {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            code: "XIAOHONGSHU_IMAGE_EXPIRED",
            message:
              "封面/配图链接已过期（过期时间：2026-04-21 19:20:06，当前：2026-04-22 15:02:11）。请一键重新生成配图后再发布。"
          })
        };
      }

      if (
        String(input) === "/api/tasks/task-1/xiaohongshu-images/img-1/retry" &&
        init?.method === "POST"
      ) {
        return {
          ok: true,
          json: async () => ({
            content: {
              title: "小红书测试标题",
              caption: "小红书测试正文",
              imageSuggestions: ["封面图"],
              imageAssets: [
                {
                  id: "img-1",
                  title: "封面",
                  prompt: "封面提示词",
                  alt: "封面",
                  src: "https://cdn.example.com/cover-refreshed.png",
                  originalSrc: "https://cdn.example.com/cover-refreshed.png",
                  provider: "siliconflow"
                }
              ],
              hashtags: ["效率"],
              publishStatus: "idle"
            }
          })
        };
      }

      throw new Error(`Unexpected request: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    render(createWorkspace());

    await clickPublishButton(user);
    await user.click(screen.getByRole("button", { name: "确认创建链接" }));

    expect(
      await screen.findByText(
        "封面/配图链接已过期（过期时间：2026-04-21 19:20:06，当前：2026-04-22 15:02:11）。请一键重新生成配图后再发布。"
      )
    ).toBeInTheDocument();

    const quickFixButton = document.querySelector<HTMLButtonElement>(
      ".content-actions__button--quick-fix"
    );
    expect(quickFixButton).not.toBeNull();
    await user.click(quickFixButton!);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks/task-1/xiaohongshu-images/img-1/retry",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
