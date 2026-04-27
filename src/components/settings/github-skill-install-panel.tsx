"use client";

import { useState, useTransition } from "react";

import type { SkillKind, SkillLearningResultRecord, SkillRecord } from "@/lib/types";

type InstalledSkillPayload = {
  skill: SkillRecord;
  learningResult: SkillLearningResultRecord;
};

export function GithubSkillInstallPanel(props: {
  onInstalled?: (payload: InstalledSkillPayload) => void;
}) {
  const [command, setCommand] = useState("");
  const [skillKind, setSkillKind] = useState<SkillKind>("content");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleInstall() {
    if (!command.trim()) {
      setMessage("请输入一句自然语言安装指令。");
      return;
    }

    const response = await fetch("/api/skills/install", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ command, skillKind })
    });
    const payload = (await response.json()) as
      | InstalledSkillPayload
      | { message?: string };
    const errorMessage = "message" in payload ? payload.message : undefined;

    if (!response.ok || !("skill" in payload) || !payload.learningResult) {
      setMessage(
        errorMessage ??
          "安装失败，请检查仓库地址、skill 名称，或补充更清晰的自然语言描述。"
      );
      return;
    }

    startTransition(() => {
      props.onInstalled?.(payload);
    });
    setCommand("");
    setSkillKind("content");
    setMessage("GitHub skill 已安装并完成学习。");
  }

  return (
    <section className="settings-card">
      <p className="settings-card__eyebrow">GitHub Install</p>
      <h2 className="settings-card__title">从 GitHub 安装 skill</h2>
      <p className="settings-card__description">
        支持自然语言、GitHub URL、<code>owner/repo</code> 或 <code>skills/path</code>。
        系统会自动解析仓库、联网查找 skill，并下载到本地资源库。
      </p>

      <div className="settings-kind-toggle" aria-label="GitHub skill type">
        <button
          aria-pressed={skillKind === "content"}
          className={skillKind === "content" ? "is-active" : ""}
          onClick={() => setSkillKind("content")}
          type="button"
        >
          内容技能
        </button>
        <button
          aria-pressed={skillKind === "image"}
          className={skillKind === "image" ? "is-active" : ""}
          onClick={() => setSkillKind("image")}
          type="button"
        >
          图片技能
        </button>
      </div>

      <div className="editor-field">
        <label htmlFor="github-skill-command">安装指令</label>
        <textarea
          className="settings-command"
          id="github-skill-command"
          onChange={(event) => setCommand(event.target.value)}
          placeholder="例如：帮我安装 https://github.com/Selina2025-alt/claude-skills-library.git 的 huashu-wechat-creation 技能"
          value={command}
        />
      </div>

      <div className="settings-actions">
        <button disabled={isPending} onClick={handleInstall} type="button">
          {isPending ? "安装中..." : "安装并学习"}
        </button>
      </div>

      {message ? (
        <p className="settings-upload__meta" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
