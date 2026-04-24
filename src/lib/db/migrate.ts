import { openDatabase } from "@/lib/db/client";
import { schemaStatements } from "@/lib/db/schema";

function columnExists(
  db: ReturnType<typeof openDatabase>,
  tableName: string,
  columnName: string
) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  return columns.some((column) => column.name === columnName);
}

function addColumnIfMissing(
  db: ReturnType<typeof openDatabase>,
  tableName: string,
  columnName: string,
  definition: string
) {
  if (columnExists(db, tableName, columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
}

export function migrateDatabase() {
  const db = openDatabase();

  for (const statement of schemaStatements) {
    db.exec(statement);
  }

  addColumnIfMissing(
    db,
    "platform_settings",
    "image_skill_ids_json",
    "image_skill_ids_json TEXT NOT NULL DEFAULT '[]'"
  );
  addColumnIfMissing(
    db,
    "skills",
    "skill_kind",
    "skill_kind TEXT NOT NULL DEFAULT 'content'"
  );

  db.close();
}
