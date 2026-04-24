import type { PersistedVideoScriptContent, VideoScene } from "@/lib/types";

type VideoSceneField =
  | "shot"
  | "copy"
  | "visual"
  | "subtitle"
  | "pace"
  | "audio"
  | "effect";

const columns: Array<{
  field: VideoSceneField;
  label: string;
  className?: string;
  rows?: number;
}> = [
  { field: "shot", label: "镜号", className: "video-script-table__shot" },
  { field: "copy", label: "文案内容", className: "video-script-table__copy", rows: 4 },
  { field: "visual", label: "画面建议", className: "video-script-table__visual", rows: 4 },
  { field: "subtitle", label: "字幕重点", rows: 3 },
  { field: "pace", label: "节奏", rows: 3 },
  { field: "audio", label: "音效/音乐", rows: 3 },
  { field: "effect", label: "特效", rows: 3 }
];

function normalizeSceneForEditor(scene: VideoScene, index: number): VideoScene {
  const copy = scene.copy || scene.voiceover || "";

  return {
    shot: scene.shot || String(index + 1).padStart(2, "0"),
    copy,
    visual: scene.visual || "",
    subtitle: scene.subtitle || copy,
    pace: scene.pace || "中等节奏",
    audio: scene.audio || "轻背景音乐",
    effect: scene.effect || "基础转场",
    voiceover: scene.voiceover
  };
}

function getTextareaRows(
  value: string,
  minimumRows: number,
  field: VideoSceneField
) {
  const estimatedCharactersPerLine =
    field === "copy" || field === "visual" ? 18 : 11;
  const lineCount = value.split(/\r?\n/).length;
  const lengthRows = Math.ceil(value.length / estimatedCharactersPerLine) + 1;

  return Math.max(minimumRows, lineCount + 1, lengthRows);
}

export function VideoScriptEditor(props: {
  value: PersistedVideoScriptContent;
  isEditing: boolean;
  onChange: (value: PersistedVideoScriptContent) => void;
}) {
  const scenes = props.value.scenes.map(normalizeSceneForEditor);

  function updateScene(
    index: number,
    field: VideoSceneField,
    nextValue: string
  ) {
    const nextScenes = props.value.scenes.map((scene, sceneIndex) =>
      sceneIndex === index
        ? {
            ...normalizeSceneForEditor(scene, sceneIndex),
            [field]: nextValue,
            ...(field === "copy" ? { voiceover: nextValue } : {})
          }
        : normalizeSceneForEditor(scene, sceneIndex)
    );

    props.onChange({ ...props.value, scenes: nextScenes });
  }

  return (
    <section className="editor-surface editor-surface--stacked">
      <div className="editor-field">
        <label htmlFor="video-title">脚本标题</label>
        <input
          id="video-title"
          onChange={(event) =>
            props.onChange({ ...props.value, title: event.target.value })
          }
          readOnly={!props.isEditing}
          value={props.value.title}
        />
      </div>

      <div className="editor-section">
        <div className="editor-section__heading">
          <h3>分镜表</h3>
          <p>按拍摄与剪辑交付字段组织，可直接复制给视频团队执行。</p>
        </div>

        <div className="video-script-table-wrap">
          <table className="video-script-table video-script-table--wide">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th className={column.className} key={column.field} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenes.map((scene, index) => (
                <tr key={`${scene.shot}-${index}`}>
                  {columns.map((column) => (
                    <td className={column.className} key={column.field}>
                      {column.field === "shot" ? (
                        <input
                          aria-label={`第 ${index + 1} 镜${column.label}`}
                          className="video-script-table__input"
                          onChange={(event) =>
                            updateScene(index, column.field, event.target.value)
                          }
                          readOnly={!props.isEditing}
                          value={scene[column.field]}
                        />
                      ) : (
                        <textarea
                          aria-label={`第 ${index + 1} 镜${column.label}`}
                          className="video-script-table__textarea video-script-table__textarea--expanded"
                          onChange={(event) =>
                            updateScene(index, column.field, event.target.value)
                          }
                          readOnly={!props.isEditing}
                          rows={getTextareaRows(
                            scene[column.field],
                            column.rows ?? 3,
                            column.field
                          )}
                          value={scene[column.field]}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
