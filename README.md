# 内容创作与自动分发 Agent

基于 `Next.js 15 + SQLite` 的多平台内容创作工作台，支持公众号文章、小红书笔记、Twitter、视频脚本的生成、编辑、导出与发布流程。

## 核心能力

- 多平台内容生成与分栏工作台编辑
- 历史记录、草稿箱、内容库
- Skills 系统（ZIP 上传 / GitHub 安装 / Prompt 技能）
- 小红书配图生成与批量任务管理
- 公众号草稿箱发布（真实 OpenAPI）
- 小红书发布链路（真实 OpenAPI，返回二维码/发布链接）
- 导出：Markdown、HTML、图片包、视频脚本文档

## 本地运行

### 1. 安装依赖

```powershell
npm install
```

### 2. 配置环境变量

```powershell
Copy-Item .env.example .env.local
```

按需编辑 `.env.local`：

- 生成模型：
  - `SILICONFLOW_API_KEY`
  - `SILICONFLOW_TEXT_MODEL`
  - `SILICONFLOW_IMAGE_MODEL`
- 发布接口：
  - `WECHAT_OPENAPI_KEY`
  - `XIAOHONGSHU_OPENAPI_KEY`
- 本地数据目录：
  - `CONTENT_CREATION_AGENT_DATA_ROOT`

### 3. 启动开发环境

```powershell
npm run dev
```

访问：

```text
http://localhost:3000
```

## 常用命令

```powershell
npm run dev
npm run test
npm run lint
npm run build
npm run start
```

## 数据与文件

- SQLite 与运行时数据默认写入 `CONTENT_CREATION_AGENT_DATA_ROOT`（推荐 `.codex-data`）
- 图片、技能解包与发布相关缓存均在该目录下
- 请勿提交 `.env.local` 与本地日志

## 发布说明（当前实现）

- 公众号：发布到草稿箱（不是直接群发）
- 小红书：创建发布任务并返回二维码/链接，需要手机端扫码继续完成账号侧发布
