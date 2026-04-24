# Content Creation and Distribution Agent

A production-oriented multi-platform AI content workspace built with Next.js and SQLite.

Supports generation, editing, export, and publish workflows for:

- WeChat article
- Xiaohongshu note
- Twitter (single/thread)
- Video script

## Core Features

- Unified task input and multi-platform generation
- Draft inbox, history sidebar, and content library
- Skills system:
  - ZIP upload
  - GitHub install
  - prompt skill
  - per-platform binding
- Xiaohongshu image generation and batch operations
- WeChat publish to draft box (OpenAPI)
- Xiaohongshu publish link + QR workflow (OpenAPI)
- Export:
  - Markdown
  - HTML
  - image package
  - video script document

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- SQLite (local file persistence)
- Vitest + Testing Library

## Prerequisites

- Node.js 20+
- npm 10+

## Quick Start

### 1) Clone

```powershell
git clone https://github.com/Selina2025-alt/Content-creation-and-distribution-agent.git
cd Content-creation-and-distribution-agent
```

### 2) Install dependencies

```powershell
npm install
```

### 3) Configure environment

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` with your own keys.

### 4) Run

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## Required Environment Variables

At minimum, set:

- `CONTENT_CREATION_AGENT_DATA_ROOT`
- `SILICONFLOW_API_KEY`

For publish capabilities:

- `WECHAT_OPENAPI_KEY`
- `XIAOHONGSHU_OPENAPI_KEY`

Optional model/base URL configs are documented in `.env.example`.

## Useful Commands

```powershell
npm run dev
npm run test
npm run lint
npm run build
npm run start
```

## Data Storage

By default, runtime data goes under:

```text
.codex-data/
```

Includes SQLite DB, generated assets, and skill artifacts.

## Security Notes

- Never commit real API keys.
- Keep secrets only in `.env.local` or CI secret settings.
- `.env.local`, build outputs, and local logs are ignored by `.gitignore`.

## Publish Notes

- WeChat: publish to **draft box**, not direct mass-send.
- Xiaohongshu: API creates a publish task and returns QR/link. Final account-side action is completed on mobile after scan.
