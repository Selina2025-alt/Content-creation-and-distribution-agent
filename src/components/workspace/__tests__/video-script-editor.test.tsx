import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VideoScriptEditor } from "@/components/workspace/video-script-editor";
import type { PersistedVideoScriptContent } from "@/lib/types";

describe("VideoScriptEditor", () => {
  const value: PersistedVideoScriptContent = {
    title: "3 分钟短视频脚本",
    publishStatus: "idle",
    scenes: [
      {
        shot: "01",
        copy: "开场先抛出痛点：为什么越忙越没成果？",
        visual: "办公桌上弹出消息、待办堆叠，人物皱眉看屏幕。",
        subtitle: "越忙，越没成果？",
        pace: "快节奏开场，3 秒内制造冲突",
        audio: "轻微提示音叠加紧张鼓点",
        effect: "消息弹窗动效、画面轻微推近"
      }
    ]
  };

  it("renders video scenes as the required production table", () => {
    render(
      <VideoScriptEditor isEditing={false} onChange={vi.fn()} value={value} />
    );

    expect(screen.getByRole("columnheader", { name: "镜号" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "文案内容" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "画面建议" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "字幕重点" })
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "节奏" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "音效/音乐" })
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "特效" })).toBeInTheDocument();
    expect(screen.getByDisplayValue(value.scenes[0].copy)).toBeInTheDocument();
  });

  it("updates the script copy cell while editing", () => {
    const onChange = vi.fn();

    render(<VideoScriptEditor isEditing onChange={onChange} value={value} />);

    fireEvent.change(screen.getByLabelText("第 1 镜文案内容"), {
      target: { value: "新的镜头文案" }
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scenes: [
          expect.objectContaining({
            copy: "新的镜头文案"
          })
        ]
      })
    );
  });

  it("expands table cells to reveal long script content without inner scrolling", () => {
    render(
      <VideoScriptEditor
        isEditing={false}
        onChange={vi.fn()}
        value={{
          ...value,
          scenes: [
            {
              ...value.scenes[0],
              copy: "第一行脚本文案\n第二行脚本文案\n第三行脚本文案\n第四行脚本文案\n第五行脚本文案"
            }
          ]
        }}
      />
    );

    const copyCell = screen.getByLabelText("第 1 镜文案内容");

    expect(copyCell).toHaveAttribute("rows", "6");
    expect(copyCell).toHaveClass("video-script-table__textarea--expanded");
  });

  it("renders the storyboard as a wide table so the bottom scrollbar can remain", () => {
    render(
      <VideoScriptEditor isEditing={false} onChange={vi.fn()} value={value} />
    );

    expect(screen.getByRole("table")).toHaveClass("video-script-table--wide");
  });
});
