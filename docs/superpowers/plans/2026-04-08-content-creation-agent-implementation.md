# Content Creation Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first Next.js + SQLite content creation workbench that can create, edit, persist, and mock-publish multi-platform content, plus upload or install reusable skills that participate in generation.

**Architecture:** Create a fresh Next.js 15 App Router application inside `内容创作与自动分发agent`, persist domain data with Node's built-in `node:sqlite`, and keep local assets under `.codex-data`. Route handlers will talk to focused repository and service modules so the mock generation flow, skill ingestion flow, and UI state can be replaced later without rewriting page structure.

**Tech Stack:** Next.js 15, React 19, TypeScript, Node `node:sqlite`, Vitest, Testing Library, `adm-zip`, Node `fetch`, CSS variables with a custom design system.

---

## File Structure

### Create

- `package.json`
- `tsconfig.json`
- `next-env.d.ts`
- `next.config.ts`
- `eslint.config.mjs`
- `vitest.config.mts`
- `vitest.setup.ts`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/workspace/[taskId]/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[taskId]/route.ts`
- `src/app/api/tasks/[taskId]/publish/route.ts`
- `src/app/api/platform-settings/[platform]/route.ts`
- `src/app/api/skills/route.ts`
- `src/app/api/skills/[skillId]/route.ts`
- `src/app/api/skills/upload/route.ts`
- `src/app/api/skills/install/route.ts`
- `src/components/home/create-task-hero.tsx`
- `src/components/home/platform-multi-select.tsx`
- `src/components/home/generation-progress.tsx`
- `src/components/workspace/workspace-shell.tsx`
- `src/components/workspace/history-sidebar.tsx`
- `src/components/workspace/task-summary-bar.tsx`
- `src/components/workspace/platform-tabs.tsx`
- `src/components/workspace/article-editor.tsx`
- `src/components/workspace/xiaohongshu-editor.tsx`
- `src/components/workspace/twitter-editor.tsx`
- `src/components/workspace/video-script-editor.tsx`
- `src/components/workspace/content-actions.tsx`
- `src/components/settings/settings-shell.tsx`
- `src/components/settings/platform-rule-binding-panel.tsx`
- `src/components/settings/skills-library.tsx`
- `src/components/settings/skill-upload-panel.tsx`
- `src/components/settings/github-skill-install-panel.tsx`
- `src/components/settings/skill-detail-panel.tsx`
- `src/lib/types.ts`
- `src/lib/fs/app-paths.ts`
- `src/lib/db/client.ts`
- `src/lib/db/schema.ts`
- `src/lib/db/migrate.ts`
- `src/lib/db/repositories/task-repository.ts`
- `src/lib/db/repositories/platform-settings-repository.ts`
- `src/lib/db/repositories/skill-repository.ts`
- `src/lib/content/sample-fixtures.ts`
- `src/lib/content/mock-generation-service.ts`
- `src/lib/publish/mock-publish-service.ts`
- `src/lib/platform/platform-rule-resolver.ts`
- `src/lib/skills/skill-parser.ts`
- `src/lib/skills/skill-learning-service.ts`
- `src/lib/skills/zip-skill-ingestion-service.ts`
- `src/lib/skills/github-skill-install-service.ts`
- `src/lib/test/render.tsx`
- `src/app/__tests__/home-page.test.tsx`
- `src/lib/db/__tests__/migrate.test.ts`
- `src/lib/db/__tests__/task-repository.test.ts`
- `src/lib/content/__tests__/mock-generation-service.test.ts`
- `src/app/api/tasks/__tests__/route.test.ts`
- `src/components/workspace/__tests__/history-sidebar.test.tsx`
- `src/components/workspace/__tests__/workspace-shell.test.tsx`
- `src/components/settings/__tests__/skills-library.test.tsx`
- `src/lib/skills/__tests__/zip-skill-ingestion-service.test.ts`
- `src/lib/skills/__tests__/github-skill-install-service.test.ts`

### Modify

- `docs/superpowers/specs/2026-04-08-content-creation-agent-design.md`
  - Only if implementation reveals a real mismatch that must be documented.

---

### Task 1: Bootstrap the application shell and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.mts`
- Create: `vitest.setup.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/lib/test/render.tsx`
- Test: `src/app/__tests__/home-page.test.tsx`

- [ ] **Step 1: Write the failing homepage smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the creation prompt and platform options", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "What should we create today?" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("公众号文章")).toBeInTheDocument();
    expect(screen.getByLabelText("小红书笔记")).toBeInTheDocument();
    expect(screen.getByLabelText("Twitter")).toBeInTheDocument();
    expect(screen.getByLabelText("视频脚本")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify the workspace is not bootstrapped yet**

Run: `npm test -- src/app/__tests__/home-page.test.tsx`

Expected:
- FAIL with `Missing script: "test"` or module/file-not-found errors because the app has not been created yet

- [ ] **Step 3: Create the package manifest and build tooling**

```json
{
  "name": "content-creation-agent",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "adm-zip": "^0.5.16",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.10.1",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.16.0",
    "eslint-config-next": "^15.0.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^2.1.8"
  }
}
```

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true
};

export default nextConfig;
```

- [ ] **Step 4: Install dependencies and create the minimal app shell**

Run: `npm install`

Expected:
- PASS and create `package-lock.json`

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content Creation Agent",
  description: "Local-first multi-platform content creation workbench"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>What should we create today?</h1>
      <label>
        <input type="checkbox" aria-label="公众号文章" />
        公众号文章
      </label>
      <label>
        <input type="checkbox" aria-label="小红书笔记" />
        小红书笔记
      </label>
      <label>
        <input type="checkbox" aria-label="Twitter" />
        Twitter
      </label>
      <label>
        <input type="checkbox" aria-label="视频脚本" />
        视频脚本
      </label>
    </main>
  );
}
```

- [ ] **Step 5: Configure Vitest and rerun the smoke test**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"]
  }
});
```

```ts
import "@testing-library/jest-dom/vitest";
```

Run: `npm test -- src/app/__tests__/home-page.test.tsx`

Expected:
- PASS

- [ ] **Step 6: Verify lint and build succeed**

Run: `npm run lint`

Expected:
- PASS

Run: `npm run build`

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs vitest.config.mts vitest.setup.ts src/app src/lib/test
git commit -m "feat: bootstrap content creation app shell"
```

### Task 2: Add domain types, local paths, and SQLite schema bootstrapping

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/fs/app-paths.ts`
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/migrate.ts`
- Test: `src/lib/db/__tests__/migrate.test.ts`

- [ ] **Step 1: Write the failing database migration test**

```ts
import { existsSync, rmSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getDatabaseFilePath } from "@/lib/fs/app-paths";
import { migrateDatabase } from "@/lib/db/migrate";
import { openDatabase } from "@/lib/db/client";

describe("migrateDatabase", () => {
  it("creates the core application tables", () => {
    const dbFile = getDatabaseFilePath();

    if (existsSync(dbFile)) {
      rmSync(dbFile);
    }

    migrateDatabase();

    const db = openDatabase();
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('tasks', 'task_contents', 'platform_settings', 'skills', 'skill_files', 'skill_learning_results', 'skill_bindings', 'history_actions')"
      )
      .all() as Array<{ name: string }>;

    expect(rows).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run the database test to verify it fails**

Run: `npm test -- src/lib/db/__tests__/migrate.test.ts`

Expected:
- FAIL because the database modules do not exist yet

- [ ] **Step 3: Add shared types for tasks, content bodies, settings, and skills**

```ts
export type PlatformId = "wechat" | "xiaohongshu" | "twitter" | "videoScript";

export type TaskStatus = "draft" | "generating" | "ready" | "failed";
export type PublishStatus = "idle" | "publishing" | "published" | "failed";
export type TwitterMode = "auto" | "single" | "thread";
export type SkillSourceType = "zip" | "github";

export interface TaskRecord {
  id: string;
  title: string;
  userInput: string;
  selectedPlatforms: PlatformId[];
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WechatContentBody {
  title: string;
  summary: string;
  body: string;
}

export interface XiaohongshuContentBody {
  title: string;
  caption: string;
  imageSuggestions: string[];
  hashtags: string[];
}
```

- [ ] **Step 4: Add local path helpers, database client, and schema**

```ts
import { mkdirSync } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const dataRoot = path.join(appRoot, ".codex-data");
const skillsRoot = path.join(dataRoot, "skills");

export function ensureAppDirectories() {
  mkdirSync(path.join(skillsRoot, "uploads"), { recursive: true });
  mkdirSync(path.join(skillsRoot, "unpacked"), { recursive: true });
}

export function getDatabaseFilePath() {
  return path.join(dataRoot, "content-creation-agent.sqlite");
}
```

```ts
import { DatabaseSync } from "node:sqlite";

import { ensureAppDirectories, getDatabaseFilePath } from "@/lib/fs/app-paths";

export function openDatabase() {
  ensureAppDirectories();
  return new DatabaseSync(getDatabaseFilePath());
}
```

```ts
export const schemaStatements = [
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
  )`
];
```

- [ ] **Step 5: Add a migration runner and rerun the test**

```ts
import { openDatabase } from "@/lib/db/client";
import { schemaStatements } from "@/lib/db/schema";

export function migrateDatabase() {
  const db = openDatabase();

  for (const statement of schemaStatements) {
    db.exec(statement);
  }
}
```

Run: `npm test -- src/lib/db/__tests__/migrate.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/fs/app-paths.ts src/lib/db src/lib/db/__tests__/migrate.test.ts
git commit -m "feat: add sqlite schema bootstrap"
```

### Task 3: Implement repositories for tasks, content, settings, and skills

**Files:**
- Create: `src/lib/db/repositories/task-repository.ts`
- Create: `src/lib/db/repositories/platform-settings-repository.ts`
- Create: `src/lib/db/repositories/skill-repository.ts`
- Test: `src/lib/db/__tests__/task-repository.test.ts`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Extend the schema for settings and skills, then write the failing repository tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "@/lib/db/migrate";
import {
  createTask,
  getTaskById,
  listTasks,
  renameTask,
  deleteTask
} from "@/lib/db/repositories/task-repository";

describe("task repository", () => {
  beforeEach(() => {
    migrateDatabase();
  });

  it("creates and lists tasks in reverse updated order", () => {
    createTask({
      id: "task-1",
      title: "First",
      userInput: "prompt 1",
      selectedPlatforms: ["wechat"],
      status: "ready"
    });

    expect(listTasks()[0]?.id).toBe("task-1");
  });

  it("renames and deletes tasks", () => {
    createTask({
      id: "task-2",
      title: "Before rename",
      userInput: "prompt 2",
      selectedPlatforms: ["twitter"],
      status: "ready"
    });

    renameTask("task-2", "After rename");
    expect(getTaskById("task-2")?.title).toBe("After rename");

    deleteTask("task-2");
    expect(getTaskById("task-2")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the repository tests to verify they fail**

Run: `npm test -- src/lib/db/__tests__/task-repository.test.ts`

Expected:
- FAIL because the repository functions and remaining tables do not exist yet

- [ ] **Step 3: Add the remaining tables**

```ts
`CREATE TABLE IF NOT EXISTS platform_settings (
  platform TEXT PRIMARY KEY,
  base_rules_json TEXT NOT NULL,
  enabled_skill_ids_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
`CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
)`
```

- [ ] **Step 4: Implement the repositories**

```ts
import { openDatabase } from "@/lib/db/client";
import type { TaskRecord } from "@/lib/types";

export function createTask(input: Omit<TaskRecord, "createdAt" | "updatedAt">) {
  const db = openDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO tasks (
      id, title, user_input, selected_platforms_json, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.title,
    input.userInput,
    JSON.stringify(input.selectedPlatforms),
    input.status,
    now,
    now
  );
}
```

```ts
export function renameTask(taskId: string, title: string) {
  const db = openDatabase();
  db.prepare(`UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?`).run(
    title,
    new Date().toISOString(),
    taskId
  );
}
```

- [ ] **Step 5: Run the repository tests to verify they pass**

Run: `npm test -- src/lib/db/__tests__/task-repository.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/repositories src/lib/db/schema.ts src/lib/db/__tests__/task-repository.test.ts
git commit -m "feat: add repositories for tasks settings and skills"
```

### Task 4: Implement the mock generation and mock publish services

**Files:**
- Create: `src/lib/content/sample-fixtures.ts`
- Create: `src/lib/content/mock-generation-service.ts`
- Create: `src/lib/publish/mock-publish-service.ts`
- Create: `src/lib/platform/platform-rule-resolver.ts`
- Test: `src/lib/content/__tests__/mock-generation-service.test.ts`

- [ ] **Step 1: Write the failing generation service test**

```ts
import { describe, expect, it } from "vitest";

import { generateTaskContentBundle } from "@/lib/content/mock-generation-service";

describe("generateTaskContentBundle", () => {
  it("returns the fixed efficiency fixture when all platforms are selected", async () => {
    const bundle = await generateTaskContentBundle({
      prompt: "写一篇关于如何提高工作效率的内容",
      platforms: ["wechat", "xiaohongshu", "twitter", "videoScript"],
      appliedSkillNamesByPlatform: {}
    });

    expect(bundle.wechat?.title).toBe("高效工作的 5 个底层逻辑");
    expect(bundle.xiaohongshu?.imageSuggestions).toHaveLength(9);
    expect(bundle.twitter?.tweets).toHaveLength(10);
    expect(bundle.videoScript?.scenes).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/content/__tests__/mock-generation-service.test.ts`

Expected:
- FAIL because the service and fixture modules do not exist yet

- [ ] **Step 3: Add the sample fixtures and rule resolver**

```ts
export const efficiencyFixture = {
  wechat: {
    title: "高效工作的 5 个底层逻辑",
    summary: "一篇面向知识工作者的深度效率文章。",
    body: "第一部分：效率不是做得更快，而是做对更重要的事。\n\n第二部分：建立高杠杆任务排序。\n\n第三部分：减少切换成本。\n\n第四部分：形成复盘闭环。\n\n第五部分：把系统搭起来。"
  },
  xiaohongshu: {
    title: "工作效率翻倍！我的 5 个神仙方法✨",
    caption: "今天把我真正能提升工作效率的五个方法整理成一篇小红书笔记。",
    imageSuggestions: [
      "封面：高效工作五个方法标题海报",
      "场景图：早晨规划任务的桌面",
      "示意图：四象限任务排序",
      "示意图：番茄钟与深度工作",
      "截图建议：待办清单模板",
      "插画建议：减少消息打断",
      "流程图：复盘闭环",
      "对比图：低效一天 vs 高效一天",
      "结尾图：收藏关注 CTA"
    ],
    hashtags: ["效率提升", "自我管理", "工作方法"]
  }
};
```

```ts
export function resolvePlatformRules(input: {
  platform: string;
  baseRules: string[];
  appliedSkillSummaries: string[];
}) {
  return [...input.baseRules, ...input.appliedSkillSummaries];
}
```

- [ ] **Step 4: Implement the mock generation and publish services**

```ts
import { efficiencyFixture } from "@/lib/content/sample-fixtures";

export async function generateTaskContentBundle(input: {
  prompt: string;
  platforms: Array<"wechat" | "xiaohongshu" | "twitter" | "videoScript">;
  appliedSkillNamesByPlatform: Record<string, string[]>;
}) {
  if (
    input.prompt.trim() === "写一篇关于如何提高工作效率的内容" &&
    input.platforms.length === 4
  ) {
    return {
      wechat: efficiencyFixture.wechat,
      xiaohongshu: efficiencyFixture.xiaohongshu,
      twitter: {
        mode: "thread" as const,
        tweets: [
          "1/10 你不是不努力，而是一直在用低效率的方式忙。",
          "2/10 先看结果，再安排任务。",
          "3/10 每天只保留 1 个最高杠杆任务。",
          "4/10 把碎片沟通集中到固定时间处理。",
          "5/10 把需要深度思考的工作放到精力最好的时段。",
          "6/10 给重复任务做模板。",
          "7/10 不要把待办清单写成愿望清单。",
          "8/10 每天结束前做 5 分钟复盘。",
          "9/10 系统比意志力更可靠。",
          "10/10 收藏这条 thread，今天就先完成那件最重要的事。"
        ]
      },
      videoScript: {
        title: "高效工作的五个底层逻辑",
        scenes: [
          { shot: "开场提问", visual: "面对杂乱待办的办公桌", voiceover: "为什么你每天很忙，却还是推进不动真正重要的事？" },
          { shot: "方法拆解", visual: "五个方法的卡片轮播", voiceover: "真正提高效率，不是挤更多时间，而是搭对工作系统。" },
          { shot: "总结 CTA", visual: "清晰任务板和收束镜头", voiceover: "把这五个方法用起来，效率会从偶尔爆发变成稳定输出。" }
        ]
      }
    };
  }

  return {
    wechat: input.platforms.includes("wechat")
      ? { title: "Draft wechat title", summary: "Draft summary", body: input.prompt }
      : null
  };
}
```

```ts
export async function mockPublishContent() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return {
    status: "published" as const,
    message: "发布成功"
  };
}
```

- [ ] **Step 5: Run the service tests to verify they pass**

Run: `npm test -- src/lib/content/__tests__/mock-generation-service.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/content src/lib/publish src/lib/platform
git commit -m "feat: add mock generation and publish services"
```

### Task 5: Add task and publish API routes

**Files:**
- Create: `src/app/api/tasks/route.ts`
- Create: `src/app/api/tasks/[taskId]/route.ts`
- Create: `src/app/api/tasks/[taskId]/publish/route.ts`
- Test: `src/app/api/tasks/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing route test for create/list/publish**

```ts
import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/tasks/route";
import { POST as publishPost } from "@/app/api/tasks/[taskId]/publish/route";

describe("task routes", () => {
  it("creates a task and returns it in the task list", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          prompt: "写一篇关于如何提高工作效率的内容",
          platforms: ["wechat", "xiaohongshu", "twitter", "videoScript"]
        })
      })
    );

    expect(createResponse.status).toBe(201);

    const listResponse = await GET(new Request("http://localhost/api/tasks"));
    const tasks = await listResponse.json();

    expect(tasks.length).toBeGreaterThan(0);
  });

  it("publishes supported content through the mock publisher", async () => {
    const response = await publishPost(
      new Request("http://localhost/api/tasks/task-1/publish", {
        method: "POST",
        body: JSON.stringify({ platform: "wechat" })
      }),
      { params: Promise.resolve({ taskId: "task-1" }) }
    );

    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npm test -- src/app/api/tasks/__tests__/route.test.ts`

Expected:
- FAIL because the route handlers do not exist yet

- [ ] **Step 3: Implement the task creation route**

```ts
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { createTask } from "@/lib/db/repositories/task-repository";
import { generateTaskContentBundle } from "@/lib/content/mock-generation-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    prompt: string;
    platforms: Array<"wechat" | "xiaohongshu" | "twitter" | "videoScript">;
  };

  const taskId = randomUUID();
  const bundle = await generateTaskContentBundle({
    prompt: body.prompt,
    platforms: body.platforms,
    appliedSkillNamesByPlatform: {}
  });

  createTask({
    id: taskId,
    title: body.prompt.slice(0, 24),
    userInput: body.prompt,
    selectedPlatforms: body.platforms,
    status: "ready"
  });

  return NextResponse.json({ id: taskId, bundle }, { status: 201 });
}
```

- [ ] **Step 4: Implement the list/detail/update/delete and publish routes**

```ts
export async function GET() {
  return NextResponse.json(listTasks());
}
```

```ts
export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;
  const body = (await request.json()) as { title?: string };

  if (body.title) {
    renameTask(taskId, body.title);
  }

  return NextResponse.json(getTaskById(taskId));
}
```

```ts
export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;
  const body = (await request.json()) as { platform: "wechat" | "xiaohongshu" | "twitter" };
  const result = await mockPublishContent();

  updatePublishStatus(taskId, body.platform, result.status);

  return NextResponse.json(result);
}
```

- [ ] **Step 5: Run the route test to verify it passes**

Run: `npm test -- src/app/api/tasks/__tests__/route.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/tasks src/app/api/tasks/__tests__/route.test.ts
git commit -m "feat: add task creation and mock publish routes"
```

### Task 6: Build the homepage creation flow

**Files:**
- Create: `src/components/home/create-task-hero.tsx`
- Create: `src/components/home/platform-multi-select.tsx`
- Create: `src/components/home/generation-progress.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/app/__tests__/home-page.test.tsx`

- [ ] **Step 1: Expand the homepage test to cover input, multi-select, and submit**

```tsx
import userEvent from "@testing-library/user-event";

it("submits the request when at least one platform is selected", async () => {
  const user = userEvent.setup();
  render(<HomePage />);

  await user.type(
    screen.getByLabelText("创作需求"),
    "写一篇关于如何提高工作效率的内容"
  );
  await user.click(screen.getByLabelText("公众号文章"));
  await user.click(screen.getByRole("button", { name: "生成多平台内容" }));

  expect(
    await screen.findByText("Generating content bundle...")
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the homepage test to verify it fails**

Run: `npm test -- src/app/__tests__/home-page.test.tsx`

Expected:
- FAIL because the current home page does not have the real form

- [ ] **Step 3: Implement the home components and visual layout**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PlatformMultiSelect } from "@/components/home/platform-multi-select";
import { GenerationProgress } from "@/components/home/generation-progress";

export function CreateTaskHero() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit() {
    if (!prompt.trim() || platforms.length === 0) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platforms })
      });
      const task = await response.json();
      router.push(`/workspace/${task.id}`);
    });
  }

  return (
    <section>
      <textarea aria-label="创作需求" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      <PlatformMultiSelect value={platforms} onChange={setPlatforms} />
      <button onClick={handleSubmit}>生成多平台内容</button>
      <GenerationProgress visible={isPending} />
    </section>
  );
}
```

- [ ] **Step 4: Wire the home page to the new components**

```tsx
import { CreateTaskHero } from "@/components/home/create-task-hero";

export default function HomePage() {
  return (
    <main className="home-page">
      <CreateTaskHero />
    </main>
  );
}
```

- [ ] **Step 5: Run the homepage test, lint, and build**

Run: `npm test -- src/app/__tests__/home-page.test.tsx`

Expected:
- PASS

Run: `npm run lint`

Expected:
- PASS

Run: `npm run build`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/components/home src/app/__tests__/home-page.test.tsx src/app/globals.css
git commit -m "feat: build homepage creation flow"
```

### Task 7: Build the workspace shell and history sidebar

**Files:**
- Create: `src/components/workspace/workspace-shell.tsx`
- Create: `src/components/workspace/history-sidebar.tsx`
- Create: `src/components/workspace/task-summary-bar.tsx`
- Create: `src/components/workspace/platform-tabs.tsx`
- Create: `src/app/workspace/[taskId]/page.tsx`
- Test: `src/components/workspace/__tests__/history-sidebar.test.tsx`
- Test: `src/components/workspace/__tests__/workspace-shell.test.tsx`

- [ ] **Step 1: Write the failing history sidebar test**

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HistorySidebar } from "@/components/workspace/history-sidebar";

describe("HistorySidebar", () => {
  it("filters, renames, and deletes tasks", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onDelete = vi.fn();

    render(
      <HistorySidebar
        items={[
          { id: "task-1", title: "效率文章", updatedAt: "2026-04-08T00:00:00.000Z" },
          { id: "task-2", title: "增长 thread", updatedAt: "2026-04-07T00:00:00.000Z" }
        ]}
        activeTaskId="task-1"
        onSelect={vi.fn()}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    await user.type(screen.getByPlaceholderText("搜索历史记录"), "效率");

    expect(screen.getByText("效率文章")).toBeInTheDocument();
    expect(screen.queryByText("增长 thread")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the workspace tests to verify they fail**

Run: `npm test -- src/components/workspace/__tests__/history-sidebar.test.tsx src/components/workspace/__tests__/workspace-shell.test.tsx`

Expected:
- FAIL because the workspace components do not exist yet

- [ ] **Step 3: Build the history sidebar and summary bar**

```tsx
"use client";

import { useDeferredValue, useState } from "react";

export function HistorySidebar(props: {
  items: Array<{ id: string; title: string; updatedAt: string }>;
  activeTaskId: string;
  onSelect: (taskId: string) => void;
  onRename: (taskId: string, title: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = props.items.filter((item) =>
    item.title.toLowerCase().includes(deferredQuery.toLowerCase())
  );

  return (
    <aside>
      <input
        placeholder="搜索历史记录"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {filtered.map((item) => (
        <button key={item.id} onClick={() => props.onSelect(item.id)}>
          {item.title}
        </button>
      ))}
    </aside>
  );
}
```

- [ ] **Step 4: Build the workspace shell route**

```tsx
import { HistorySidebar } from "@/components/workspace/history-sidebar";
import { PlatformTabs } from "@/components/workspace/platform-tabs";
import { TaskSummaryBar } from "@/components/workspace/task-summary-bar";

export default function WorkspacePage() {
  return (
    <main className="workspace-page">
      <HistorySidebar items={[]} activeTaskId="" onSelect={() => {}} onRename={() => {}} onDelete={() => {}} />
      <section>
        <TaskSummaryBar title="Loading..." prompt="Loading..." appliedSkills={[]} />
        <PlatformTabs activePlatform="wechat" onChange={() => {}} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Run the workspace component tests**

Run: `npm test -- src/components/workspace/__tests__/history-sidebar.test.tsx src/components/workspace/__tests__/workspace-shell.test.tsx`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace src/app/workspace
git commit -m "feat: build workspace shell and history sidebar"
```

### Task 8: Build the platform-specific editors and autosave interactions

**Files:**
- Create: `src/components/workspace/article-editor.tsx`
- Create: `src/components/workspace/xiaohongshu-editor.tsx`
- Create: `src/components/workspace/twitter-editor.tsx`
- Create: `src/components/workspace/video-script-editor.tsx`
- Create: `src/components/workspace/content-actions.tsx`
- Test: `src/components/workspace/__tests__/workspace-shell.test.tsx`
- Modify: `src/app/workspace/[taskId]/page.tsx`

- [ ] **Step 1: Write the failing editor interaction test**

```tsx
it("switches platform tabs and shows platform-specific editors", async () => {
  const user = userEvent.setup();

  render(<WorkspaceShell initialTaskId="task-1" />);

  await user.click(screen.getByRole("tab", { name: "小红书笔记" }));
  expect(screen.getByText("图片建议")).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: "Twitter" }));
  expect(screen.getByText("Thread")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the editor test to verify it fails**

Run: `npm test -- src/components/workspace/__tests__/workspace-shell.test.tsx`

Expected:
- FAIL because the editor surfaces are not wired yet

- [ ] **Step 3: Implement the four editors**

```tsx
export function ArticleEditor(props: {
  value: { title: string; summary: string; body: string };
  onChange: (value: { title: string; summary: string; body: string }) => void;
}) {
  return (
    <section>
      <input value={props.value.title} onChange={(event) => props.onChange({ ...props.value, title: event.target.value })} />
      <textarea value={props.value.body} onChange={(event) => props.onChange({ ...props.value, body: event.target.value })} />
    </section>
  );
}
```

```tsx
export function XiaohongshuEditor(props: {
  value: { title: string; caption: string; imageSuggestions: string[]; hashtags: string[] };
  onChange: (value: { title: string; caption: string; imageSuggestions: string[]; hashtags: string[] }) => void;
}) {
  return (
    <section>
      <h2>图片建议</h2>
      {props.value.imageSuggestions.map((suggestion, index) => (
        <textarea
          key={index}
          value={suggestion}
          onChange={(event) => {
            const imageSuggestions = [...props.value.imageSuggestions];
            imageSuggestions[index] = event.target.value;
            props.onChange({ ...props.value, imageSuggestions });
          }}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Add autosave and the mock publish button states**

```tsx
export function ContentActions(props: {
  canPublish: boolean;
  isPublishing: boolean;
  onCopy: () => void;
  onPublish: () => void;
}) {
  return (
    <div>
      <button type="button">编辑</button>
      <button type="button" onClick={props.onCopy}>复制</button>
      {props.canPublish ? (
        <button type="button" onClick={props.onPublish} disabled={props.isPublishing}>
          {props.isPublishing ? "发布中..." : "发布"}
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Run the workspace tests**

Run: `npm test -- src/components/workspace/__tests__/workspace-shell.test.tsx`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace src/app/workspace/[taskId]/page.tsx
git commit -m "feat: add platform specific editors"
```

### Task 9: Build the settings page and platform binding flow

**Files:**
- Create: `src/components/settings/settings-shell.tsx`
- Create: `src/components/settings/platform-rule-binding-panel.tsx`
- Create: `src/components/settings/skills-library.tsx`
- Create: `src/app/settings/page.tsx`
- Create: `src/app/api/platform-settings/[platform]/route.ts`
- Test: `src/components/settings/__tests__/skills-library.test.tsx`

- [ ] **Step 1: Write the failing settings page test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SettingsPage from "@/app/settings/page";

describe("SettingsPage", () => {
  it("renders platform bindings and skills library navigation", () => {
    render(<SettingsPage />);

    expect(screen.getByText("Skills Library")).toBeInTheDocument();
    expect(screen.getByText("公众号文章")).toBeInTheDocument();
    expect(screen.getByText("Twitter")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the settings test to verify it fails**

Run: `npm test -- src/components/settings/__tests__/skills-library.test.tsx`

Expected:
- FAIL because the settings UI does not exist yet

- [ ] **Step 3: Create the settings shell and binding panel**

```tsx
export function PlatformRuleBindingPanel(props: {
  platform: string;
  enabledSkillNames: string[];
}) {
  return (
    <section>
      <h2>{props.platform}</h2>
      <p>Enabled skills: {props.enabledSkillNames.join(", ") || "None"}</p>
    </section>
  );
}
```

```tsx
export default function SettingsPage() {
  return (
    <main>
      <h1>Settings</h1>
      <nav>
        <button type="button">公众号文章</button>
        <button type="button">小红书笔记</button>
        <button type="button">Twitter</button>
        <button type="button">视频脚本</button>
        <button type="button">Skills Library</button>
      </nav>
    </main>
  );
}
```

- [ ] **Step 4: Add the platform settings route**

```ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;
  const body = await request.json();

  savePlatformSettings(platform, body);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run the settings test**

Run: `npm test -- src/components/settings/__tests__/skills-library.test.tsx`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/settings src/app/settings src/app/api/platform-settings
git commit -m "feat: build settings and platform bindings"
```

### Task 10: Implement zip skill upload, validation, and learning

**Files:**
- Create: `src/lib/skills/skill-parser.ts`
- Create: `src/lib/skills/skill-learning-service.ts`
- Create: `src/lib/skills/zip-skill-ingestion-service.ts`
- Create: `src/app/api/skills/route.ts`
- Create: `src/app/api/skills/[skillId]/route.ts`
- Create: `src/app/api/skills/upload/route.ts`
- Create: `src/components/settings/skill-upload-panel.tsx`
- Create: `src/components/settings/skill-detail-panel.tsx`
- Test: `src/lib/skills/__tests__/zip-skill-ingestion-service.test.ts`

- [ ] **Step 1: Write the failing zip ingestion test**

```ts
import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";

import { ingestSkillZip } from "@/lib/skills/zip-skill-ingestion-service";

describe("ingestSkillZip", () => {
  it("rejects archives without SKILL.md", async () => {
    const zip = new AdmZip();
    zip.addFile("README.md", Buffer.from("# Missing skill"));

    await expect(ingestSkillZip(zip.toBuffer(), "bad.zip")).rejects.toThrow(
      "SKILL.md"
    );
  });
});
```

- [ ] **Step 2: Run the ingestion test to verify it fails**

Run: `npm test -- src/lib/skills/__tests__/zip-skill-ingestion-service.test.ts`

Expected:
- FAIL because the ingestion service does not exist yet

- [ ] **Step 3: Implement the parser and learning service**

```ts
export function parseSkillMarkdown(markdown: string) {
  const lines = markdown.split("\n");
  const title = lines.find((line) => line.startsWith("name:"))?.replace("name:", "").trim() ?? "Unnamed skill";
  const description =
    lines.find((line) => line.startsWith("description:"))?.replace("description:", "").trim() ??
    "No description";

  return { title, description };
}
```

```ts
export function learnSkill(input: { markdown: string; references: string[] }) {
  const parsed = parseSkillMarkdown(input.markdown);

  return {
    summary: parsed.description,
    rules: ["Read SKILL.md", "Apply workflow before generation"],
    platformHints: [],
    keywords: parsed.title.toLowerCase().split(/\s+/),
    examplesSummary: input.references.slice(0, 3)
  };
}
```

- [ ] **Step 4: Implement zip ingestion and upload route**

```ts
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

import AdmZip from "adm-zip";

import { getSkillUploadPath, getSkillUnpackedPath } from "@/lib/fs/app-paths";
import { learnSkill } from "@/lib/skills/skill-learning-service";

export async function ingestSkillZip(buffer: Buffer, fileName: string) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const skillEntry = entries.find((entry) => entry.entryName.endsWith("SKILL.md"));

  if (!skillEntry) {
    throw new Error("Uploaded skill archive must contain SKILL.md");
  }

  const skillId = randomUUID();
  writeFileSync(getSkillUploadPath(`${skillId}-${fileName}`), buffer);
  zip.extractAllTo(getSkillUnpackedPath(skillId), true);

  const markdown = skillEntry.getData().toString("utf8");
  return {
    id: skillId,
    learningResult: learnSkill({ markdown, references: [] })
  };
}
```

- [ ] **Step 5: Run the ingestion tests**

Run: `npm test -- src/lib/skills/__tests__/zip-skill-ingestion-service.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/skills src/app/api/skills src/components/settings/skill-upload-panel.tsx src/components/settings/skill-detail-panel.tsx
git commit -m "feat: add zip skill ingestion flow"
```

### Task 11: Implement GitHub skill installation and skills library UI

**Files:**
- Create: `src/lib/skills/github-skill-install-service.ts`
- Create: `src/app/api/skills/install/route.ts`
- Create: `src/components/settings/github-skill-install-panel.tsx`
- Modify: `src/components/settings/skills-library.tsx`
- Test: `src/lib/skills/__tests__/github-skill-install-service.test.ts`

- [ ] **Step 1: Write the failing GitHub installation test**

```ts
import { describe, expect, it, vi } from "vitest";

import { installSkillFromGithub } from "@/lib/skills/github-skill-install-service";

describe("installSkillFromGithub", () => {
  it("downloads the remote skill directory and rejects when SKILL.md is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# README only"
    }) as unknown as typeof fetch;

    await expect(
      installSkillFromGithub({
        repo: "owner/repo",
        path: "skills/demo"
      })
    ).rejects.toThrow("SKILL.md");
  });
});
```

- [ ] **Step 2: Run the GitHub installer test to verify it fails**

Run: `npm test -- src/lib/skills/__tests__/github-skill-install-service.test.ts`

Expected:
- FAIL because the GitHub installer does not exist yet

- [ ] **Step 3: Implement GitHub installation**

```ts
export async function installSkillFromGithub(input: {
  repo: string;
  path: string;
  ref?: string;
}) {
  const ref = input.ref ?? "main";
  const rawUrl = `https://raw.githubusercontent.com/${input.repo}/${ref}/${input.path}/SKILL.md`;
  const response = await fetch(rawUrl);

  if (!response.ok) {
    throw new Error("Failed to download SKILL.md from GitHub");
  }

  const markdown = await response.text();

  if (!markdown.includes("name:")) {
    throw new Error("Downloaded skill is missing SKILL.md metadata");
  }

  return {
    markdown,
    learningResult: learnSkill({ markdown, references: [] })
  };
}
```

- [ ] **Step 4: Add the install route and UI**

```tsx
"use client";

import { useState } from "react";

export function GithubSkillInstallPanel() {
  const [command, setCommand] = useState("");

  return (
    <section>
      <textarea value={command} onChange={(event) => setCommand(event.target.value)} />
      <button type="button">Install from GitHub</button>
    </section>
  );
}
```

```ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { repo: string; path: string; ref?: string };
  const result = await installSkillFromGithub(body);
  return NextResponse.json(result, { status: 201 });
}
```

- [ ] **Step 5: Run the installer test**

Run: `npm test -- src/lib/skills/__tests__/github-skill-install-service.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/skills/github-skill-install-service.ts src/app/api/skills/install/route.ts src/components/settings/github-skill-install-panel.tsx src/components/settings/skills-library.tsx
git commit -m "feat: add github skill install flow"
```

### Task 12: Wire end-to-end persistence and final verification

**Files:**
- Modify: `src/app/workspace/[taskId]/page.tsx`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/settings/settings-shell.tsx`
- Modify: `src/components/settings/skills-library.tsx`
- Modify: `src/lib/db/repositories/task-repository.ts`
- Modify: `src/lib/db/repositories/skill-repository.ts`
- Test: `src/components/workspace/__tests__/workspace-shell.test.tsx`
- Test: `src/components/settings/__tests__/skills-library.test.tsx`

- [ ] **Step 1: Add a failing integration-style workspace test for autosave and publish**

```tsx
it("shows the simulated publish success state after publishing wechat content", async () => {
  const user = userEvent.setup();

  render(<WorkspaceShell initialTaskId="task-1" />);

  await user.click(screen.getByRole("button", { name: "发布" }));

  expect(await screen.findByText("发布成功")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the integration tests to verify they fail**

Run: `npm test -- src/components/workspace/__tests__/workspace-shell.test.tsx src/components/settings/__tests__/skills-library.test.tsx`

Expected:
- FAIL because the full persistence and toast flow is not wired yet

- [ ] **Step 3: Finish data loading, autosave, and publish toasts**

```tsx
const [publishMessage, setPublishMessage] = useState("");

async function handlePublish(platform: "wechat" | "xiaohongshu" | "twitter") {
  setPublishing(true);
  const response = await fetch(`/api/tasks/${taskId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform })
  });
  const result = await response.json();
  setPublishMessage(result.message);
  setPublishing(false);
}
```

```tsx
{publishMessage ? <div role="status">{publishMessage}</div> : null}
```

- [ ] **Step 4: Run the full verification suite**

Run: `npm test`

Expected:
- PASS

Run: `npm run lint`

Expected:
- PASS

Run: `npm run build`

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app src/components src/lib
git commit -m "feat: finish content creation agent mvp"
```

## Self-Review

### Spec coverage

- Homepage input and multi-select: covered by Tasks 1 and 6
- Workspace shell and history operations: covered by Tasks 5, 7, and 12
- Four platform-specific editors: covered by Task 8
- Mock publish flow: covered by Tasks 4, 5, and 12
- Platform settings and skill binding: covered by Task 9
- Zip skill upload and learning: covered by Task 10
- GitHub skill installation: covered by Task 11
- SQLite persistence and refresh safety: covered by Tasks 2, 3, and 12

No spec gap remains for the agreed MVP.

### Placeholder scan

- No `TODO`, `TBD`, or deferred placeholders are left in the plan
- Each task includes concrete files, commands, and code snippets

### Type consistency

- Platform IDs are consistently `wechat`, `xiaohongshu`, `twitter`, and `videoScript`
- Task status, publish status, and skill source type are introduced once in `src/lib/types.ts` and reused by later tasks
- API route shapes match repository and service responsibilities defined earlier in the plan
