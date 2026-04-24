# 内容创作与自动分发 Agent 设计

## 背景

当前项目需要从零搭建一个面向内容团队的多平台内容创作 Agent。用户的核心诉求不是单平台写作，而是输入一次创作意图后，同时得到适配多个平台规则的内容产物，并且可以在一个统一工作台中查看、编辑、管理历史记录和执行发布动作。

这次设计聚焦第一阶段可落地的产品原型，优先保证以下几点：

- 主流程完整：输入需求 -> 生成多平台内容 -> 编辑 -> 历史记录回看 -> 模拟发布
- 平台差异真实可见：公众号、小红书、Twitter、视频脚本的编辑形态明显不同
- 技能系统可扩展：生成逻辑不是单一 prompt，而是支持上传或安装可读取的 skills，并绑定到平台参与生成
- 技术骨架真实：使用 Next.js 和 SQLite，数据可持久化，后续能平滑替换为真实模型调用和真实平台 API

## 目标

第一阶段完成一个本地优先的多平台内容创作工作台，满足以下能力：

1. 用户在首页通过一个大输入框输入创作需求，并多选目标平台
2. 系统生成公众号文章、小红书笔记、Twitter 内容和视频脚本，并写入本地 SQLite
3. 生成后进入工作台，以左侧历史记录、右侧多平台标签工作区的形式查看和编辑内容
4. 历史记录支持查看、搜索、重命名和删除
5. 发布按钮第一阶段为模拟发布，展示成功提示并记录状态，不接真实平台 API
6. 设置页支持为每个平台配置生成规则，并绑定本地已安装的 skills
7. 系统支持两种 skill 导入方式：
   - 上传 zip 技能包
   - 通过一句话从 GitHub 仓库安装 skill
8. skill 被导入后，系统会读取并学习 `SKILL.md` 内容，提炼规则和适用信息，并参与后续生成
9. 为样例输入提供稳定的示范性输出，保证演示时路径完整且结果可控

## 非目标

第一阶段不做以下内容：

- 不接真实公众号、小红书、Twitter 发布 API
- 不做用户登录、多账号、多租户
- 不做云端同步
- 不做 AI 图片真实生成
- 不做图片真实上传
- 不默认执行 skill 包中的脚本
- 不做模型训练或 embedding 检索系统
- 不做复杂富文本模板和高级排版块

## 产品定位

该系统第一阶段定位为一个 `本地优先的多平台内容创作工作台`，而不是完整的营销自动化平台。

它解决的是三个连续问题：

- 如何把用户一次输入的创作意图拆解成多个平台的内容任务
- 如何在一个统一工作台里管理这些平台产物
- 如何通过 skills 让不同平台的生成规则逐步积累为可复用的内容能力

## 用户与核心任务

### 目标用户

- 内容运营
- 新媒体编辑
- 个人创作者
- 小团队内容负责人

### 核心任务

1. 输入一个主题或需求，快速产出多平台适配内容
2. 在统一界面中编辑和比较不同平台版本
3. 回看历史创作任务并继续修改
4. 配置各平台的创作规则
5. 导入并复用专门的写作 skills

## 信息架构

系统包含三个一级页面：

### 1. 首页 `/`

用于接收创作需求和平台选择。

核心元素：

- 大输入框
- 平台多选组件
- 生成按钮
- 生成进度层

### 2. 工作台 `/workspace/[taskId]`

用于查看、编辑、复制、发布和管理当前任务。

核心结构：

- 左侧历史记录侧边栏
- 右侧平台内容工作区
- 顶部任务摘要与已应用 skills 展示
- 平台标签切换
- 平台专属编辑器
- 编辑 / 复制 / 发布操作区

### 3. 设置页 `/settings`

用于配置平台规则和 skill 资源库。

核心结构：

- 设置导航
- 平台规则与 skill 绑定
- Skills 资源库
- Skill 上传 / 仓库安装入口
- Skill 详情与学习结果面板

## 核心对象

系统内的核心对象固定为以下四类：

### 1. 创作任务 `Task`

代表用户的一次输入和对应的一组多平台输出。

### 2. 平台内容 `TaskContent`

代表某个任务在某个平台上的具体内容结果。

### 3. 技能 `Skill`

代表一个上传或安装到本地的技能包，至少包含 `SKILL.md`。

### 4. 平台配置 `PlatformSetting`

代表某个平台默认使用哪些规则和 skills。

## 页面级设计

### 首页

首页采用单一大输入框方案，不使用结构化表单作为主入口。

原因：

- 更符合“先表达意图，再由系统拆解”的产品定位
- 更接近用户心智，降低首次使用成本
- 与后续基于 skills 的动态生成链路更匹配

首页组件包括：

- `CreateTaskHero`
- `PlatformMultiSelect`
- `GenerationProgressOverlay`

交互规则：

- 输入不能为空
- 至少选择一个平台
- 点击生成后进入生成状态
- 生成成功后跳转到工作台

### 工作台

工作台采用左侧历史记录、右侧主内容区的布局。

#### 左侧历史记录

能力要求：

- 展示所有历史任务
- 支持搜索
- 支持点击切换查看
- 支持重命名
- 支持删除

#### 右侧主工作区

包含：

- 任务摘要栏
- 平台标签页
- 平台专属编辑器
- 操作按钮区

#### 操作按钮

- `编辑`
- `复制`
- `发布`

规则：

- `发布` 只在公众号、小红书、Twitter 中显示
- 视频脚本不显示发布按钮
- 发布第一阶段仅做模拟动作

### 设置页

设置页拆分成两块能力：

#### 1. 平台规则与 skill 绑定

每个平台都可以绑定多个 skills 参与生成。

第一阶段不再将设置页定义为“单个 prompt 编辑器”，而是定义为规则组合入口，至少包括：

- 平台基础规则
- 已绑定 skills
- 是否启用某个 skill

#### 2. Skills 资源库

资源库能力包括：

- 技能列表
- zip 上传入口
- GitHub 仓库安装入口
- 技能详情
- 学习结果展示
- 绑定平台
- 删除与重新解析

## 平台差异化设计

### 公众号文章

使用标准富文本长文编辑器。

第一阶段编辑能力：

- 标题
- 正文
- 加粗
- 引用
- 分隔线
- 图片占位

暂不包含：

- 图片真实上传
- 模板库
- 复杂图文排版块

### 小红书笔记

编辑器分为上下两区：

- 上方：最多 9 张图片占位与配图建议
- 下方：标题与约 500 字正文编辑区

第一阶段支持：

- 9 图占位
- 每张图的建议描述
- 文案编辑
- 标签建议

后续可扩展：

- AI 出图
- 本地图片上传

### Twitter

Twitter 编辑器支持三种模式：

- 自动判断
- 单条推文
- Thread

规则：

- 系统默认根据内容长度自动判断
- 用户可以手动切换
- Thread 模式按多条卡片展示并可编辑

### 视频脚本

视频脚本采用标准文本编辑器，但内部结构区分：

- 分镜区
- 旁白区

第一阶段默认以 3 分钟短视频脚本为目标。

## 技能系统设计

### Skill 导入方式

第一阶段支持两种入口：

#### 1. 上传 zip 技能包

约束：

- 压缩包根目录必须存在 `SKILL.md`

处理流程：

1. 上传 zip
2. 解压到本地目录
3. 校验 `SKILL.md`
4. 读取 `SKILL.md`
5. 读取必要的 references
6. 提炼规则、摘要、适用平台、关键词
7. 写入本地 skill 库

#### 2. 一句话从 GitHub 仓库安装

第一阶段只支持 GitHub。

用户输入示例：

- `请帮我安装 openai/skills 仓库里的 xxx 技能`
- `请帮我安装 owner/repo 中 path/to/skill 这个技能`

处理流程：

1. 解析仓库与路径
2. 下载对应目录
3. 校验 `SKILL.md`
4. 写入本地 skill 库
5. 执行和 zip 上传一致的学习流程

### Skill 学习定义

第一阶段的“学习”严格定义为：

- 读取 `SKILL.md`
- 读取必要的参考文件
- 提炼规则、摘要、适用平台、输出风格
- 建立本地索引
- 在生成时作为可调用规则参与内容生成

不包含：

- 模型训练
- 自动执行脚本

### Skill 使用方式

技能先进入技能库，再绑定到平台设置中。

生成流程中，系统会：

1. 读取用户输入
2. 读取目标平台
3. 读取该平台已绑定的 skills
4. 将 skill 规则与平台基础规则合并
5. 组装为生成上下文
6. 产出平台内容

工作台中需要明确展示：

- 当前平台应用了哪些 skills

## 样例生成要求

为保证原型阶段的演示完整性，系统应内置一组稳定示例：

当用户输入：

`写一篇关于如何提高工作效率的内容`

并勾选所有平台时，系统需要同时生成：

### 公众号文章

- 标题：《高效工作的 5 个底层逻辑》
- 长度：约 2000 字
- 形态：深度文章

### 小红书笔记

- 标题：《工作效率翻倍！我的 5 个神仙方法✨》
- 图片：9 张图片建议
- 文案：约 500 字

### Twitter

- 形式：10 条 Thread
- 结构：问题 -> 方法 -> 总结

### 视频脚本

- 时长：约 3 分钟
- 内容：包含分镜和旁白

## 技术架构

### 总体方案

采用 `Next.js 单体应用 + SQLite + 本地文件存储`。

分层如下：

1. 页面层
2. API 层
3. 服务层
4. SQLite 数据层
5. 本地文件存储层
6. mock 适配层

### 页面层

基于 Next.js App Router。

主要路由：

- `/`
- `/workspace/[taskId]`
- `/settings`

### API 层

建议包含：

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/[taskId]`
- `PATCH /api/tasks/[taskId]`
- `DELETE /api/tasks/[taskId]`
- `POST /api/tasks/[taskId]/publish`
- `POST /api/skills/upload`
- `POST /api/skills/install`
- `GET /api/skills`
- `GET /api/skills/[skillId]`
- `PATCH /api/platform-settings/[platform]`

### 服务层

建议拆分：

- `task-service`
- `content-generation-service`
- `history-service`
- `mock-publish-service`
- `skill-ingestion-service`
- `skill-learning-service`
- `platform-settings-service`

### 数据存储

SQLite 保存结构化业务数据。

本地文件系统保存：

- 上传的 zip
- 解压后的技能目录
- 可能的图片占位资源

推荐目录：

- `.codex-data/content-creation-agent.sqlite`
- `.codex-data/skills/uploads/`
- `.codex-data/skills/unpacked/<skill-id>/`

## 数据模型

### `tasks`

字段建议：

- `id`
- `title`
- `user_input`
- `selected_platforms_json`
- `status`
- `created_at`
- `updated_at`

### `task_contents`

字段建议：

- `id`
- `task_id`
- `platform`
- `content_type`
- `title`
- `body_json`
- `publish_status`
- `version`
- `created_at`
- `updated_at`

### `platform_settings`

字段建议：

- `platform`
- `base_rules_json`
- `enabled_skill_ids_json`
- `updated_at`

### `skills`

字段建议：

- `id`
- `name`
- `source_type`
- `source_ref`
- `summary`
- `status`
- `created_at`
- `updated_at`

### `skill_files`

字段建议：

- `id`
- `skill_id`
- `relative_path`
- `file_type`
- `created_at`

### `skill_learning_results`

字段建议：

- `skill_id`
- `summary`
- `rules_json`
- `platform_hints_json`
- `keywords_json`
- `examples_summary_json`
- `updated_at`

### `skill_bindings`

字段建议：

- `id`
- `platform`
- `skill_id`
- `enabled`
- `created_at`

### `history_actions`

字段建议：

- `id`
- `task_id`
- `action_type`
- `payload_json`
- `created_at`

## 状态流转

### 新建任务

`idle -> submitting -> generating -> completed | failed`

### 编辑内容

`viewing <-> editing -> saved`

### 模拟发布

`ready -> publishing -> published`

### 技能上传

`idle -> uploading -> validating -> learning -> ready | failed`

### 仓库安装

`idle -> resolving-repo -> downloading -> validating -> learning -> ready | failed`

## 失败处理

第一阶段至少覆盖以下异常：

- 首页输入为空
- 未选择平台
- 任务读取失败
- 任务删除失败
- 生成失败
- 模拟发布失败
- zip 中缺少 `SKILL.md`
- GitHub 仓库路径无效
- skill 学习失败
- SQLite 写入失败

对应原则：

- 错误可见
- 不吞错误
- 可重试
- 不破坏已有历史数据

## 验证策略

### 单元测试

- 任务创建服务
- 历史记录搜索与重命名
- 技能包校验
- skill 学习结果提炼
- 平台绑定逻辑
- 模拟发布逻辑

### 组件测试

- 首页提交流程
- 平台切换
- 历史记录操作
- 设置页 skill 导入入口

### 集成验证

覆盖完整主路径：

1. 输入样例需求
2. 生成全平台内容
3. 进入工作台查看结果
4. 编辑其中一个平台
5. 模拟发布公众号内容
6. 回看历史记录
7. 导入一个 zip skill
8. 将该 skill 绑定到某个平台

## 验收标准

满足以下条件即可视为第一阶段完成：

1. 首页可创建任务并生成多平台内容
2. 工作台可查看并编辑四个平台内容
3. 历史记录支持查看、搜索、重命名、删除
4. 模拟发布动作可用并展示成功状态
5. 设置页可展示平台规则和已绑定 skills
6. zip 上传可校验 `SKILL.md`
7. GitHub skill 安装入口可用
8. skill 学习结果可被查看
9. skill 可绑定平台并参与下一次生成
10. 所有核心数据在应用刷新后仍然存在

## 推荐实现策略

为了保证推进效率，建议按以下顺序实现：

1. 搭建 Next.js 页面骨架和 SQLite 基础设施
2. 完成任务、历史记录和工作台主流程
3. 完成四个平台专属编辑器
4. 完成模拟生成与模拟发布
5. 完成设置页与平台绑定
6. 完成 zip skill 上传与 GitHub 安装
7. 完成 skill 学习结果与生成链路接入

## 风险与约束

### 1. Skills 结构差异

不同 skill 包结构可能不一致，因此第一阶段必须收紧约束，至少要求根目录存在 `SKILL.md`。

### 2. GitHub 安装失败

仓库私有、路径错误或网络失败都可能导致安装失败，需要明确错误提示。

### 3. 原型期内容生成与真实 AI 存在差异

第一阶段使用 mock 生成，输出结构应尽量贴近未来真实结果，避免后续重做编辑器。

### 4. 本地文件存储安全边界

第一阶段默认不执行 skill 包中的脚本，只做读取与解析。
