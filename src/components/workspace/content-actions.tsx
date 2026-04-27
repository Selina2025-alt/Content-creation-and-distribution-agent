export type ContentExportFormat =
  | "markdown"
  | "html"
  | "image-package"
  | "video-script-doc";

type ContentActionsProps = {
  canAddToLibrary: boolean;
  canPublish: boolean;
  exportOptions: Array<{
    format: ContentExportFormat;
    label: string;
  }>;
  isAddingToLibrary: boolean;
  isEditing: boolean;
  isExportingFormat: ContentExportFormat | null;
  isInLibrary: boolean;
  isPublishing: boolean;
  isRegenerating: boolean;
  quickFixAction?: {
    isLoading?: boolean;
    label: string;
    loadingLabel?: string;
    onClick: () => void;
    disabled?: boolean;
  };
  publishLabel?: string;
  statusText: string;
  onAddToLibrary: () => void;
  onCopy: () => void;
  onExport: (format: ContentExportFormat) => void;
  onPublish: () => void;
  onRegenerate: () => void;
  onToggleEdit: () => void;
};

export function ContentActions(props: ContentActionsProps) {
  const publishLabel = props.publishLabel ?? "发布";
  const isDraftSavedStatus =
    props.statusText.includes("成功保存到草稿箱") ||
    props.statusText.toLowerCase().includes("saved to drafts");
  const statusClassName = `content-actions__status${
    isDraftSavedStatus ? " content-actions__status--saved" : ""
  }`;

  return (
    <div className="content-actions">
      <span aria-live="polite" className={statusClassName}>
        {props.statusText}
      </span>
      <div className="content-actions__buttons">
        {props.quickFixAction ? (
          <button
            className="content-actions__button content-actions__button--quick-fix"
            disabled={props.quickFixAction.disabled || props.quickFixAction.isLoading}
            onClick={props.quickFixAction.onClick}
            type="button"
          >
            {props.quickFixAction.isLoading
              ? props.quickFixAction.loadingLabel ?? "处理中..."
              : props.quickFixAction.label}
          </button>
        ) : null}

        {props.canAddToLibrary ? (
          <button
            className={`content-actions__button content-actions__button--library${
              props.isInLibrary ? " content-actions__button--library-active" : ""
            }`}
            disabled={props.isAddingToLibrary || props.isInLibrary}
            onClick={props.onAddToLibrary}
            type="button"
          >
            {props.isInLibrary
              ? "已加入内容库"
              : props.isAddingToLibrary
                ? "加入中..."
                : "加入内容库"}
          </button>
        ) : null}

        <button
          className="content-actions__button content-actions__button--regenerate"
          disabled={props.isRegenerating}
          onClick={props.onRegenerate}
          type="button"
        >
          {props.isRegenerating ? "重新生成中..." : "重新生成"}
        </button>

        <button className="content-actions__button" onClick={props.onToggleEdit} type="button">
          {props.isEditing ? "完成编辑" : "编辑"}
        </button>

        <button className="content-actions__button" onClick={props.onCopy} type="button">
          复制
        </button>

        {props.exportOptions.length > 0 ? (
          <div className="content-actions__export-group" role="group" aria-label="导出">
            {props.exportOptions.map((option) => (
              <button
                key={option.format}
                className={`content-actions__button content-actions__button--export${
                  props.isExportingFormat === option.format
                    ? " content-actions__button--exporting"
                    : ""
                }`}
                disabled={Boolean(props.isExportingFormat)}
                onClick={() => props.onExport(option.format)}
                type="button"
              >
                {props.isExportingFormat === option.format
                  ? `导出${option.label}中...`
                  : `导出${option.label}`}
              </button>
            ))}
          </div>
        ) : null}

        {props.canPublish ? (
          <button
            className="content-actions__button content-actions__publish"
            disabled={props.isPublishing}
            onClick={props.onPublish}
            type="button"
          >
            {props.isPublishing ? `${publishLabel}中...` : publishLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
