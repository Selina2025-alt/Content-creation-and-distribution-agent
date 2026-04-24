type AvailableSkill = {
  id: string;
  name: string;
};

function SkillPicker(props: {
  availableSkills: AvailableSkill[];
  emptyLibraryText: string;
  emptySelectedText: string;
  label: string;
  selectedSkillIds: string[];
  onToggleSkill?: (skillId: string) => void;
}) {
  const selectedSkills = props.availableSkills.filter((skill) =>
    props.selectedSkillIds.includes(skill.id)
  );

  return (
    <div className="settings-selection-group">
      <p className="settings-selection-group__label">{props.label}</p>

      <div className="settings-chip-list" aria-label={`${props.label} 当前选择`}>
        {selectedSkills.length > 0 ? (
          selectedSkills.map((skill) => (
            <span className="settings-chip settings-chip--selected" key={skill.id}>
              {skill.name}
            </span>
          ))
        ) : (
          <span className="settings-empty-inline">{props.emptySelectedText}</span>
        )}
      </div>

      <div className="settings-chip-list" aria-label={`${props.label} 技能库`}>
        {props.availableSkills.length > 0 ? (
          props.availableSkills.map((skill) => {
            const isSelected = props.selectedSkillIds.includes(skill.id);

            return (
              <button
                aria-pressed={isSelected}
                className={[
                  "settings-chip-button",
                  isSelected ? "settings-chip-button--active" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={skill.id}
                onClick={() => props.onToggleSkill?.(skill.id)}
                type="button"
              >
                {skill.name}
              </button>
            );
          })
        ) : (
          <span className="settings-empty-inline">{props.emptyLibraryText}</span>
        )}
      </div>
    </div>
  );
}

export function PlatformRuleBindingPanel(props: {
  platformId: string;
  platform: string;
  description: string;
  availableSkills: AvailableSkill[];
  availableImageSkills?: AvailableSkill[];
  selectedSkillIds: string[];
  selectedImageSkillIds?: string[];
  onToggleSkill?: (skillId: string) => void;
  onToggleImageSkill?: (skillId: string) => void;
  onSave?: () => void;
  onReset?: () => void;
}) {
  const showImageSkills = props.availableImageSkills !== undefined;

  return (
    <section
      aria-label={`${props.platform}规则`}
      className="settings-card settings-card--anchor"
      id={`platform-${props.platformId}`}
      role="region"
    >
      <p className="settings-card__eyebrow">Platform Rules</p>
      <h2 className="settings-card__title">{props.platform}</h2>
      <p className="settings-card__description">{props.description}</p>

      <SkillPicker
        availableSkills={props.availableSkills}
        emptyLibraryText="请先上传、安装或新建内容 skill"
        emptySelectedText="暂未选择内容 skills"
        label="内容技能"
        selectedSkillIds={props.selectedSkillIds}
        onToggleSkill={props.onToggleSkill}
      />

      {showImageSkills ? (
        <SkillPicker
          availableSkills={props.availableImageSkills ?? []}
          emptyLibraryText="请先上传、安装或新建图片 skill"
          emptySelectedText="暂未选择图片 skills，生成时会自动匹配图片技能库"
          label="图片技能"
          selectedSkillIds={props.selectedImageSkillIds ?? []}
          onToggleSkill={props.onToggleImageSkill}
        />
      ) : null}

      <div className="settings-actions">
        <button onClick={props.onSave} type="button">
          保存
        </button>
        <button onClick={props.onReset} type="button">
          重置
        </button>
      </div>
    </section>
  );
}
