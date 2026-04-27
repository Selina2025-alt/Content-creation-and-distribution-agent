# Home Drafts And Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-draft inbox on the home page and a separate content library page for generated WeChat articles.

**Architecture:** Persist home drafts in SQLite through new draft repositories and API routes, then hydrate the home page client with autosaved drafts that can be restored into the prompt editor. Build the content library as a server-rendered page backed by task/task-content aggregation, and reuse the existing `history_actions` table for lightweight activity logging on generation and publish.

**Tech Stack:** Next.js App Router, React client components, `node:sqlite`, Vitest, Testing Library

---

### Task 1: Add persistent draft and activity data access

**Files:**
- Create: `src/lib/db/repositories/draft-repository.ts`
- Create: `src/lib/db/repositories/history-action-repository.ts`
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/types.ts`
- Test: `src/lib/db/__tests__/draft-repository.test.ts`
- Test: `src/lib/db/__tests__/history-action-repository.test.ts`

- [ ] **Step 1: Write the failing repository tests**
- [ ] **Step 2: Run the repository tests and confirm missing draft/activity behavior fails**
- [ ] **Step 3: Add draft/activity tables and repository helpers**
- [ ] **Step 4: Run the repository tests again and confirm they pass**

### Task 2: Expose drafts and library data through API/server helpers

**Files:**
- Create: `src/app/api/drafts/route.ts`
- Create: `src/app/api/drafts/[draftId]/route.ts`
- Create: `src/lib/library/wechat-library-service.ts`
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/api/tasks/[taskId]/publish/route.ts`
- Test: `src/app/api/drafts/__tests__/route.test.ts`
- Test: `src/lib/library/__tests__/wechat-library-service.test.ts`

- [ ] **Step 1: Write failing tests for draft CRUD and wechat library aggregation**
- [ ] **Step 2: Run those tests and verify they fail for the expected missing routes/helpers**
- [ ] **Step 3: Implement draft routes, task/publish activity logging, and wechat library aggregation**
- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

### Task 3: Add the home draft inbox UX

**Files:**
- Create: `src/components/home/draft-inbox.tsx`
- Modify: `src/components/home/create-task-hero.tsx`
- Modify: `src/app/__tests__/home-page.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing home-page tests for autosaved drafts and restoring a selected draft**
- [ ] **Step 2: Run the home-page tests and confirm the new expectations fail**
- [ ] **Step 3: Implement client-side draft loading, autosave, restore, rename/delete actions, and generate-from-draft behavior**
- [ ] **Step 4: Re-run the home-page tests and confirm they pass**

### Task 4: Add the WeChat content library page

**Files:**
- Create: `src/app/library/page.tsx`
- Create: `src/components/library/library-shell.tsx`
- Create: `src/components/library/__tests__/library-shell.test.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/workspace/task-summary-bar.tsx`
- Modify: `src/components/settings/settings-shell.tsx`

- [ ] **Step 1: Write a failing library component test for listing generated WeChat articles and recent activity**
- [ ] **Step 2: Run the library test and confirm it fails for the missing page/component**
- [ ] **Step 3: Implement the server page, library UI, and navigation entry points**
- [ ] **Step 4: Re-run the library test and confirm it passes**

### Task 5: Full verification

**Files:**
- Modify as needed based on the earlier tasks only

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Manually verify the home draft flow, generation flow, and `/library` page in the local preview**
