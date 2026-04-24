// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GET as getTaskDetail,
  PATCH as patchTask,
  DELETE as deleteTaskRoute
} from "@/app/api/tasks/[taskId]/route";
import { POST as publishTask } from "@/app/api/tasks/[taskId]/publish/route";
import { POST as regenerateTask } from "@/app/api/tasks/[taskId]/regenerate/route";
import { GET, POST } from "@/app/api/tasks/route";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  createDraft,
  getDraftById
} from "@/lib/db/repositories/draft-repository";
import { listHistoryActions } from "@/lib/db/repositories/history-action-repository";
import { upsertPlatformSetting } from "@/lib/db/repositories/platform-settings-repository";
import {
  createSkill,
  saveSkillLearningResult
} from "@/lib/db/repositories/skill-repository";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "task-routes"
);

describe("task routes", () => {
  const originalApiKey = process.env.SILICONFLOW_API_KEY;
  const originalBaseUrl = process.env.SILICONFLOW_BASE_URL;
  const originalModel = process.env.SILICONFLOW_MODEL;
  const originalImageModel = process.env.SILICONFLOW_IMAGE_MODEL;
  const originalImageLimit = process.env.SILICONFLOW_IMAGE_LIMIT;

  beforeEach(() => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });
    migrateDatabase();
    vi.restoreAllMocks();
    delete process.env.SILICONFLOW_API_KEY;
    delete process.env.SILICONFLOW_BASE_URL;
    delete process.env.SILICONFLOW_MODEL;
    delete process.env.SILICONFLOW_IMAGE_MODEL;
    delete process.env.SILICONFLOW_IMAGE_LIMIT;
  });

  afterEach(() => {
    process.env.SILICONFLOW_API_KEY = originalApiKey;
    process.env.SILICONFLOW_BASE_URL = originalBaseUrl;
    process.env.SILICONFLOW_MODEL = originalModel;
    process.env.SILICONFLOW_IMAGE_MODEL = originalImageModel;
    process.env.SILICONFLOW_IMAGE_LIMIT = originalImageLimit;
  });

  it("creates a task, lists it, updates it, and returns persisted content", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于如何提高工作效率的内容",
          platforms: ["wechat", "xiaohongshu", "twitter", "videoScript"]
        })
      })
    );

    expect(createResponse.status).toBe(201);

    const created = (await createResponse.json()) as { id: string };
    const listResponse = await GET(new Request("http://localhost/api/tasks"));
    const tasks = (await listResponse.json()) as Array<{ id: string }>;

    expect(tasks.some((task) => task.id === created.id)).toBe(true);

    const detailResponse = await getTaskDetail(
      new Request(`http://localhost/api/tasks/${created.id}`),
      { params: Promise.resolve({ taskId: created.id }) }
    );
    const detail = (await detailResponse.json()) as {
      task: { id: string; title: string };
      bundle: { wechat: { title: string } };
    };

    expect(detail.task.id).toBe(created.id);
    expect(detail.bundle.wechat.title).toBe("高效工作的 5 个底层逻辑");

    const patchResponse = await patchTask(
      new Request(`http://localhost/api/tasks/${created.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: "效率专题任务"
        })
      }),
      { params: Promise.resolve({ taskId: created.id }) }
    );

    expect(patchResponse.status).toBe(200);
    expect((await patchResponse.json()).title).toBe("效率专题任务");
  });

  it("publishes supported content through the mock publisher and allows cleanup", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于如何提高工作效率的内容",
          platforms: ["wechat", "xiaohongshu", "twitter", "videoScript"]
        })
      })
    );
    const created = (await createResponse.json()) as { id: string };

    const response = await publishTask(
      new Request(`http://localhost/api/tasks/${created.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ platform: "wechat" })
      }),
      { params: Promise.resolve({ taskId: created.id }) }
    );

    expect(response.status).toBe(200);
    expect((await response.json()).message).toBe("发布成功");

    const detailResponse = await getTaskDetail(
      new Request(`http://localhost/api/tasks/${created.id}`),
      { params: Promise.resolve({ taskId: created.id }) }
    );
    const detail = (await detailResponse.json()) as {
      bundle: { wechat: { publishStatus: string } };
    };

    expect(detail.bundle.wechat.publishStatus).toBe("published");

    const deleteResponse = await deleteTaskRoute(
      new Request(`http://localhost/api/tasks/${created.id}`, {
        method: "DELETE"
      }),
      { params: Promise.resolve({ taskId: created.id }) }
    );

    expect(deleteResponse.status).toBe(200);
  });

  it("applies saved platform skills during generation", async () => {
    createSkill({
      id: "skill-1",
      name: "效率写作规则包",
      sourceType: "zip",
      sourceRef: ".codex-data/skills/uploads/skill-1.zip",
      summary: "帮助公众号生成更清晰的结构",
      status: "ready"
    });
    saveSkillLearningResult("skill-1", {
      summary: "帮助公众号生成更清晰的结构",
      rules: ["Prefer clear wechat structure"],
      platformHints: ["wechat"],
      keywords: ["wechat", "structure"],
      examplesSummary: ["skills/efficiency/SKILL.md"]
    });
    upsertPlatformSetting({
      platform: "wechat",
      baseRulesJson: JSON.stringify([]),
      enabledSkillIdsJson: JSON.stringify(["skill-1"])
    });

    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于提高工作效率的内容",
          platforms: ["wechat"]
        })
      })
    );

    expect(createResponse.status).toBe(201);

    const created = (await createResponse.json()) as { id: string };
    const detailResponse = await getTaskDetail(
      new Request(`http://localhost/api/tasks/${created.id}`),
      { params: Promise.resolve({ taskId: created.id }) }
    );
    const detail = (await detailResponse.json()) as {
      bundle: { wechat: { body: string; summary: string } };
      trace: {
        providerLabel: string;
        skills: Array<{ name: string; sourceRef: string }>;
        sources: Array<{ kind: string; detail: string }>;
      };
    };

    expect(detail.bundle.wechat.summary).toContain("效率写作规则包");
    expect(detail.bundle.wechat.body).toContain("效率写作规则包");
    expect(detail.trace.providerLabel).toBe("Prototype generation");
    expect(detail.trace.skills[0]).toMatchObject({
      name: "效率写作规则包",
      sourceRef: ".codex-data/skills/uploads/skill-1.zip"
    });
    expect(detail.trace.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "external-search",
          detail: "本次创作未调用外部资料搜索。"
        })
      ])
    );
  });

  it("records web search sources when research is enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => `
          <html>
            <a rel="nofollow" class="result-link" href="https://example.com/harness">Harness Engineering explained</a>
            <td class="result-snippet">Harness Engineering helps teams guide AI agents through complex delivery work.</td>
          </html>
        `
      }))
    );

    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于 Harness Engineering 的文章",
          platforms: ["wechat"],
          enableWebSearch: true
        })
      })
    );

    expect(createResponse.status).toBe(201);

    const created = (await createResponse.json()) as { id: string };
    const detailResponse = await getTaskDetail(
      new Request(`http://localhost/api/tasks/${created.id}`),
      { params: Promise.resolve({ taskId: created.id }) }
    );
    const detail = (await detailResponse.json()) as {
      trace: {
        steps: Array<{ id: string; label: string; detail: string }>;
        sources: Array<{ kind: string; label: string; detail: string; url?: string }>;
      };
    };

    expect(detail.trace.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "search",
          label: "联网检索资料"
        })
      ])
    );
    expect(detail.trace.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "external-search",
          label: "Harness Engineering explained",
          url: "https://example.com/harness",
          detail: expect.stringContaining("AI agents")
        })
      ])
    );
  });

  it("uses SiliconFlow for wechat and Twitter generation when config is available", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "zai-org/GLM-5";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "真实生成的公众号标题",
                  summary: "这是一段来自真实模型返回的公众号摘要。",
                  body: "## 开场\n\n这是一篇通过 SiliconFlow 生成的公众号正文。"
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  mode: "thread",
                  language: "English",
                  tweets: [
                    "1/2 Agents get interesting when they stop being demos and start fitting into actual workflows.",
                    "2/2 The useful version is not louder automation. It is humans setting direction while agents execute, remember, and report back."
                  ]
                })
              }
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于智能体发展的文章",
          platforms: ["wechat", "twitter"]
        })
      })
    );

    expect(createResponse.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const created = (await createResponse.json()) as { id: string };
    const detailResponse = await getTaskDetail(
      new Request(`http://localhost/api/tasks/${created.id}`),
      { params: Promise.resolve({ taskId: created.id }) }
    );
    const detail = (await detailResponse.json()) as {
      bundle: {
        wechat: { title: string; body: string };
        twitter: { tweets: string[] } | null;
      };
    };

    expect(detail.bundle.wechat.title).toBe("真实生成的公众号标题");
    expect(detail.bundle.wechat.body).toContain("SiliconFlow");
    expect(detail.bundle.twitter?.tweets).toEqual([
      "1/2 Agents get interesting when they stop being demos and start fitting into actual workflows.",
      "2/2 The useful version is not louder automation. It is humans setting direction while agents execute, remember, and report back."
    ]);
  });

  it("uses SiliconFlow for video script generation when config is available", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "真实生成的视频脚本",
                scenes: [
                  {
                    shot: "01",
                    copy: "先用一句话提出冲突。",
                    visual: "人物坐在电脑前，屏幕上出现大量待办。",
                    subtitle: "你不是不努力，是系统不对。",
                    pace: "快节奏开场",
                    audio: "轻快鼓点",
                    effect: "字幕弹入"
                  }
                ]
              })
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一个关于提高工作效率的 3 分钟短视频脚本",
          platforms: ["videoScript"]
        })
      })
    );

    expect(createResponse.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const created = (await createResponse.json()) as { id: string };
    const detailResponse = await getTaskDetail(
      new Request(`http://localhost/api/tasks/${created.id}`),
      { params: Promise.resolve({ taskId: created.id }) }
    );
    const detail = (await detailResponse.json()) as {
      bundle: {
        videoScript: {
          title: string;
          scenes: Array<{ copy: string; audio: string; effect: string }>;
        };
      };
    };

    expect(detail.bundle.videoScript.title).toBe("真实生成的视频脚本");
    expect(detail.bundle.videoScript.scenes[0]).toMatchObject({
      copy: "先用一句话提出冲突。",
      audio: "轻快鼓点",
      effect: "字幕弹入"
    });
  });

  it("uses SiliconFlow for Xiaohongshu note generation when config is available", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "真实生成的小红书标题",
                caption: "模型生成的小红书正文，包含痛点、方法、互动引导。",
                imageSuggestions: Array.from({ length: 9 }, (_, index) => `第 ${index + 1} 张图：真实配图提示`),
                hashtags: ["AI学习", "效率提升"]
              })
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于如何学习 AI 的小红书笔记",
          platforms: ["xiaohongshu"]
        })
      })
    );

    expect(createResponse.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const created = (await createResponse.json()) as { id: string };
    const detailResponse = await getTaskDetail(
      new Request(`http://localhost/api/tasks/${created.id}`),
      { params: Promise.resolve({ taskId: created.id }) }
    );
    const detail = (await detailResponse.json()) as {
      bundle: {
        xiaohongshu: {
          title: string;
          imageAssets: Array<{ src: string }>;
        };
      };
    };

    expect(detail.bundle.xiaohongshu.title).toBe("真实生成的小红书标题");
    expect(detail.bundle.xiaohongshu.imageAssets).toHaveLength(9);
  });
  it("marks a source draft as generated and stores a task_created action", async () => {
    createDraft({
      id: "draft-1",
      title: "智能体草稿",
      prompt: "写一篇关于智能体发展的文章",
      selectedPlatforms: ["wechat"],
      status: "draft"
    });

    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于智能体发展的文章",
          platforms: ["wechat"],
          sourceDraftId: "draft-1"
        })
      })
    );

    expect(createResponse.status).toBe(201);

    const createdTask = (await createResponse.json()) as { id: string };

    expect(getDraftById("draft-1")).toMatchObject({
      id: "draft-1",
      status: "generated",
      lastGeneratedTaskId: createdTask.id
    });
    expect(listHistoryActions()[0]).toMatchObject({
      taskId: createdTask.id,
      actionType: "task_created"
    });
  });

  it("stores a publish action after mock publishing", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于提高工作效率的内容",
          platforms: ["wechat"]
        })
      })
    );

    const created = (await createResponse.json()) as { id: string };

    const response = await publishTask(
      new Request(`http://localhost/api/tasks/${created.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ platform: "wechat" })
      }),
      { params: Promise.resolve({ taskId: created.id }) }
    );

    expect(response.status).toBe(200);
    expect(listHistoryActions()[0]).toMatchObject({
      taskId: created.id,
      actionType: "wechat_published"
    });
  });

  it("regenerates an existing task and replaces its persisted bundle", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于普通人如何使用 AI 的文章",
          platforms: ["wechat"]
        })
      })
    );
    const created = (await createResponse.json()) as { id: string };

    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "重新生成的公众号文章",
                  summary: "重新生成后的摘要。",
                  body: "重新生成后的正文。"
                })
              }
            }
          ]
        })
      })
    );

    const response = await regenerateTask(
      new Request(`http://localhost/api/tasks/${created.id}/regenerate`, {
        method: "POST"
      }),
      { params: Promise.resolve({ taskId: created.id }) }
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      task: { title: string };
      bundle: { wechat: { title: string; body: string } };
      trace: { methodLabel: string };
    };

    expect(payload.task.title).toBe("重新生成的公众号文章");
    expect(payload.bundle.wechat).toMatchObject({
      title: "重新生成的公众号文章",
      body: "重新生成后的正文。",
      publishStatus: "idle"
    });
    expect(payload.trace.methodLabel).toBe("公众号结构化生成");
    expect(listHistoryActions()[0]).toMatchObject({
      taskId: created.id,
      actionType: "task_regenerated"
    });
  });

  it("regenerates only the requested platform and keeps the other platform content unchanged", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "写一篇关于 AI 产品工作流的内容",
          platforms: ["wechat", "twitter"]
        })
      })
    );
    const created = (await createResponse.json()) as {
      id: string;
      title: string;
      bundle: {
        wechat: { title: string; body: string };
        twitter: { tweets: string[] };
      };
    };

    process.env.SILICONFLOW_API_KEY = "test-api-key";
    process.env.SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
    process.env.SILICONFLOW_MODEL = "Pro/zai-org/GLM-4.7";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                mode: "single",
                tweets: ["Maybe the real AI product question is where it fits into the messy workflow people already have."]
              })
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await regenerateTask(
      new Request(`http://localhost/api/tasks/${created.id}/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          platform: "twitter",
          twitterLanguage: "English",
          twitterModePreference: "single"
        })
      }),
      { params: Promise.resolve({ taskId: created.id }) }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const payload = (await response.json()) as {
      task: { title: string };
      bundle: {
        wechat: { title: string; body: string };
        twitter: { mode: string; language: string; tweets: string[] };
      };
      trace: { skills: Array<{ platform: string }>; methodLabel: string };
    };

    expect(payload.task.title).toBe(created.title);
    expect(payload.bundle.wechat).toMatchObject(created.bundle.wechat);
    expect(payload.bundle.twitter).toMatchObject({
      mode: "single",
      language: "English",
      tweets: [
        "Maybe the real AI product question is where it fits into the messy workflow people already have."
      ]
    });
    expect(payload.trace.skills.every((skill) => skill.platform === "twitter")).toBe(true);
    expect(listHistoryActions()[0].payload).toMatchObject({
      platforms: ["twitter"],
      targetPlatform: "twitter",
      twitterLanguage: "English",
      twitterModePreference: "single"
    });
  });
});
