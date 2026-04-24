import { listHistoryActions } from "@/lib/db/repositories/history-action-repository";
import {
  getLibraryEntry,
  listLibraryEntries
} from "@/lib/db/repositories/library-entry-repository";
import { getTaskBundle } from "@/lib/db/repositories/task-content-repository";
import { getTaskById } from "@/lib/db/repositories/task-repository";
import type {
  WechatLibraryDetail,
  WechatLibraryItem,
  WechatLibraryPayload
} from "@/lib/types";

export function getWechatLibraryItem(taskId: string): WechatLibraryItem | null {
  const task = getTaskById(taskId);
  const bundle = getTaskBundle(taskId);

  if (!task || !bundle.wechat) {
    return null;
  }

  return {
    taskId,
    title: bundle.wechat.title,
    summary: bundle.wechat.summary,
    publishStatus: bundle.wechat.publishStatus,
    userInput: task.userInput,
    updatedAt: task.updatedAt
  };
}

export function getWechatLibraryPayload(): WechatLibraryPayload {
  const items = listLibraryEntries("wechat")
    .map((entry) => getWechatLibraryItem(entry.taskId))
    .filter(Boolean) as WechatLibraryItem[];

  return {
    items,
    recentActions: listHistoryActions().slice(0, 12)
  };
}

export function getWechatLibraryDetail(taskId: string): WechatLibraryDetail | null {
  const libraryEntry = getLibraryEntry(taskId);
  const task = getTaskById(taskId);
  const bundle = getTaskBundle(taskId);

  if (!libraryEntry || libraryEntry.platform !== "wechat" || !task || !bundle.wechat) {
    return null;
  }

  return {
    taskId,
    title: bundle.wechat.title,
    summary: bundle.wechat.summary,
    body: bundle.wechat.body,
    publishStatus: bundle.wechat.publishStatus,
    userInput: task.userInput,
    updatedAt: task.updatedAt
  };
}
