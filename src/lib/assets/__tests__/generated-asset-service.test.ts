// @vitest-environment node

import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { persistGeneratedImage } from "@/lib/assets/generated-asset-service";

const originalDataRoot = process.env.CONTENT_CREATION_AGENT_DATA_ROOT;

describe("generated asset service", () => {
  const dataRoot = path.join(process.cwd(), ".codex-data-tests", "generated-assets");

  beforeEach(() => {
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = dataRoot;
    rmSync(dataRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    process.env.CONTENT_CREATION_AGENT_DATA_ROOT = originalDataRoot;
    rmSync(dataRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("downloads a remote generated image and returns a local asset URL", async () => {
    const imageBytes = Buffer.from("fake-png-bytes");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "image/png" : null)
      },
      arrayBuffer: async () => imageBytes.buffer.slice(
        imageBytes.byteOffset,
        imageBytes.byteOffset + imageBytes.byteLength
      )
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await persistGeneratedImage({
      src: "https://cdn.example.com/xhs-card.png",
      platform: "xiaohongshu",
      assetId: "image-1"
    });

    expect(result.src).toMatch(/^\/api\/assets\/xiaohongshu\/image-1-[a-f0-9-]+\.png$/);
    expect(result.originalSrc).toBe("https://cdn.example.com/xhs-card.png");
    expect(existsSync(result.filePath)).toBe(true);
    expect(readFileSync(result.filePath).toString()).toBe("fake-png-bytes");
  });

  it("persists base64 image data without refetching it", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const result = await persistGeneratedImage({
      src: `data:image/png;base64,${Buffer.from("inline-png").toString("base64")}`,
      platform: "xiaohongshu",
      assetId: "image-2"
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.src).toMatch(/^\/api\/assets\/xiaohongshu\/image-2-[a-f0-9-]+\.png$/);
    expect(readFileSync(result.filePath).toString()).toBe("inline-png");
  });
});
