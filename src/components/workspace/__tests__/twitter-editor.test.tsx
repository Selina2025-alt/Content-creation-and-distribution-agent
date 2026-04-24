import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TwitterEditor } from "@/components/workspace/twitter-editor";
import type { PersistedTwitterContent } from "@/lib/types";

function TwitterEditorHarness() {
  const [value, setValue] = useState<PersistedTwitterContent>({
    mode: "thread",
    publishStatus: "idle",
    tweets: [
      "1/3 最近看 AI 产品，有个很明显的变化：大家不再只问模型聪不聪明，而是开始问它能不能真的接进工作流。",
      "2/3 这听起来小，但其实是分水岭。一个工具如果只能待在对话框里，很多时候只是灵感玩具。"
    ]
  });

  return <TwitterEditor isEditing onChange={setValue} value={value} />;
}

function LongTweetHarness() {
  const [value, setValue] = useState<PersistedTwitterContent>({
    mode: "thread",
    publishStatus: "idle",
    tweets: [
      `1/2 ${"This is a deliberately long thread segment that should remain editable instead of being cut off with an ellipsis. ".repeat(3)}`,
      `2/2 ${"The second segment keeps enough detail to push the merged single tweet over the limit and expose silent truncation. ".repeat(2)}`
    ]
  });

  return <TwitterEditor isEditing onChange={setValue} value={value} />;
}

describe("TwitterEditor", () => {
  it("makes output mode changes visible in the editor shape", async () => {
    const user = userEvent.setup();

    render(<TwitterEditorHarness />);

    expect(screen.getByRole("heading", { name: "Thread" })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Tweet/)).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Single" }));

    expect(screen.getByRole("heading", { name: "Single Tweet" })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Tweet/)).toHaveLength(1);
    const singleTweetValue = (screen.getByLabelText("Tweet 1") as HTMLTextAreaElement)
      .value;

    expect(singleTweetValue).toContain("最近看 AI 产品");
    expect(singleTweetValue).not.toContain("1/3");
    expect(
      screen.getByText(/下一次重新生成会强制输出一条推文/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thread" }));

    expect(screen.getByRole("heading", { name: "Thread" })).toBeInTheDocument();
    expect(screen.getByText(/下一次重新生成会强制输出 Thread/)).toBeInTheDocument();
  });

  it("lets the user choose a Twitter generation language and defaults to English", async () => {
    const user = userEvent.setup();

    render(<TwitterEditorHarness />);

    const languageInput = screen.getByLabelText("Twitter 生成语言") as HTMLInputElement;

    expect(languageInput.value).toBe("English");

    await user.clear(languageInput);
    await user.type(languageInput, "中文");

    expect(languageInput.value).toBe("中文");
    expect(screen.getByText("不填写时默认 English。")).toBeInTheDocument();
  });

  it("surfaces language guard and character count for the current draft", () => {
    render(<TwitterEditorHarness />);

    expect(
      screen.getByText("当前草稿含中文，重新生成时会自动修正为 English。")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/\/ 280/)).toHaveLength(2);
    expect(screen.getByText("语言守卫")).toBeInTheDocument();
  });

  it("keeps over-limit drafts editable instead of silently truncating them", async () => {
    const user = userEvent.setup();

    render(<LongTweetHarness />);

    await user.click(screen.getByRole("button", { name: "Single" }));

    const singleTweetValue = (screen.getByLabelText("Tweet 1") as HTMLTextAreaElement)
      .value;

    expect(singleTweetValue.length).toBeGreaterThan(280);
    expect(singleTweetValue).toContain("The second segment keeps enough detail");
    expect(singleTweetValue).not.toMatch(/\.\.\.$/u);
    expect(screen.getByText("字符预算")).toBeInTheDocument();
  });
});
