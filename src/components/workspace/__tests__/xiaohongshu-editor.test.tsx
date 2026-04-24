import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { XiaohongshuEditor } from "@/components/workspace/xiaohongshu-editor";
import type { PersistedXiaohongshuContent } from "@/lib/types";

describe("XiaohongshuEditor", () => {
  const value: PersistedXiaohongshuContent = {
    title: "工作效率翻倍！我的 5 个神仙方法✨",
    caption: "这是一段完整的小红书正文文案。",
    imageSuggestions: Array.from({ length: 9 }, (_, index) => `图片 ${index + 1}：办公效率场景`),
    imagePlan: {
      mode: "Series Mode",
      decision: "决策：Series Mode（Series Mode）",
      images: Array.from({ length: 9 }, (_, index) => ({
        id: `image-${index + 1}`,
        title: `图 ${index + 1}`,
        type: index === 0 ? 5 : 1,
        typeName: index === 0 ? "综合框架/体系类" : "流程/步骤类",
        size: index === 0 ? "landscape" : "portrait",
        colorScheme: "warm",
        prompt: `Series ${index + 1} of 9 手绘风格配图提示`
      }))
    },
    hashtags: ["效率提升", "自我管理"],
    publishStatus: "idle"
  };

  const siliconflowValue: PersistedXiaohongshuContent = {
    ...value,
    imageAssets: value.imagePlan!.images.map((image, index) => ({
      id: `xhs-image-${index + 1}`,
      title: image.title,
      prompt: image.prompt,
      alt: `小红书配图 ${index + 1}`,
      src: `/api/assets/xiaohongshu/xhs-image-${index + 1}.png`,
      originalSrc: `https://example.com/xhs-image-${index + 1}.png`,
      provider: "siliconflow",
      status: "ready",
      type: image.type,
      typeName: image.typeName,
      size: image.size,
      colorScheme: image.colorScheme
    }))
  };

  it("shows copywriting and nine generated visual cards instead of plain placeholders", () => {
    render(<XiaohongshuEditor isEditing={false} onChange={vi.fn()} value={value} />);

    expect(screen.getByLabelText("文案")).toHaveValue(value.caption);
    expect(screen.getAllByRole("img", { name: /小红书配图/ })).toHaveLength(9);
    expect(screen.getByText("配图生成")).toBeInTheDocument();
    expect(screen.getByText("图片状态：9 已就绪 / 0 失败")).toBeInTheDocument();
    expect(screen.getByText("分图策略")).toBeInTheDocument();
    expect(screen.getByText("Series Mode")).toBeInTheDocument();
    expect(screen.getByText("类型5 · 综合框架/体系类")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /小红书配图/ })[0]).toHaveClass(
      "xiaohongshu-image-card__visual"
    );
  });

  it("regenerates a visual card when an image prompt is edited", () => {
    const onChange = vi.fn();

    render(<XiaohongshuEditor isEditing onChange={onChange} value={value} />);

    fireEvent.change(screen.getByLabelText("第 1 张配图提示词"), {
      target: { value: "封面：极简办公桌和醒目标题" }
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        imageSuggestions: expect.arrayContaining(["封面：极简办公桌和醒目标题"]),
        imageAssets: expect.arrayContaining([
          expect.objectContaining({
            prompt: expect.stringContaining("封面：极简办公桌和醒目标题"),
            src: expect.stringMatching(/^data:image\/svg\+xml;charset=utf-8,/)
          })
        ]),
        imagePlan: expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({
              prompt: expect.stringContaining("Series 1 of 9")
            })
          ])
        })
      })
    );
  });

  it("shows failed image state and retries a single image", async () => {
    const onChange = vi.fn();
    const failedValue: PersistedXiaohongshuContent = {
      ...value,
      imageAssets: value.imagePlan!.images.map((image, index) => ({
        id: `xhs-image-${index + 1}`,
        title: image.title,
        prompt: image.prompt,
        alt: `小红书配图 ${index + 1}`,
        src: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E",
        provider: "local-svg",
        status: index === 0 ? "failed" : "ready",
        errorMessage: index === 0 ? "图片生成失败" : undefined,
        type: image.type,
        typeName: image.typeName,
        size: image.size,
        colorScheme: image.colorScheme
      }))
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: {
          ...failedValue,
          imageAssets: failedValue.imageAssets?.map((asset, index) =>
            index === 0
              ? {
                  ...asset,
                  src: "/api/assets/xiaohongshu/xhs-image-1.png",
                  provider: "siliconflow",
                  status: "ready",
                  errorMessage: undefined
                }
              : asset
          )
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <XiaohongshuEditor
        isEditing={false}
        onChange={onChange}
        taskId="task-1"
        value={failedValue}
      />
    );

    expect(screen.getByText("图片状态：8 已就绪 / 1 失败")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新生成图 1" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tasks/task-1/xiaohongshu-images/xhs-image-1/retry",
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          imageAssets: expect.arrayContaining([
            expect.objectContaining({
              id: "xhs-image-1",
              provider: "siliconflow",
              status: "ready",
              src: "/api/assets/xiaohongshu/xhs-image-1.png"
            })
          ])
        })
      );
    });
  });

  it("opens generated cards in a large preview and exposes save actions", () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchorClicks = vi.fn();

    render(<XiaohongshuEditor isEditing={false} onChange={vi.fn()} value={value} />);

    expect(
      screen.getByRole("button", { name: "批量保存 9 张配图" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^保存图/ })).toHaveLength(9);

    fireEvent.click(screen.getByRole("button", { name: "放大查看图 1" }));

    expect(screen.getByRole("dialog", { name: "图 1" })).toBeInTheDocument();
    expect(screen.getByText("可右键复制图片，或使用保存按钮下载。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "保存这张图" })).toHaveAttribute(
      "download",
      "xiaohongshu-image-1.svg"
    );

    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);

      if (tagName.toLowerCase() === "a") {
        Object.defineProperty(element, "click", {
          configurable: true,
          value: anchorClicks
        });
      }

      return element;
    });

    fireEvent.click(screen.getByRole("button", { name: "批量保存 9 张配图" }));

    expect(anchorClicks).toHaveBeenCalledTimes(9);
  });

  it("only marks an image as saved after the user clicks save", () => {
    render(
      <XiaohongshuEditor
        isEditing={false}
        onChange={vi.fn()}
        value={siliconflowValue}
      />
    );

    expect(screen.queryByText("已保存")).not.toBeInTheDocument();
    expect(screen.getAllByText("已生成")).toHaveLength(9);

    const saveLink = screen.getByRole("link", { name: "保存图 1" });
    saveLink.addEventListener("click", (event) => event.preventDefault());

    fireEvent.click(saveLink);

    expect(screen.getByText("已保存")).toBeInTheDocument();
    expect(screen.getAllByText("已生成")).toHaveLength(8);
  });
});
