import { ensureAppDirectories, getDatabaseFilePath } from "@/lib/fs/app-paths";

export function openDatabase() {
  ensureAppDirectories();

  const sqliteModule = process.getBuiltinModule("node:sqlite");

  if (!sqliteModule) {
    throw new Error("node:sqlite is not available in the current runtime.");
  }

  return new sqliteModule.DatabaseSync(getDatabaseFilePath());
}
