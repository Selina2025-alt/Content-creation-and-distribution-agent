type GenerationProgressProps = {
  visible: boolean;
};

export function GenerationProgress({ visible }: GenerationProgressProps) {
  if (!visible) {
    return null;
  }

  return (
    <div aria-live="polite" className="hero-progress" role="status">
      <span className="hero-progress__dot" />
      <span>Generating content bundle...</span>
    </div>
  );
}
