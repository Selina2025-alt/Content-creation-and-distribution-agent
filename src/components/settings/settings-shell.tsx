"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GithubSkillInstallPanel } from "@/components/settings/github-skill-install-panel";
import { PlatformRuleBindingPanel } from "@/components/settings/platform-rule-binding-panel";
import { PromptSkillPanel } from "@/components/settings/prompt-skill-panel";
import { SkillDetailPanel } from "@/components/settings/skill-detail-panel";
import { SkillUploadPanel } from "@/components/settings/skill-upload-panel";
import { SkillsLibrary } from "@/components/settings/skills-library";
import type {
  PlatformId,
  PlatformSkillSelections,
  SkillDetailPayload,
  SkillLearningResultRecord,
  SkillRecord
} from "@/lib/types";

const platformPanels = [
  {
    key: "wechat" as const,
    label: "公众号文章",
    description: "适合长文深度内容，支持标题、摘要、正文和基础富文本结构。"
  },
  {
    key: "xiaohongshu" as const,
    label: "小红书笔记",
    description: "面向图文种草场景，突出标题、文案和图片建议。"
  },
  {
    key: "twitter" as const,
    label: "Twitter",
    description: "单条与 Thread 并存，适合简洁观点和连续输出。"
  },
  {
    key: "videoScript" as const,
    label: "视频脚本",
    description: "强调分镜和旁白结构，适合短视频原型阶段创作。"
  }
];

type SkillDetailsMap = Record<string, SkillLearningResultRecord | null>;
type SkillFilesMap = Record<string, string[]>;
type SelectedFilesMap = Record<string, { path: string; content: string } | null>;

const emptyPlatformSelections: PlatformSkillSelections = {
  wechat: [],
  xiaohongshu: [],
  twitter: [],
  videoScript: []
};

export function SettingsShell(props: {
  initialImageSkillSelections?: PlatformSkillSelections;
  initialPlatformSelections?: PlatformSkillSelections;
  initialSkillDetails?: SkillDetailsMap;
  initialSkills?: SkillRecord[];
}) {
  const [skills, setSkills] = useState(props.initialSkills ?? []);
  const [skillDetails, setSkillDetails] = useState<SkillDetailsMap>(
    props.initialSkillDetails ?? {}
  );
  const [platformSelections, setPlatformSelections] = useState<PlatformSkillSelections>(
    props.initialPlatformSelections ?? emptyPlatformSelections
  );
  const [imageSkillSelections, setImageSkillSelections] = useState<PlatformSkillSelections>(
    props.initialImageSkillSelections ?? emptyPlatformSelections
  );
  const [skillFiles, setSkillFiles] = useState<SkillFilesMap>({});
  const [selectedFiles, setSelectedFiles] = useState<SelectedFilesMap>({});
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(
    props.initialSkills?.[0]?.id ?? null
  );
  const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);

  const selectedSkill =
    skills.find((skill) => skill.id === selectedSkillId) ?? null;
  const selectedLearningResult = selectedSkillId
    ? skillDetails[selectedSkillId] ?? null
    : null;
  const selectedSkillFiles = selectedSkillId ? skillFiles[selectedSkillId] ?? [] : [];
  const selectedPreviewFile = selectedSkillId
    ? selectedFiles[selectedSkillId] ?? null
    : null;
  const contentSkills = skills.filter((skill) => (skill.skillKind ?? "content") === "content");
  const imageSkills = skills.filter((skill) => skill.skillKind === "image");

  function getAvailableImageSkills(platformId: PlatformId) {
    return imageSkills.filter((skill) => {
      const hints = skillDetails[skill.id]?.platformHints ?? [];

      if (hints.length === 0) {
        return true;
      }

      return hints.includes(platformId);
    });
  }

  useEffect(() => {
    if (!selectedSkillId) {
      return;
    }

    void loadSkillDetail(selectedSkillId);
  }, [selectedSkillId]);

  async function loadSkillDetail(skillId: string, selectedFilePath?: string) {
    const query = selectedFilePath
      ? `?file=${encodeURIComponent(selectedFilePath)}`
      : "";
    const response = await fetch(`/api/skills/${skillId}${query}`);

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as SkillDetailPayload;

    setSkillDetails((current) => ({
      ...current,
      [skillId]: payload.learningResult
    }));
    setSkillFiles((current) => ({
      ...current,
      [skillId]: payload.files
    }));
    setSelectedFiles((current) => ({
      ...current,
      [skillId]: payload.selectedFile
    }));
  }

  function handleSkillReady(input: {
    skill: SkillRecord;
    learningResult: SkillLearningResultRecord;
  }) {
    setSkills((current) => [
      input.skill,
      ...current.filter((skill) => skill.id !== input.skill.id)
    ]);
    setSkillDetails((current) => ({
      ...current,
      [input.skill.id]: input.learningResult
    }));
    setSelectedSkillId(input.skill.id);
  }

  function togglePlatformSkill(platformId: PlatformId, skillId: string) {
    setPlatformSelections((current) => {
      const currentIds = current[platformId];
      const nextIds = currentIds.includes(skillId)
        ? currentIds.filter((item) => item !== skillId)
        : [...currentIds, skillId];

      return {
        ...current,
        [platformId]: nextIds
      };
    });
  }

  function togglePlatformImageSkill(platformId: PlatformId, skillId: string) {
    setImageSkillSelections((current) => {
      const currentIds = current[platformId];
      const nextIds = currentIds.includes(skillId)
        ? currentIds.filter((item) => item !== skillId)
        : [...currentIds, skillId];

      return {
        ...current,
        [platformId]: nextIds
      };
    });
  }

  async function savePlatformSelection(
    platformId: PlatformId,
    selectedSkillIds: string[],
    selectedImageSkillIds: string[]
  ) {
    const payload: {
      baseRules: string[];
      enabledSkillIds: string[];
      imageSkillIds?: string[];
    } = {
      baseRules: [],
      enabledSkillIds: selectedSkillIds
    };

    if (platformId === "xiaohongshu" || selectedImageSkillIds.length > 0) {
      payload.imageSkillIds = selectedImageSkillIds;
    }

    await fetch(`/api/platform-settings/${platformId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  }

  async function handleSave(platformId: PlatformId) {
    await savePlatformSelection(
      platformId,
      platformSelections[platformId],
      imageSkillSelections[platformId]
    );
  }

  async function handleReset(platformId: PlatformId) {
    setPlatformSelections((current) => ({
      ...current,
      [platformId]: []
    }));
    setImageSkillSelections((current) => ({
      ...current,
      [platformId]: []
    }));

    await savePlatformSelection(platformId, [], []);
  }

  async function handleDeleteSkill(skillId: string) {
    setDeletingSkillId(skillId);

    try {
      const response = await fetch(`/api/skills/${skillId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        return;
      }

      const nextSkills = skills.filter((skill) => skill.id !== skillId);

      setSkills(nextSkills);
      setSelectedSkillId((current) =>
        current === skillId ? nextSkills[0]?.id ?? null : current
      );
      setSkillDetails((current) => {
        const next = { ...current };
        delete next[skillId];
        return next;
      });
      setSkillFiles((current) => {
        const next = { ...current };
        delete next[skillId];
        return next;
      });
      setSelectedFiles((current) => {
        const next = { ...current };
        delete next[skillId];
        return next;
      });
      setPlatformSelections((current) => ({
        wechat: current.wechat.filter((id) => id !== skillId),
        xiaohongshu: current.xiaohongshu.filter((id) => id !== skillId),
        twitter: current.twitter.filter((id) => id !== skillId),
        videoScript: current.videoScript.filter((id) => id !== skillId)
      }));
      setImageSkillSelections((current) => ({
        wechat: current.wechat.filter((id) => id !== skillId),
        xiaohongshu: current.xiaohongshu.filter((id) => id !== skillId),
        twitter: current.twitter.filter((id) => id !== skillId),
        videoScript: current.videoScript.filter((id) => id !== skillId)
      }));
    } finally {
      setDeletingSkillId(null);
    }
  }

  return (
    <main className="settings-layout">
      <aside className="settings-nav">
        <Link className="page-return-link" href="/">
          <svg
            aria-hidden="true"
            fill="none"
            height="14"
            viewBox="0 0 16 16"
            width="14"
          >
            <path
              d="M6.5 3.5 2.5 8l4 4.5M3 8h10.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
          <span>返回主页</span>
        </Link>

        <p className="settings-nav__eyebrow">Settings</p>
        <h1 className="settings-nav__title">平台规则与 Skills</h1>
        <nav className="settings-nav__list">
          {platformPanels.map((panel) => (
            <a
              className="settings-nav__button"
              href={`#platform-${panel.key}`}
              key={panel.key}
            >
              {panel.label}
            </a>
          ))}
          <a
            className="settings-nav__button settings-nav__button--accent"
            href="#skills-library"
          >
            Skills Library
          </a>
          <Link className="settings-nav__button" href="/library">
            内容库
          </Link>
        </nav>
      </aside>

      <section className="settings-content">
        <div className="settings-grid">
          {platformPanels.map((panel) => (
            <PlatformRuleBindingPanel
              availableImageSkills={
                panel.key === "xiaohongshu" || panel.key === "wechat"
                  ? getAvailableImageSkills(panel.key).map((skill) => ({
                      id: skill.id,
                      name: skill.name
                    }))
                  : undefined
              }
              availableSkills={contentSkills.map((skill) => ({
                id: skill.id,
                name: skill.name
              }))}
              description={panel.description}
              key={panel.key}
              platform={panel.label}
              platformId={panel.key}
              selectedImageSkillIds={imageSkillSelections[panel.key]}
              selectedSkillIds={platformSelections[panel.key]}
              onReset={() => void handleReset(panel.key)}
              onSave={() => void handleSave(panel.key)}
              onToggleImageSkill={(skillId) =>
                togglePlatformImageSkill(panel.key, skillId)
              }
              onToggleSkill={(skillId) => togglePlatformSkill(panel.key, skillId)}
            />
          ))}
        </div>

        <div className="settings-skills-grid">
          <div className="settings-panel-stack">
            <PromptSkillPanel onCreated={handleSkillReady} />
            <SkillUploadPanel onUploaded={handleSkillReady} />
            <GithubSkillInstallPanel onInstalled={handleSkillReady} />
          </div>
          <SkillDetailPanel
            files={selectedSkillFiles}
            learningResult={selectedLearningResult}
            onSelectFile={(filePath) => {
              if (selectedSkillId) {
                void loadSkillDetail(selectedSkillId, filePath);
              }
            }}
            selectedFileContent={selectedPreviewFile?.content ?? null}
            selectedFilePath={selectedPreviewFile?.path ?? null}
            skill={selectedSkill}
          />
        </div>

        <SkillsLibrary
          activeSkillId={selectedSkillId}
          deletingSkillId={deletingSkillId}
          onDelete={(skillId) => void handleDeleteSkill(skillId)}
          onSelect={setSelectedSkillId}
          skills={skills.map((skill) => {
            const learningResult = skillDetails[skill.id];

            return {
              id: skill.id,
              keywords: learningResult?.keywords ?? [],
              name: skill.name,
              platformHints: learningResult?.platformHints ?? [],
              rules: learningResult?.rules ?? [],
              skillKind: skill.skillKind ?? "content",
              summary: learningResult?.summary ?? skill.summary,
              source: skill.sourceType.toUpperCase(),
              status: skill.status
            };
          })}
        />
      </section>
    </main>
  );
}
