import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { TaskGenerationTrace } from "@/lib/types";

const traceFixture: TaskGenerationTrace = {
  statusLabel: "已完成 5 / 5 步",
  methodLabel: "公众号结构化生成",
  providerLabel: "SiliconFlow · Pro/zai-org/GLM-4.7",
  steps: [
    {
      id: "parse",
      label: "解析创作需求",
      detail: "提取主题、受众和平台约束。",
      status: "completed"
    },
    {
      id: "rules",
      label: "应用技能与规则",
      detail: "加载 khazix-writer 的规则快照。",
      status: "completed"
    }
  ],
  skills: [
    {
      platform: "wechat",
      name: "khazix-writer",
      sourceRef: "C:/Users/koubinyue/.codex/skills/khazix-writer/SKILL.md",
      sourceType: "zip"
    }
  ],
  sources: [
    {
      id: "prompt",
      kind: "prompt",
      label: "用户需求",
      detail: "写一篇关于如何提高工作效率的内容"
    },
    {
      id: "search",
      kind: "external-search",
      label: "外部资料搜索",
      detail: "本次创作未调用外部资料搜索。"
    }
  ]
};

describe("WorkspaceShell", () => {
  it("shows task summary and switches active platform tabs", async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceShell
        initialBundle={{
          videoScript: { publishStatus: "idle", scenes: [], title: "视频脚本" },
          wechat: {
            body: "正文",
            publishStatus: "idle",
            summary: "摘要",
            title: "高效工作的 5 个底层逻辑"
          },
          xiaohongshu: {
            caption: "文案",
            hashtags: [],
            imageSuggestions: [],
            publishStatus: "idle",
            title: "效率翻倍"
          },
          twitter: {
            mode: "thread",
            publishStatus: "idle",
            tweets: ["1/10 test"]
          }
        }}
        initialHistory={[
          {
            id: "task-1",
            title: "高效工作的 5 个底层逻辑",
            updatedAt: "2026-04-08T00:00:00.000Z"
          }
        ]}
        initialTask={{
          id: "task-1",
          title: "高效工作的 5 个底层逻辑",
          userInput: "写一篇关于如何提高工作效率的内容",
          selectedPlatforms: ["wechat", "xiaohongshu", "twitter", "videoScript"],
          status: "ready",
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:00.000Z"
        }}
        initialTaskId="task-1"
        initialTrace={traceFixture}
      />
    );

    expect(screen.getAllByText("写一篇关于如何提高工作效率的内容")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "返回主页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("tab", { name: "公众号文章" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await user.click(screen.getByRole("tab", { name: "Twitter" }));
    expect(screen.getByRole("tab", { name: "Twitter" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("heading", { name: "Thread" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "小红书笔记" }));
    expect(screen.getByText("配图生成")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /小红书配图/ })).toHaveLength(9);
  });

  it("publishes wechat content through the publish modal", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/wechat/accounts" && init?.method === "POST") {
        return { /*
        message: "发布成功",
          */
          ok: true,
          json: async () => ({
            accounts: [
              { /*
                name: "测试公众号",
                */
                wechatAppid: "wx123456",
                username: "gh_abc123"
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
          videoScript: { publishStatus: "idle", scenes: [], title: "视频脚本" },
          wechat: {
            body: "正文",
            publishStatus: "idle",
            summary: "摘要",
            title: "高效工作的 5 个底层逻辑"
          },
          xiaohongshu: null,
          twitter: null
        }}
        initialHistory={[
          {
            id: "task-1",
            title: "高效工作的 5 个底层逻辑",
            updatedAt: "2026-04-08T00:00:00.000Z"
          }
        ]}
        initialTask={{
          id: "task-1",
          title: "高效工作的 5 个底层逻辑",
          userInput: "写一篇关于如何提高工作效率的内容",
          selectedPlatforms: ["wechat"],
          status: "ready",
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:00.000Z"
        }}
        initialTaskId="task-1"
        initialTrace={traceFixture}
      />
    );

    await user.click(screen.getByRole("button", { name: "发布到公众号" }));
    expect(await screen.findByText("选择发布公众号")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认发布" }));

    expect(await screen.findByText("成功保存到草稿箱")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/tasks/task-1/publish",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      })
    );

    const publishRequest = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const publishPayload = JSON.parse(String(publishRequest?.body ?? "{}"));
    expect(publishPayload).toEqual({
      articleType: "news",
      platform: "wechat",
      wechatAppid: "wx123456"
    });
  });

  it("adds the current wechat article to the content library from the workspace", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/library" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            item: {
              taskId: "task-1",
              title: "高效工作的 5 个底层逻辑",
              summary: "摘要"
            }
          })
        };
      }

      throw new Error(`Unexpected request: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <WorkspaceShell
        initialBundle={{
          videoScript: null,
          wechat: {
            body: "正文",
            publishStatus: "idle",
            summary: "摘要",
            title: "高效工作的 5 个底层逻辑"
          },
          xiaohongshu: null,
          twitter: null
        }}
        initialHistory={[]}
        initialIsInLibrary={false}
        initialTask={{
          id: "task-1",
          title: "高效工作的 5 个底层逻辑",
          userInput: "写一篇关于如何提高工作效率的内容",
          selectedPlatforms: ["wechat"],
          status: "ready",
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:00.000Z"
        }}
        initialTaskId="task-1"
        initialTrace={traceFixture}
      />
    );

    await user.click(screen.getByRole("button", { name: "加入内容库" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/library", {
      body: JSON.stringify({ taskId: "task-1" }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    expect(await screen.findByRole("button", { name: "已加入内容库" })).toBeDisabled();
  });

  it("regenerates the current task content from the workspace", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/tasks/task-1/regenerate" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            task: {
              id: "task-1",
              title: "重新生成后的标题",
              userInput: "写一篇关于如何提高工作效率的内容",
              selectedPlatforms: ["wechat"],
              status: "ready",
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-14T00:00:00.000Z"
            },
            bundle: {
              wechat: {
                body: "重新生成后的正文",
                publishStatus: "idle",
                summary: "重新生成后的摘要",
                title: "重新生成后的标题"
              },
              xiaohongshu: null,
              twitter: null,
              videoScript: null
            },
            trace: {
              ...traceFixture,
              statusLabel: "已完成 6 / 6 步",
              methodLabel: "重新生成"
            }
          })
        };
      }

      throw new Error(`Unexpected request: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <WorkspaceShell
        initialBundle={{
          videoScript: null,
          wechat: {
            body: "正文",
            publishStatus: "idle",
            summary: "摘要",
            title: "高效工作的 5 个底层逻辑"
          },
          xiaohongshu: null,
          twitter: null
        }}
        initialHistory={[
          {
            id: "task-1",
            title: "高效工作的 5 个底层逻辑",
            updatedAt: "2026-04-08T00:00:00.000Z"
          }
        ]}
        initialTask={{
          id: "task-1",
          title: "高效工作的 5 个底层逻辑",
          userInput: "写一篇关于如何提高工作效率的内容",
          selectedPlatforms: ["wechat"],
          status: "ready",
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:00.000Z"
        }}
        initialTaskId="task-1"
        initialTrace={traceFixture}
      />
    );

    await user.click(screen.getByRole("button", { name: "重新生成" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/task-1/regenerate", {
      body: JSON.stringify({ platform: "wechat" }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    expect(await screen.findByText("重新生成完成")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "重新生成后的标题" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("重新生成后的正文")).toBeInTheDocument();
    expect(
      screen.getByText("重新生成", {
        selector: ".generation-trace-panel__meta"
      })
    ).toBeInTheDocument();
  });

  it("passes the selected Twitter output mode when regenerating", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/tasks/task-twitter/regenerate" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            task: {
              id: "task-twitter",
              title: "Twitter draft",
              userInput: "写一条关于 AI 产品的推文",
              selectedPlatforms: ["twitter"],
              status: "ready",
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-14T00:00:00.000Z"
            },
            bundle: {
              wechat: null,
              xiaohongshu: null,
              twitter: {
                mode: "single",
                language: "中文",
                publishStatus: "idle",
                tweets: ["我觉得 AI 产品真正难的不是更聪明，而是别打断人的工作流。"]
              },
              videoScript: null
            },
            trace: traceFixture
          })
        };
      }

      throw new Error(`Unexpected request: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <WorkspaceShell
        initialBundle={{
          videoScript: null,
          wechat: null,
          xiaohongshu: null,
          twitter: {
            mode: "thread",
            language: "English",
            publishStatus: "idle",
            tweets: ["1/2 AI 产品开始从对话框走进工作流。", "2/2 这可能比模型分数更重要。"]
          }
        }}
        initialHistory={[
          {
            id: "task-twitter",
            title: "Twitter draft",
            updatedAt: "2026-04-08T00:00:00.000Z"
          }
        ]}
        initialTask={{
          id: "task-twitter",
          title: "Twitter draft",
          userInput: "写一条关于 AI 产品的推文",
          selectedPlatforms: ["twitter"],
          status: "ready",
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:00.000Z"
        }}
        initialTaskId="task-twitter"
        initialTrace={traceFixture}
      />
    );

    await user.click(screen.getByRole("button", { name: "Single" }));
    await user.clear(screen.getByLabelText("Twitter 生成语言"));
    await user.type(screen.getByLabelText("Twitter 生成语言"), "中文");
    await user.click(
      container.querySelector(".content-actions__button--regenerate") as HTMLButtonElement
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/task-twitter/regenerate", {
      body: JSON.stringify({
        platform: "twitter",
        twitterLanguage: "中文",
        twitterModePreference: "single"
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  });

  it("copies video scripts as a table instead of JSON", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    render(
      <WorkspaceShell
        initialBundle={{
          videoScript: {
            publishStatus: "idle",
            title: "视频脚本草稿",
            scenes: [
              {
                shot: "01",
                copy: "先抛出痛点",
                visual: "人物看着满屏待办",
                subtitle: "越忙越乱？",
                pace: "快节奏",
                audio: "轻快鼓点",
                effect: "字幕弹入"
              }
            ]
          },
          wechat: null,
          xiaohongshu: null,
          twitter: null
        }}
        initialHistory={[]}
        initialTask={{
          id: "task-video",
          title: "视频脚本草稿",
          userInput: "写一个短视频脚本",
          selectedPlatforms: ["videoScript"],
          status: "ready",
          createdAt: "2026-04-13T00:00:00.000Z",
          updatedAt: "2026-04-13T00:00:00.000Z"
        }}
        initialTaskId="task-video"
        initialTrace={traceFixture}
      />
    );

    await user.click(screen.getByRole("button", { name: "复制" }));

    expect(writeText).toHaveBeenCalledWith(
      [
        "视频脚本草稿",
        "",
        "镜号\t文案内容\t画面建议\t字幕重点\t节奏\t音效/音乐\t特效",
        "01\t先抛出痛点\t人物看着满屏待办\t越忙越乱？\t快节奏\t轻快鼓点\t字幕弹入"
      ].join("\n")
    );
    expect(screen.getByText("已复制表格到剪贴板")).toBeInTheDocument();
  });

  it("renders a collapsible creation trace with skills and source provenance", () => {
    render(
      <WorkspaceShell
        initialBundle={{
          videoScript: null,
          wechat: {
            body: "正文",
            publishStatus: "idle",
            summary: "摘要",
            title: "一篇文章"
          },
          xiaohongshu: null,
          twitter: null
        }}
        initialHistory={[]}
        initialTask={{
          id: "task-2",
          title: "一篇文章",
          userInput: "写一篇关于如何提高工作效率的内容",
          selectedPlatforms: ["wechat"],
          status: "ready",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z"
        }}
        initialTaskId="task-2"
        initialTrace={traceFixture}
      />
    );

    expect(screen.getByText("创作过程 / 溯源")).toBeInTheDocument();
    expect(screen.getByText("SiliconFlow · Pro/zai-org/GLM-4.7")).toBeInTheDocument();
    expect(screen.getByText("khazix-writer")).toBeInTheDocument();
    expect(screen.getByText("本次创作未调用外部资料搜索。")).toBeInTheDocument();
  });
});
