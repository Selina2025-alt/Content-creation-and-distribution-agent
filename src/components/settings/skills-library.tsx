import type { SkillKind } from "@/lib/types";

type SkillListItem = {
  id: string;
  keywords: string[];
  name: string;
  platformHints: string[];
  rules: string[];
  skillKind: SkillKind;
  summary: string;
  source: string;
  status: string;
};

function SkillLibraryItem(props: {
  activeSkillId?: string | null;
  deletingSkillId?: string | null;
  onDelete?: (skillId: string) => void;
  onSelect?: (skillId: string) => void;
  skill: SkillListItem;
}) {
  const skill = props.skill;

  return (
    <article
      className={[
        "settings-library-item",
        props.activeSkillId === skill.id ? "settings-library-item--active" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        className="settings-library-item__button"
        onClick={() => props.onSelect?.(skill.id)}
        type="button"
      >
        <div className="settings-library-item__body">
          <strong>{skill.name}</strong>
          <p>
            {skill.summary ||
              "暂无摘要。点击查看右侧详情，可打开 skill 文件继续确认。"}
          </p>
          {skill.rules.length > 0 ? (
            <ul className="settings-library-item__capabilities">
              {skill.rules.slice(0, 2).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          ) : null}
          {skill.keywords.length > 0 || skill.platformHints.length > 0 ? (
            <div className="settings-library-item__tags">
              {[...skill.platformHints, ...skill.keywords].slice(0, 5).map((tag) => (
                <span className="settings-mini-chip" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>
      <div className="settings-library-item__actions">
        <div className="settings-library-item__meta">
          <span className="settings-chip">
            {skill.skillKind === "image" ? "IMAGE" : "CONTENT"}
          </span>
          <span className="settings-chip">{skill.source}</span>
          <span className="settings-chip">{skill.status}</span>
        </div>
        <button
          aria-label={`删除 ${skill.name}`}
          className="settings-library-item__delete"
          disabled={props.deletingSkillId === skill.id}
          onClick={() => props.onDelete?.(skill.id)}
          type="button"
        >
          {props.deletingSkillId === skill.id ? "删除中..." : "删除"}
        </button>
      </div>
    </article>
  );
}

function SkillLibrarySection(props: {
  activeSkillId?: string | null;
  deletingSkillId?: string | null;
  description: string;
  emptyText: string;
  skills: SkillListItem[];
  title: string;
  onDelete?: (skillId: string) => void;
  onSelect?: (skillId: string) => void;
}) {
  return (
    <div className="settings-library-section">
      <div className="settings-library-section__header">
        <h3>{props.title}</h3>
        <p>{props.description}</p>
      </div>

      {props.skills.length > 0 ? (
        <div className="settings-library-list">
          {props.skills.map((skill) => (
            <SkillLibraryItem
              activeSkillId={props.activeSkillId}
              deletingSkillId={props.deletingSkillId}
              key={skill.id}
              skill={skill}
              onDelete={props.onDelete}
              onSelect={props.onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="settings-empty">
          <strong>{props.emptyText}</strong>
          <p>可以通过上传 zip、GitHub 安装或直接写 Prompt 来新增。</p>
        </div>
      )}
    </div>
  );
}

export function SkillsLibrary(props: {
  activeSkillId?: string | null;
  deletingSkillId?: string | null;
  onDelete?: (skillId: string) => void;
  onSelect?: (skillId: string) => void;
  skills: SkillListItem[];
}) {
  const contentSkills = props.skills.filter((skill) => skill.skillKind === "content");
  const imageSkills = props.skills.filter((skill) => skill.skillKind === "image");

  return (
    <section className="settings-card settings-card--anchor" id="skills-library">
      <p className="settings-card__eyebrow">Skills Library</p>
      <h2 className="settings-card__title">Skills Library</h2>
      <p className="settings-card__description">
        技能库分为内容技能和图片技能。内容技能参与文案、结构、风格生成；图片技能参与小红书配图规划、代码绘图和视觉风格生成。
      </p>

      <div className="settings-library-sections">
        <SkillLibrarySection
          activeSkillId={props.activeSkillId}
          deletingSkillId={props.deletingSkillId}
          description="写作规则、平台表达、选题方法和内容风格。"
          emptyText="还没有内容技能"
          skills={contentSkills}
          title="Content Skills"
          onDelete={props.onDelete}
          onSelect={props.onSelect}
        />
        <SkillLibrarySection
          activeSkillId={props.activeSkillId}
          deletingSkillId={props.deletingSkillId}
          description="代码绘图、信息图、图卡模板和视觉生成策略。"
          emptyText="还没有图片技能"
          skills={imageSkills}
          title="Image Skills"
          onDelete={props.onDelete}
          onSelect={props.onSelect}
        />
      </div>
    </section>
  );
}
