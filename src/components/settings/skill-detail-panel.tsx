import type { ReactNode } from "react";

import type { SkillLearningResultRecord, SkillRecord } from "@/lib/types";

function renderPreviewContent(content: string) {
  const nodes: ReactNode[] = [];
  const lines = content.split(/\r?\n/);
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCodeBlock = false;
  let keyIndex = 0;

  function nextKey() {
    keyIndex += 1;
    return `preview-node-${keyIndex}`;
  }

  function flushParagraph() {
    if (paragraphBuffer.length === 0) {
      return;
    }

    nodes.push(<p key={nextKey()}>{paragraphBuffer.join(" ")}</p>);
    paragraphBuffer = [];
  }

  function flushList() {
    if (listBuffer.length === 0) {
      return;
    }

    nodes.push(
      <ul key={nextKey()}>
        {listBuffer.map((item) => (
          <li key={`${nextKey()}-${item}`}>{item}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  }

  function flushCode() {
    if (codeBuffer.length === 0) {
      return;
    }

    nodes.push(
      <pre key={nextKey()}>
        <code>{codeBuffer.join("\n")}</code>
      </pre>
    );
    codeBuffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      flushParagraph();
      flushList();

      if (inCodeBlock) {
        flushCode();
      }

      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^#{1,3}\s+/.test(trimmedLine)) {
      flushParagraph();
      flushList();

      const level = trimmedLine.match(/^#+/)?.[0].length ?? 1;
      const title = trimmedLine.replace(/^#{1,3}\s+/, "");

      if (level === 1) {
        nodes.push(<h3 key={nextKey()}>{title}</h3>);
      } else if (level === 2) {
        nodes.push(<h4 key={nextKey()}>{title}</h4>);
      } else {
        nodes.push(<h5 key={nextKey()}>{title}</h5>);
      }

      continue;
    }

    if (/^[-*]\s+/.test(trimmedLine)) {
      flushParagraph();
      listBuffer.push(trimmedLine.replace(/^[-*]\s+/, ""));
      continue;
    }

    paragraphBuffer.push(trimmedLine);
  }

  flushParagraph();
  flushList();
  flushCode();

  if (nodes.length === 0) {
    return [<p key="preview-empty">暂无可预览内容。</p>];
  }

  return nodes;
}

export function SkillDetailPanel(props: {
  skill: SkillRecord | null;
  learningResult: SkillLearningResultRecord | null;
  files?: string[];
  selectedFilePath?: string | null;
  selectedFileContent?: string | null;
  onSelectFile?: (filePath: string) => void;
}) {
  const previewContent = props.selectedFileContent ?? "选择左侧文件查看内容。";
  const previewLabel = props.selectedFilePath ?? "未选择文件";

  return (
    <section className="settings-card">
      <p className="settings-card__eyebrow">Skill Detail</p>
      <h2 className="settings-card__title">
        {props.skill?.name ?? "选中一个 skill 查看详情"}
      </h2>
      <p className="settings-card__description">
        {props.learningResult?.summary ??
          "这里会展示 skill 的学习摘要、规则提炼，以及文件级预览。"}
      </p>

      {props.learningResult ? (
        <>
          <div className="settings-detail-grid">
            <div>
              <p className="settings-card__eyebrow">Keywords</p>
              <div className="settings-chip-list">
                {props.learningResult.keywords.map((keyword) => (
                  <span className="settings-chip" key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="settings-card__eyebrow">Rules</p>
              <ul className="settings-detail-list">
                {props.learningResult.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="settings-card__eyebrow">Examples</p>
              <ul className="settings-detail-list">
                {props.learningResult.examplesSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="settings-file-browser">
            <div className="settings-file-browser__sidebar">
              <div className="settings-file-browser__sidebar-header">
                <p className="settings-card__eyebrow">Files</p>
                <span className="settings-file-browser__count">
                  {props.files?.length ?? 0} files
                </span>
              </div>

              <div className="settings-file-browser__list">
                {props.files && props.files.length > 0 ? (
                  props.files.map((filePath) => (
                    <button
                      className={[
                        "settings-file-button",
                        props.selectedFilePath === filePath
                          ? "settings-file-button--active"
                          : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={filePath}
                      onClick={() => props.onSelectFile?.(filePath)}
                      type="button"
                    >
                      {filePath}
                    </button>
                  ))
                ) : (
                  <p className="settings-empty-file">这个 skill 还没有可预览的文本文件。</p>
                )}
              </div>
            </div>

            <div className="settings-file-preview">
              <div className="settings-file-preview__header">
                <div>
                  <p className="settings-card__eyebrow">Preview</p>
                  <p className="settings-file-preview__path">{previewLabel}</p>
                </div>
              </div>

              <article className="settings-file-preview__document">
                {renderPreviewContent(previewContent)}
              </article>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
