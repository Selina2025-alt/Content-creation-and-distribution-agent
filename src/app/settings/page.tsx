import { SettingsShell } from "@/components/settings/settings-shell";
import { migrateDatabase } from "@/lib/db/migrate";
import { getPlatformSetting } from "@/lib/db/repositories/platform-settings-repository";
import {
  getSkillLearningResult,
  listSkills
} from "@/lib/db/repositories/skill-repository";
import { ensureBuiltinImageSkills } from "@/lib/skills/builtin-image-skills";
import type {
  PlatformId,
  PlatformSkillSelections,
  SkillLearningResultRecord
} from "@/lib/types";

const platformIds: PlatformId[] = [
  "wechat",
  "xiaohongshu",
  "twitter",
  "videoScript"
];

export default function SettingsPage() {
  migrateDatabase();
  ensureBuiltinImageSkills();

  const skills = listSkills();
  const initialSkillDetails = skills.reduce<
    Record<string, SkillLearningResultRecord | null>
  >((result, skill) => {
    result[skill.id] = getSkillLearningResult(skill.id);
    return result;
  }, {});
  const initialPlatformSelections = platformIds.reduce<PlatformSkillSelections>(
    (result, platformId) => {
      const savedSetting = getPlatformSetting(platformId) as
        | {
            enabled_skill_ids_json?: string;
          }
        | null;

      result[platformId] = savedSetting?.enabled_skill_ids_json
        ? (JSON.parse(savedSetting.enabled_skill_ids_json) as string[])
        : [];

      return result;
    },
    {
      wechat: [],
      xiaohongshu: [],
      twitter: [],
      videoScript: []
    }
  );
  const initialImageSkillSelections = platformIds.reduce<PlatformSkillSelections>(
    (result, platformId) => {
      const savedSetting = getPlatformSetting(platformId) as
        | {
            image_skill_ids_json?: string;
          }
        | null;

      result[platformId] = savedSetting?.image_skill_ids_json
        ? (JSON.parse(savedSetting.image_skill_ids_json) as string[])
        : [];

      return result;
    },
    {
      wechat: [],
      xiaohongshu: [],
      twitter: [],
      videoScript: []
    }
  );

  return (
    <SettingsShell
      initialImageSkillSelections={initialImageSkillSelections}
      initialPlatformSelections={initialPlatformSelections}
      initialSkillDetails={initialSkillDetails}
      initialSkills={skills}
    />
  );
}
