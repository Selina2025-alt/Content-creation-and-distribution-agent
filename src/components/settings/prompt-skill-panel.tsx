"use client";

import { useState } from "react";

import type { SkillKind, SkillLearningResultRecord, SkillRecord } from "@/lib/types";

interface PromptSkillPanelProps {
  onCreated: (input: {
    skill: SkillRecord;
    learningResult: SkillLearningResultRecord;
  }) => void;
}

export function PromptSkillPanel({ onCreated }: PromptSkillPanelProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [skillKind, setSkillKind] = useState<SkillKind>("content");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !instruction.trim()) {
      setMessage("请先填写名称和指令。");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const payload: {
        name: string;
        description: string;
        instruction: string;
        platformHints: string[];
        skillKind?: SkillKind;
      } = {
        name: name.trim(),
        description: description.trim(),
        instruction: instruction.trim(),
        platformHints: skillKind === "image" ? ["xiaohongshu"] : ["wechat"]
      };

      if (skillKind === "image") {
        payload.skillKind = "image";
      }

      const response = await fetch("/api/skills/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Failed to create prompt skill");
      }

      const payloadResponse = (await response.json()) as {
        skill: SkillRecord | null;
        learningResult: SkillLearningResultRecord | null;
      };

      if (!payloadResponse.skill || !payloadResponse.learningResult) {
        throw new Error("Prompt skill response is incomplete");
      }

      onCreated({
        skill: payloadResponse.skill,
        learningResult: payloadResponse.learningResult
      });
      setName("");
      setDescription("");
      setInstruction("");
      setSkillKind("content");
      setMessage("Prompt 技能已保存，可以在平台规则里选择使用。");
    } catch {
      setMessage("保存 Prompt 技能时出了点问题，请稍后再试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="settings-card settings-card--prompt">
      <p className="settings-card__eyebrow">Prompt Skill</p>
      <div className="prompt-skill-panel__header">
        <div>
          <h2 className="settings-card__title">新建 Prompt 技能</h2>
          <p className="settings-card__description">
            不上传 zip 也可以直接写一段创作规则。内容技能用于文案和结构，图片技能用于小红书配图策略和代码绘图。
          </p>
        </div>
        <span className="prompt-skill-panel__badge">Direct</span>
      </div>

      <div className="prompt-skill-form">
        <div className="settings-kind-toggle" aria-label="Skill type">
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

        <label className="editor-field" htmlFor="prompt-skill-name">
          <span>Prompt 技能名称</span>
          <input
            id="prompt-skill-name"
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：行业深度分析 Prompt"
            value={name}
          />
        </label>

        <label className="editor-field" htmlFor="prompt-skill-description">
          <span>Prompt 技能描述</span>
          <input
            id="prompt-skill-description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="例如：要求文章有事实、案例和反方观点"
            value={description}
          />
        </label>

        <label className="editor-field" htmlFor="prompt-skill-instruction">
          <span>Prompt 技能指令</span>
          <textarea
            className="settings-command settings-command--compact"
            id="prompt-skill-instruction"
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="写下这条技能的工作方式、写作结构、资料要求、禁忌和输出标准。"
            value={instruction}
          />
        </label>
      </div>

      <div className="settings-actions settings-actions--split">
        {message ? <p className="settings-inline-message">{message}</p> : <span />}
        <button disabled={isSaving} onClick={handleSave} type="button">
          {isSaving ? "保存中..." : "保存 Prompt 技能"}
        </button>
      </div>
    </section>
  );
}
