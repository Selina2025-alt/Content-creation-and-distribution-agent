import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeLibraryPreview } from "@/components/home/home-library-preview";

describe("HomeLibraryPreview", () => {
  it("renders title and summary previews that link to the full article detail", () => {
    render(
      <HomeLibraryPreview
        items={[
          {
            taskId: "task-1",
            title: "高效工作的 5 个底层逻辑",
            summary: "从注意力、节奏、工具和复盘四个层面拆解高效工作。",
            publishStatus: "idle",
            userInput: "写一篇关于如何提高工作效率的内容",
            updatedAt: "2026-04-10T10:00:00.000Z"
          }
        ]}
      />
    );

    expect(
      screen.getByRole("link", { name: "查看文章 高效工作的 5 个底层逻辑" })
    ).toHaveAttribute("href", "/library/task-1");
    expect(
      screen.getByText("从注意力、节奏、工具和复盘四个层面拆解高效工作。")
    ).toBeInTheDocument();
    expect(screen.queryByText("这里是正文。")).not.toBeInTheDocument();
  });
});
