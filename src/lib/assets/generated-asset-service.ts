import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  ensureAppDirectories,
  getGeneratedAssetFilePath
} from "@/lib/fs/app-paths";
import type { PlatformId } from "@/lib/types";

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function parseDataImage(src: string) {
  const match = src.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);

  if (!match) {
    return null;
  }

  return {
    contentType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64")
  };
}

function sanitizeAssetId(assetId: string) {
  return assetId.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48) || "asset";
}

function buildLocalAsset(
  platform: PlatformId,
  assetId: string,
  extension: string,
  buffer: Buffer,
  originalSrc: string
) {
  ensureAppDirectories();

  const fileName = `${sanitizeAssetId(assetId)}-${randomUUID()}.${extension}`;
  const relativePath = [platform, fileName];
  const filePath = getGeneratedAssetFilePath(relativePath);

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, buffer);

  return {
    src: `/api/assets/${relativePath.map(encodeURIComponent).join("/")}`,
    originalSrc,
    filePath
  };
}

export async function persistGeneratedImage(input: {
  src: string;
  platform: PlatformId;
  assetId: string;
}) {
  if (input.src.startsWith("/api/assets/")) {
    return {
      src: input.src,
      originalSrc: input.src,
      filePath: ""
    };
  }

  const dataImage = parseDataImage(input.src);

  if (dataImage) {
    return buildLocalAsset(
      input.platform,
      input.assetId,
      IMAGE_CONTENT_TYPES[dataImage.contentType] ?? "png",
      dataImage.buffer,
      input.src
    );
  }

  const response = await fetch(input.src);

  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.status}`);
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ??
    "image/png";
  const extension = IMAGE_CONTENT_TYPES[contentType] ?? "png";
  const buffer = Buffer.from(await response.arrayBuffer());

  return buildLocalAsset(
    input.platform,
    input.assetId,
    extension,
    buffer,
    input.src
  );
}
