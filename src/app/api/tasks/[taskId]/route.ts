import { NextResponse } from "next/server";

import { getTaskGenerationTrace } from "@/lib/content/task-generation-trace";
import { migrateDatabase } from "@/lib/db/migrate";
import { getTaskBundle } from "@/lib/db/repositories/task-content-repository";
import {
  deleteTask,
  getTaskById,
  renameTask
} from "@/lib/db/repositories/task-repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  migrateDatabase();

  const { taskId } = await context.params;
  const task = getTaskById(taskId);

  if (!task) {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({
    task,
    bundle: getTaskBundle(taskId),
    trace: getTaskGenerationTrace(taskId)
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  migrateDatabase();

  const { taskId } = await context.params;
  const body = (await request.json()) as { title?: string };

  if (body.title?.trim()) {
    renameTask(taskId, body.title.trim());
  }

  return NextResponse.json(getTaskById(taskId));
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  migrateDatabase();

  const { taskId } = await context.params;
  deleteTask(taskId);

  return NextResponse.json({ success: true });
}
