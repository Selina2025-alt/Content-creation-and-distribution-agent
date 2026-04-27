export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    selected_platforms_json TEXT NOT NULL,
    status TEXT NOT NULL,
    last_generated_task_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    user_input TEXT NOT NULL,
    selected_platforms_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS task_contents (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    content_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body_json TEXT NOT NULL,
    publish_status TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS platform_settings (
    platform TEXT PRIMARY KEY,
    base_rules_json TEXT NOT NULL,
    enabled_skill_ids_json TEXT NOT NULL,
    image_skill_ids_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    summary TEXT NOT NULL,
    status TEXT NOT NULL,
    skill_kind TEXT NOT NULL DEFAULT 'content',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS deleted_builtin_skills (
    skill_id TEXT PRIMARY KEY,
    deleted_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS skill_files (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS skill_learning_results (
    skill_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    rules_json TEXT NOT NULL,
    platform_hints_json TEXT NOT NULL,
    keywords_json TEXT NOT NULL,
    examples_summary_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS skill_bindings (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS history_actions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS library_entries (
    task_id TEXT PRIMARY KEY,
    source_draft_id TEXT,
    platform TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`
];
