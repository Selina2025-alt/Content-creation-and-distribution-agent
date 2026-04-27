import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  ensureAppDirectories,
  getGeneratedAssetFilePath,
  getGeneratedAssetsPath
} from "@/lib/fs/app-paths";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetPath: string[] }> }
) {
  ensureAppDirectories();

  const { assetPath } = await context.params;

  if (
    !assetPath ||
    assetPath.length === 0 ||
    assetPath.some((segment) => segment.includes("..") || segment.includes("\\"))
  ) {
    return NextResponse.json({ message: "Invalid asset path" }, { status: 400 });
  }

  const assetsRoot = path.resolve(getGeneratedAssetsPath());
  const filePath = path.resolve(getGeneratedAssetFilePath(assetPath));

  if (!filePath.startsWith(assetsRoot)) {
    return NextResponse.json({ message: "Invalid asset path" }, { status: 400 });
  }

  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    return new Response(file, {
      headers: {
        "Content-Type": contentTypes[extension] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ message: "Asset not found" }, { status: 404 });
  }
}
