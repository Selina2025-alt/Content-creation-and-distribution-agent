import { NextResponse } from "next/server";

import { migrateDatabase } from "@/lib/db/migrate";
import {
  getPlatformSetting,
  upsertPlatformSetting
} from "@/lib/db/repositories/platform-settings-repository";
import type { PlatformId } from "@/lib/types";

export const runtime = "nodejs";

const allowedPlatforms = new Set<PlatformId>([
  "wechat",
  "xiaohongshu",
  "twitter",
  "videoScript"
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ platform: string }> }
) {
  migrateDatabase();

  const { platform } = await context.params;

  if (!allowedPlatforms.has(platform as PlatformId)) {
    return NextResponse.json({ message: "Unsupported platform" }, { status: 400 });
  }

  return NextResponse.json(getPlatformSetting(platform as PlatformId));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ platform: string }> }
) {
  migrateDatabase();

  const { platform } = await context.params;
  const body = (await request.json()) as {
    baseRules?: string[];
    enabledSkillIds?: string[];
    imageSkillIds?: string[];
  };

  if (!allowedPlatforms.has(platform as PlatformId)) {
    return NextResponse.json({ message: "Unsupported platform" }, { status: 400 });
  }

  upsertPlatformSetting({
    platform: platform as PlatformId,
    baseRulesJson: JSON.stringify(body.baseRules ?? []),
    enabledSkillIdsJson: JSON.stringify(body.enabledSkillIds ?? []),
    imageSkillIdsJson: Array.isArray(body.imageSkillIds)
      ? JSON.stringify(body.imageSkillIds)
      : undefined
  });

  return NextResponse.json({ ok: true });
}
