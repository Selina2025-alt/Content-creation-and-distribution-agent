export function resolvePlatformRules(input: {
  platform: string;
  baseRules: string[];
  appliedSkillSummaries: string[];
}) {
  return [...input.baseRules, ...input.appliedSkillSummaries].filter(Boolean);
}
