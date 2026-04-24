import { openDatabase } from "@/lib/db/client";
import type { PlatformId } from "@/lib/types";

export function getPlatformSetting(platform: PlatformId) {
  const db = openDatabase();
  const row = db
    .prepare(
      `SELECT platform, base_rules_json, enabled_skill_ids_json, image_skill_ids_json, updated_at
       FROM platform_settings
       WHERE platform = ?`
    )
    .get(platform);

  db.close();

  return row ?? null;
}

export function upsertPlatformSetting(input: {
  platform: PlatformId;
  baseRulesJson: string;
  enabledSkillIdsJson: string;
  imageSkillIdsJson?: string;
}) {
  const db = openDatabase();
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `SELECT image_skill_ids_json
       FROM platform_settings
       WHERE platform = ?`
    )
    .get(input.platform) as { image_skill_ids_json?: string } | undefined;
  const imageSkillIdsJson =
    input.imageSkillIdsJson ?? existing?.image_skill_ids_json ?? "[]";

  db.prepare(
    `INSERT INTO platform_settings (platform, base_rules_json, enabled_skill_ids_json, image_skill_ids_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(platform) DO UPDATE SET
       base_rules_json = excluded.base_rules_json,
       enabled_skill_ids_json = excluded.enabled_skill_ids_json,
       image_skill_ids_json = excluded.image_skill_ids_json,
       updated_at = excluded.updated_at`
  ).run(
    input.platform,
    input.baseRulesJson,
    input.enabledSkillIdsJson,
    imageSkillIdsJson,
    now
  );

  db.close();
}
