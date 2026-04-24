import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HistorySidebar } from "@/components/workspace/history-sidebar";

describe("HistorySidebar", () => {
  it("filters, renames, and deletes tasks", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onDelete = vi.fn();

    render(
      <HistorySidebar
        activeTaskId="task-1"
        items={[
          {
            id: "task-1",
            title: "效率文章",
            updatedAt: "2026-04-08T00:00:00.000Z"
          },
          {
            id: "task-2",
            title: "增长 thread",
            updatedAt: "2026-04-07T00:00:00.000Z"
          }
        ]}
        onDelete={onDelete}
        onRename={onRename}
        onSelect={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("搜索历史记录"), "效率");

    expect(screen.getByText("效率文章")).toBeInTheDocument();
    expect(screen.queryByText("增长 thread")).toBeNull();

    await user.click(screen.getByRole("button", { name: "重命名 效率文章" }));
    await user.clear(screen.getByDisplayValue("效率文章"));
    await user.type(screen.getByRole("textbox", { name: "重命名任务" }), "效率专题");
    await user.click(screen.getByRole("button", { name: "保存标题" }));

    expect(onRename).toHaveBeenCalledWith("task-1", "效率专题");

    await user.click(screen.getByRole("button", { name: "删除 效率文章" }));
    expect(onDelete).toHaveBeenCalledWith("task-1");
  });
});
