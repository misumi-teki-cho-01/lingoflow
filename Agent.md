# LingoFlow Agent 说明

这是给 coding agent 使用的项目速记。开始改代码前先读这里，这样用户就不用每次重新介绍项目背景。

## 项目简介

LingoFlow 是一个个人使用的英语学习软件，核心目标是帮助用户围绕真实视频内容做 shadowing、精听、精读、填词和词汇积累。产品优先服务个人学习效率，而不是多人协作、课程销售或通用视频平台。

用户可以导入 YouTube、Bilibili 或本地视频，获取或上传字幕，然后通过同步播放、CC 字幕、填词和 Echo Scribe 等模式学习。

当前实现偏共享视频库设计：导入的视频会保存到 Supabase，并显示在 dashboard 中供复用。但产品定位仍然是个人英语学习工具，设计和功能取舍应优先考虑单个学习者的沉浸感、复习效率和长期积累。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript
- Tailwind CSS 4
- next-intl 负责国际化
- Supabase SSR client 和数据库
- `components/ui` 中的 shadcn 风格 UI primitives
- Tiptap 用于 Echo Scribe 编辑器
- 通过 `@google/generative-ai` 使用 Gemini，处理 AI 字幕和词汇辅助功能

## 常用命令

- `npm run dev` 启动本地开发环境。
- `npm run build` 检查生产构建。
- `npm run lint` 运行 ESLint。
- `npm run format:check` 检查 Prettier 格式。
- `npm run format` 应用 Prettier 格式化。

本地环境变量写在 `.env.local`，参考 `.env.example`。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BILIBILI_COOKIE` 可选；只有当 Bilibili 字幕访问需要登录 cookie 时才需要。

只在说明文档中写环境变量名、用途和是否必需，不要写真实 secret、cookie 或 token。需要新增环境变量时，同步更新 `.env.example` 和本文件。

## 给 AI / Agent 的工作指令

- 这个项目是个人英语学习工具。做功能时优先考虑学习体验、低摩擦复习、内容沉浸和长期数据积累。
- 不要把界面做成营销页、课程平台或企业 SaaS 风格。学习室和 dashboard 应该安静、直接、可反复使用。
- 涉及 AI 功能时，重点是辅助英语学习：字幕润色、词汇解释、语法说明、听写反馈、复习提示等。
- AI 输出应尽量可检查、可编辑、可保存。不要把不可控的大段生成内容直接写入数据库，除非用户明确确认。
- 词汇解释和字幕润色要保留用户手动修正的空间。用户自己的听写、标注、释义和复习记录比自动生成结果更重要。
- 处理学习内容时默认目标语言是英语。界面支持多语言，但学习对象主要是英文视频和英文字幕。
- 不要把用户的真实密钥、cookie、视频隐私信息或学习记录写进文档、日志或示例。
- 如果一个改动会影响数据库结构、用户数据保存方式或已有学习记录，先确认迁移路径和兼容性。

## 重要路径

- `app/[locale]` 是本地化路由。
- `app/[locale]/(app)/dashboard/page.tsx` 是视频库 dashboard。
- `app/[locale]/(app)/video/[id]/page.tsx` 加载主学习室。
- `app/[locale]/(app)/video/[id]/cinema/page.tsx` 加载字幕剧场模式。
- `app/actions` 放 server actions，例如在线视频导入。
- `app/api` 放 API routes，例如本地导入、字幕上传/润色、词汇保存和视频操作。
- `components/study-room` 是主要学习体验。
- `components/transcript`、`components/fill`、`components/scribe` 是不同学习模式的 UI。
- `components/layout` 是应用外壳，例如 header、shell、语言切换和主题切换。
- `lib/db` 是 Supabase 表访问 helper。
- `lib/supabase` 是 Supabase server/client/middleware helper。
- `lib/pipeline/transcription-pipeline.ts` 协调字幕获取和 AI 润色。
- `lib/services/subtitle-fetcher.ts` 按视频来源获取字幕。
- `lib/video-providers` 是播放器 provider 实现。
- `lib/study-room/study-video-data.ts` 加载学习页需要的数据。
- `messages/*.json` 是多语言 UI 文案。
- `supabase/migrations` 是数据库 schema 迁移历史。

## 产品概念

- 支持的视频来源是 `youtube`、`bilibili`、`local`，定义在 `types/video.ts`。
- 学习模式包括 CC 字幕、Echo Scribe、填词模式和字幕剧场。
- 字幕由带时间戳和文本的 `TranscriptSegment` 数组表示。
- AI 润色后的字幕保存为 `subtitle-enhanced`；原始抓取字幕是 `subtitle-raw`；`audio-transcribed` 预留但尚未实现；完全失败是 `failed`。
- Bilibili 视频可以在没有字幕的情况下先保存，之后用户可在学习页手动上传字幕。
- 用户词汇、标注、进度和听写内容与共享视频/字幕记录分开保存。

## 数据流程

在线视频导入流程：

1. `app/actions/import-video.ts` 使用 `parseVideoUrl` 解析 URL。
2. 检查 Supabase 中是否已经存在该 external video id。
3. 并行获取视频 metadata 和运行 `runTranscriptionPipeline`。
4. 将视频记录保存到 `videos`。
5. 如果字幕可用，则 upsert transcript。
6. 重定向到 `/{locale}/video/{videoExtId}`。

学习页流程：

1. `loadStudyVideoData` 加载视频 metadata、字幕 segments、已有释义、CC 选词和听写 HTML。
2. 页面渲染 `StudyRoom`。
3. `StudyRoom` 协调视频播放、字幕同步、标注、词汇 review、字幕上传/润色和学习模式状态。

## 编码约定

- 保持现有 App Router 和 server/client component 边界。
- 使用 `@/` 路径别名导入。
- 面向用户的文案放在 `messages/en.json`、`messages/ja.json`、`messages/zh.json`；新增 UI 文案时三种语言都要更新。
- 优先使用 `lib/db`、`lib/api`、`lib/supabase` 和 `lib/utils` 中已有 helper，避免重复写 Supabase query 或解析逻辑。
- 数据库变化通过编号 Supabase migration 处理。
- 注意共享数据和用户私有数据的区别。共享视频/字幕记录不应意外覆盖用户自己的听写、词汇或进度。
- 不要假设每个视频都有字幕。Bilibili 和本地视频可能在用户上传字幕前是不完整的。
- 新增视频来源时，需要同时更新 `types/video.ts`、URL 解析、metadata 获取、字幕获取、provider/player、dashboard 标签，以及任何枚举 source type 的 Supabase constraint/migration。
- 修改前端学习流程时要检查桌面和移动端布局。学习室是高密度工具界面，应优先保持控制清晰，而不是做成营销页风格。
- 仓库里可能有用户的其它未提交改动。不要回滚这些改动。

## 当前备注

- `TODO.md` 记录开发者的个人想法，不需要参考。
- `README.md` 保持简洁；本文件是给 agent 使用的操作说明。
