import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock
  })
}));

import HomePage from "@/app/page";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function getPromptInput() {
  const input = document.getElementById("creation-prompt");

  if (!(input instanceof HTMLTextAreaElement)) {
    throw new Error("creation-prompt textarea not found");
  }

  return input;
}

function getPlatformCheckbox(index: number) {
  const checkboxes = Array.from(
    document.querySelectorAll<HTMLInputElement>(".platform-card input[type='checkbox']")
  );
  const checkbox = checkboxes[index];

  if (!checkbox) {
    throw new Error(`platform checkbox at index ${index} not found`);
  }

  return checkbox;
}

function getGenerationToggle(index: number) {
  const toggles = Array.from(
    document.querySelectorAll<HTMLInputElement>(".research-toggle input[type='checkbox']")
  );
  const toggle = toggles[index];

  if (!toggle) {
    throw new Error(`generation toggle at index ${index} not found`);
  }

  return toggle;
}

function getSubmitButton() {
  const button = document.querySelector(".hero-submit");

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("hero submit button not found");
  }

  return button;
}

describe("HomePage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders creation entry, settings shortcuts, and draft/library sections", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/drafts") {
          return jsonResponse([]);
        }

        if (url === "/api/library") {
          return jsonResponse({
            items: [],
            recentActions: []
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "What should we create today?" })
    ).toBeInTheDocument();
    expect(getPromptInput()).toBeInTheDocument();
    expect(document.querySelectorAll(".platform-card input[type='checkbox']")).toHaveLength(4);
    expect(document.querySelectorAll(".research-toggle input[type='checkbox']")).toHaveLength(2);

    expect(await screen.findByRole("link", { name: "打开设置" })).toHaveAttribute(
      "href",
      "/settings"
    );
    expect(await screen.findAllByRole("link", { name: "打开内容库" })).not.toHaveLength(0);
    expect(await screen.findByText("需求草稿箱")).toBeInTheDocument();
    expect(await screen.findByText("内容库")).toBeInTheDocument();
  });

  it("creates task with xiaohongshu image generation disabled by default", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/drafts" && !init?.method) {
        return jsonResponse([]);
      }

      if (url === "/api/library" && !init?.method) {
        return jsonResponse({
          items: [],
          recentActions: []
        });
      }

      if (url === "/api/drafts" && init?.method === "POST") {
        return jsonResponse(
          {
            id: "draft-xhs",
            title: "XHS draft",
            prompt: "Write an AI learning Xiaohongshu note",
            selectedPlatforms: ["xiaohongshu"],
            status: "draft",
            lastGeneratedTaskId: null,
            createdAt: "2026-04-10T10:00:00.000Z",
            updatedAt: "2026-04-10T10:00:00.000Z"
          },
          201
        );
      }

      if (url === "/api/tasks" && init?.method === "POST") {
        return jsonResponse({ id: "task-xhs" }, 201);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<HomePage />);

    await act(async () => {
      fireEvent.change(getPromptInput(), {
        target: {
          value: "Write an AI learning Xiaohongshu note"
        }
      });
      fireEvent.click(getPlatformCheckbox(1));
      await vi.advanceTimersByTimeAsync(700);
    });

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            prompt: "Write an AI learning Xiaohongshu note",
            platforms: ["xiaohongshu"],
            sourceDraftId: "draft-xhs",
            enableWebSearch: false,
            enableXiaohongshuImageGeneration: false
          })
        })
      );
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/workspace/task-xhs");
    });
  });

  it("sends xiaohongshu image generation flag when user explicitly enables it", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/drafts" && !init?.method) {
        return jsonResponse([]);
      }

      if (url === "/api/library" && !init?.method) {
        return jsonResponse({
          items: [],
          recentActions: []
        });
      }

      if (url === "/api/drafts" && init?.method === "POST") {
        return jsonResponse(
          {
            id: "draft-xhs",
            title: "XHS draft",
            prompt: "Write an AI learning Xiaohongshu note",
            selectedPlatforms: ["xiaohongshu"],
            status: "draft",
            lastGeneratedTaskId: null,
            createdAt: "2026-04-10T10:00:00.000Z",
            updatedAt: "2026-04-10T10:00:00.000Z"
          },
          201
        );
      }

      if (url === "/api/tasks" && init?.method === "POST") {
        return jsonResponse({ id: "task-xhs-on" }, 201);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<HomePage />);

    await act(async () => {
      fireEvent.change(getPromptInput(), {
        target: {
          value: "Write an AI learning Xiaohongshu note"
        }
      });
      fireEvent.click(getPlatformCheckbox(1));
      fireEvent.click(getGenerationToggle(1));
      await vi.advanceTimersByTimeAsync(700);
    });

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            prompt: "Write an AI learning Xiaohongshu note",
            platforms: ["xiaohongshu"],
            sourceDraftId: "draft-xhs",
            enableWebSearch: false,
            enableXiaohongshuImageGeneration: true
          })
        })
      );
    });
  });
});
