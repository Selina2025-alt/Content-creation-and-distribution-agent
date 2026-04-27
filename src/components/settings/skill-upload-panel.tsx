"use client";

import { useState, useTransition } from "react";

import type { SkillKind, SkillLearningResultRecord, SkillRecord } from "@/lib/types";

type UploadedSkillPayload = {
  skill: SkillRecord;
  learningResult: SkillLearningResultRecord;
};

export function SkillUploadPanel(props: {
  onUploaded?: (payload: UploadedSkillPayload) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [skillKind, setSkillKind] = useState<SkillKind>("content");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleUpload() {
    if (!selectedFile) {
      setMessage("请先选择一个 zip 技能包。");
      return;
    }

    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("skillKind", skillKind);

    const response = await fetch("/api/skills/upload", {
      method: "POST",
      body: formData
    });
    const payload = (await response.json()) as
      | UploadedSkillPayload
      | { message?: string };
    const errorMessage = "message" in payload ? payload.message : undefined;

    if (!response.ok || !("skill" in payload) || !payload.learningResult) {
      setMessage(errorMessage ?? "上传失败，请检查技能包结构。");
      return;
    }

    startTransition(() => {
      props.onUploaded?.(payload);
    });
    setMessage("技能包已上传并完成学习。");
    setSelectedFile(null);
    setSkillKind("content");
  }

  return (
    <section className="settings-card">
      <p className="settings-card__eyebrow">Zip Upload</p>
      <h2 className="settings-card__title">上传 zip 技能包</h2>
      <p className="settings-card__description">
        技能包根目录必须包含 <code>SKILL.md</code>。上传前请选择它是内容技能还是图片技能。
      </p>

      <div className="settings-kind-toggle" aria-label="Upload skill type">
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

      <label className="settings-upload">
        <span>选择 zip 文件</span>
        <input
          accept=".zip"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>

      {selectedFile ? (
        <p className="settings-upload__meta">已选择：{selectedFile.name}</p>
      ) : null}

      <div className="settings-actions">
        <button disabled={isPending} onClick={handleUpload} type="button">
          {isPending ? "上传中..." : "上传并学习"}
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
