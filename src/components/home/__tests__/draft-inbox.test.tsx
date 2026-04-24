import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DraftInbox } from "@/components/home/draft-inbox";
import type { DraftRecord } from "@/lib/types";

const generatedDraft: DraftRecord = {
  id: "draft-1",
  title: "写一篇关于 Harness Engineering",
  prompt: "写一篇关于 Harness Engineering 的文章，要有深度。",
  selectedPlatforms: ["wechat"],
  status: "generated",
  lastGeneratedTaskId: "task-1",
  createdAt: "2026-04-10T10:00:00.000Z",
  updatedAt: "2026-04-10T10:00:00.000Z"
};

describe("DraftInbox", () => {
  it("shows an add-to-library action for generated drafts that are not archived yet", async () => {
    const user = userEvent.setup();
    const addToLibrary = vi.fn();

    render(
      <DraftInbox
        activeDraftId={null}
        drafts={[generatedDraft]}
        isLoading={false}
        libraryTaskIds={[]}
        onAddToLibrary={addToLibrary}
        onContinueDraft={vi.fn()}
        onCreateDraft={vi.fn()}
        onDeleteDraft={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "加入内容库 写一篇关于 Harness Engineering" }));

    expect(addToLibrary).toHaveBeenCalledWith(generatedDraft);
  });

  it("renders an archived state once the draft's generated article is already in the library", () => {
    render(
      <DraftInbox
        activeDraftId={null}
        drafts={[generatedDraft]}
        isLoading={false}
        libraryTaskIds={["task-1"]}
        onAddToLibrary={vi.fn()}
        onContinueDraft={vi.fn()}
        onCreateDraft={vi.fn()}
        onDeleteDraft={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "已加入内容库" })).toBeDisabled();
  });
});
