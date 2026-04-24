import {
  getSkillById,
  getSkillLearningResult,
  listSkills
} from "@/lib/db/repositories/skill-repository";
import { getPlatformSetting } from "@/lib/db/repositories/platform-settings-repository";
import type { PlatformId, SkillKind, SkillSourceType } from "@/lib/types";

function buildRulesForSkills(
  skills: Array<NonNullable<ReturnType<typeof getSkillById>>>
) {
  return skills.flatMap((skill) => {
    const learningResult = getSkillLearningResult(skill.id);

    return [
      skill.name,
      ...(learningResult?.rules ?? []),
      ...(learningResult?.summary ? [learningResult.summary] : [])
    ];
  });
}

function buildSkillSnapshots(
  platform: PlatformId,
  skills: Array<NonNullable<ReturnType<typeof getSkillById>>>,
  skillKind: SkillKind
) {
  return skills.map((skill) => ({
    platform,
    name: skill.name,
    sourceRef: skill.sourceRef,
    sourceType: skill.sourceType,
    skillKind
  }));
}

export function resolveGenerationContext(platforms: PlatformId[]) {
  return platforms.reduce<{
    appliedRulesByPlatform: Partial<Record<PlatformId, string[]>>;
    imageRulesByPlatform: Partial<Record<PlatformId, string[]>>;
    skillSnapshots: Array<{
      platform: PlatformId;
      name: string;
      sourceRef: string;
      sourceType: SkillSourceType;
      skillKind?: SkillKind;
    }>;
  }>(
    (result, platform) => {
      const savedSetting = getPlatformSetting(platform) as
        | {
            enabled_skill_ids_json?: string;
            image_skill_ids_json?: string;
          }
        | null;

      const skillIds = savedSetting?.enabled_skill_ids_json
        ? (JSON.parse(savedSetting.enabled_skill_ids_json) as string[])
        : [];
      const skills = skillIds
        .map((skillId) => getSkillById(skillId))
        .filter(
          (
            skill
          ): skill is NonNullable<ReturnType<typeof getSkillById>> => Boolean(skill)
        );

      if (skills.length > 0) {
        result.appliedRulesByPlatform[platform] = buildRulesForSkills(skills);
        result.skillSnapshots.push(...buildSkillSnapshots(platform, skills, "content"));
      }

      if (platform === "xiaohongshu") {
        const selectedImageSkillIds = savedSetting?.image_skill_ids_json
          ? (JSON.parse(savedSetting.image_skill_ids_json) as string[])
          : [];
        const imageSkills =
          selectedImageSkillIds.length > 0
            ? selectedImageSkillIds
                .map((skillId) => getSkillById(skillId))
                .filter(
                  (
                    skill
                  ): skill is NonNullable<ReturnType<typeof getSkillById>> => {
                    if (!skill) {
                      return false;
                    }

                    return skill.skillKind === "image";
                  }
                )
            : listSkills().filter(
                (skill) => skill.skillKind === "image" && skill.status === "ready"
              );

        if (imageSkills.length > 0) {
          result.imageRulesByPlatform[platform] = buildRulesForSkills(imageSkills);
          result.skillSnapshots.push(
            ...buildSkillSnapshots(platform, imageSkills, "image")
          );
        }
      }

      return result;
    },
    {
      appliedRulesByPlatform: {},
      imageRulesByPlatform: {},
      skillSnapshots: []
    }
  );
}
