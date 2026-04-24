import type { TaskGenerationTrace } from "@/lib/types";

export function GenerationTracePanel(props: {
  trace: TaskGenerationTrace | null;
}) {
  if (!props.trace) {
    return (
      <details className="generation-trace-panel">
        <summary className="generation-trace-panel__summary">
          <div>
            <p className="generation-trace-panel__eyebrow">Trace</p>
            <strong>创作过程 / 溯源</strong>
          </div>
          <span className="generation-trace-panel__badge generation-trace-panel__badge--muted">
            暂无快照
          </span>
        </summary>
        <div className="generation-trace-panel__body generation-trace-panel__body--empty">
          这条内容创建于旧版本，暂时还没有记录创作过程快照。
        </div>
      </details>
    );
  }

  return (
    <details className="generation-trace-panel">
      <summary className="generation-trace-panel__summary">
        <div>
          <p className="generation-trace-panel__eyebrow">Trace</p>
          <strong>创作过程 / 溯源</strong>
          <p className="generation-trace-panel__meta">{props.trace.methodLabel}</p>
        </div>
        <span className="generation-trace-panel__badge">{props.trace.statusLabel}</span>
      </summary>

      <div className="generation-trace-panel__body">
        <div className="generation-trace-panel__topline">
          <span className="generation-trace-panel__provider">
            {props.trace.providerLabel}
          </span>
        </div>

        <section className="generation-trace-panel__section">
          <h3>使用的方法</h3>
          <div className="generation-trace-panel__steps">
            {props.trace.steps.map((step) => (
              <article className="generation-trace-step" key={step.id}>
                <div className="generation-trace-step__dot" />
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="generation-trace-panel__section">
          <h3>技能快照</h3>
          {props.trace.skills.length === 0 ? (
            <p className="generation-trace-panel__empty">本次没有启用额外 skills。</p>
          ) : (
            <div className="generation-trace-panel__skills">
              {props.trace.skills.map((skill) => (
                <article className="generation-trace-skill" key={`${skill.platform}-${skill.name}`}>
                  <div className="generation-trace-skill__header">
                    <span>{skill.platform}</span>
                    <strong>{skill.name}</strong>
                  </div>
                  <p>{skill.sourceRef}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="generation-trace-panel__section">
          <h3>资料来源</h3>
          <div className="generation-trace-panel__sources">
            {props.trace.sources.map((source) => (
              <article className="generation-trace-source" key={source.id}>
                <strong>{source.label}</strong>
                <p>{source.detail}</p>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    打开来源
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </details>
  );
}
