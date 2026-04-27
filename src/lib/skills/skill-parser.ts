export function parseSkillMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const title =
    lines.find((line) => line.startsWith("name:"))?.replace("name:", "").trim() ??
    "Unnamed skill";
  const description =
    lines
      .find((line) => line.startsWith("description:"))
      ?.replace("description:", "")
      .trim() ?? "No description";

  return { title, description };
}
