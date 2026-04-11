# LingoFlow 后续开发计划

## 当前进度总览

### 已完成 (Phase 1 地基)

| 模块 | 状态 | 关键文件 |
|------|------|----------|
| Next.js 16 + TS strict + Tailwind v4 + shadcn/ui | ✅ | `next.config.ts`, `globals.css` |
| 国际化 (zh/en/ja) 路由级切换 | ✅ | `i18n/`, `messages/`, `middleware.ts` |
| Supabase 客户端 (browser + server + auth middleware) | ✅ | `lib/supabase/` |
| 数据库 Schema + RLS + 索引 (5 张表) | ✅ | `supabase/migrations/` |
| 视频播放器抽象 (Strategy 模式) | ✅ | `lib/video-providers/` |
| YouTubeProvider (IFrame API 完整封装) | ✅ | `lib/video-providers/youtube-provider.ts` |
| `useVideoPlayer` Hook (含暂停回溯状态机) | ✅ | `hooks/use-video-player.ts` |
| `useTranscriptSync` Hook (二分查找) | ✅ | `hooks/use-transcript-sync.ts` |
| 三级降级转录流水线 (字幕→AI增强→音频) | ✅ | `lib/pipeline/` |
| API 路由骨架 (import / status / explain) | ✅ | `app/api/` |
| TypeScript 类型定义 | ✅ | `types/` |
| 页面骨架 (落地页, 仪表盘, 视频页, 设置) | ✅ | `app/[locale]/` |
| 工具函数 (URL解析, 时间格式化, 常量) | ✅ | `lib/utils/` |
| Gemini 客户端 | ✅ | `lib/gemini/client.ts` |

### 待开发一览

```
Phase 2: 端到端视频导入 + 转录播放 ← 让核心功能跑起来
Phase 3: 影子跟读模式 ← 核心差异化功能
Phase 4: 标注 + AI 释义 + 精读 ← 深度学习功能
Phase 5: 打磨 + Bilibili + 移动端 ← 扩展与体验优化
```

---

## Phase 2: 端到端视频导入与转录播放

> 目标：用户粘贴 YouTube 链接 → 看到视频 + 同步转录面板，点击句段可跳转

### 2.1 Supabase Auth 集成

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| 登录页 UI | `app/[locale]/(auth)/login/page.tsx` | Email + Password 表单，调用 `supabase.auth.signInWithPassword` |
| 注册页 UI | `app/[locale]/(auth)/signup/page.tsx` | 注册表单 + Email 验证提示 |
| Auth 路由保护 | `app/[locale]/(app)/layout.tsx` | 服务端检查 session，未登录 redirect 到 login |
| 登出按钮 | `components/layout/header.tsx` | 添加用户头像 + 登出逻辑 |
| Supabase 数据库连接验证 | — | 执行 `supabase db push` 应用 migrations 到远端 |

### 2.2 视频导入表单

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| URL 输入组件 | `components/video/video-import-form.tsx` | 粘贴 URL → 校验 → 调用 API → 显示加载状态 |
| Import API 接入 Supabase | `app/api/videos/import/route.ts` | 创建 `videos` + `transcripts` 行，调用 pipeline，写回结果 |
| 导入进度反馈 | `hooks/use-transcript-status.ts` | Supabase Realtime 订阅 `transcripts` 表变更 |
| 仪表盘视频列表 | `app/[locale]/(app)/dashboard/page.tsx` | 从 Supabase 读取用户视频列表，显示缩略图 + 状态 |

### 2.3 视频播放器 UI

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| 播放器组件 | `components/video/video-player.tsx` | 消费 `useVideoPlayer`，渲染 YouTube IFrame 容器 |
| 播放控件条 | `components/video/video-controls.tsx` | 播放/暂停、进度条、音量、倍速切换 |
| 视频详情页整合 | `app/[locale]/(app)/video/[id]/page.tsx` | 从 Supabase 加载视频数据 + 转录，组合播放器 + 转录面板 |

### 2.4 转录面板

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| 转录面板容器 | `components/transcript/transcript-panel.tsx` | 可滚动区域，消费 `useTranscriptSync`，自动滚动到活跃句段 |
| 单行句段组件 | `components/transcript/transcript-segment.tsx` | 显示时间戳 + 文本，活跃时高亮，点击跳转视频 |
| 加载/错误状态 | 同上 | 转录中显示骨架屏，失败显示重试按钮 |

### 2.5 DoD (Definition of Done)

- [ ] 用户注册/登录/登出完整可用
- [ ] 粘贴 YouTube URL → 视频 + 转录在 15 秒内出现（字幕优先策略）
- [ ] 转录面板与视频播放实时同步，活跃句段自动高亮
- [ ] 点击任意句段，视频跳转到该时间点
- [ ] 视频和转录数据持久化到 Supabase，刷新页面后仍存在
- [ ] 仪表盘展示用户所有已导入视频

---

## Phase 3: 影子跟读模式

> 目标：开启影子模式 → 暂停时自动回溯 X 秒 → 可选自动恢复播放

### 3.1 影子模式 UI

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| 影子模式控件 | `components/video/shadow-controls.tsx` | 开关 Toggle + 回溯秒数滑块 (2-10s) + 自动恢复开关 |
| 影子练习专用页面 | `app/[locale]/(app)/video/[id]/shadow/page.tsx` | 视频 + 转录 + 影子控件的专注布局 |
| 影子练习 Hook | `hooks/use-shadow-practice.ts` | 封装练习统计逻辑（练习次数、累计时长、已练句段） |

### 3.2 进度持久化

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| 进度写入 | `app/api/` 或直接 Supabase client | 每次暂停/回溯时更新 `user_progress` 表 |
| 进度恢复 | `app/[locale]/(app)/video/[id]/page.tsx` | 重新打开视频时从上次位置继续 |
| 练习统计面板 | 视频页面内嵌 | 显示"已练 N 次"、"累计 X 分钟"、句段完成度进度条 |

### 3.3 转录面板增强

| 任务 | 文件 | 说明 |
|------|------|------|
| 已练句段标记 | `components/transcript/transcript-segment.tsx` | 已练过的句段显示对勾或颜色标记 |
| 句段级循环练习 | `components/transcript/transcript-panel.tsx` | 双击句段 → 循环播放该句段（A-B loop） |

### 3.4 DoD

- [ ] 影子模式开关生效：暂停后自动回溯指定秒数
- [ ] 快速连按暂停/播放不出现抖动
- [ ] 回溯秒数可通过滑块实时调节 (2-10 秒)
- [ ] 可选"自动恢复播放"功能正常
- [ ] 练习统计实时更新且跨会话持久化
- [ ] 重新打开视频从上次播放位置继续

---

## Phase 4: 标注 + AI 释义 + 精读模式

> 目标：选中转录文本 → AI 解释词汇/语法/语境 → 精读模式深度分析

### 4.1 文本选中与标注

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| 文本选中检测 | `components/transcript/transcript-segment.tsx` | 监听 `mouseup`/`selectionchange`，获取选中文本 + 字符偏移量 |
| 标注弹出框 | `components/transcript/annotation-popover.tsx` | 选中后弹出：高亮颜色选择、添加笔记、"AI 解释"按钮 |
| 标注 CRUD Hook | `hooks/use-annotations.ts` | Supabase CRUD 操作，乐观更新 |
| 高亮渲染 | `components/transcript/transcript-segment.tsx` | 已标注文本段落上叠加高亮色块 |

### 4.2 AI 释义

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| 释义生成 | `lib/gemini/explain.ts` | Gemini API 生成结构化释义 (vocabulary, grammar, context, translation) |
| Explain API 实现 | `app/api/ai/explain/route.ts` | 接收 selectedText + 句段上下文，返回 `ExplanationContent` |
| 释义卡片 | `components/ai/explanation-card.tsx` | 渲染词汇释义、语法分析、语境说明、中文翻译 |
| 加载状态 | `components/ai/explanation-loading.tsx` | 骨架屏 + 流式内容占位 |
| 释义缓存 | 写入 `ai_explanations` 表 | 相同文本不重复请求 API |

### 4.3 精读模式

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| 精读页面 | `app/[locale]/(app)/video/[id]/reading/page.tsx` | 整段转录的深度分析视图 |
| 精读面板 | `components/transcript/reading-mode-panel.tsx` | 选中一段 → 展示全段词汇表、难点语法、语境分析 |
| 全段 AI 分析 | `lib/gemini/explain.ts` 扩展 | 一次请求分析整段而非单个词汇 |

### 4.4 DoD

- [ ] 在转录面板中选中文本可创建高亮标注
- [ ] 标注支持颜色选择（黄、绿、蓝、粉）和添加笔记
- [ ] "AI 解释"按钮在 3-5 秒内返回结构化释义
- [ ] 释义内容包含：词汇释义、语法分析、语境说明、中文翻译
- [ ] 标注持久化到 Supabase，重新打开视频时高亮仍在
- [ ] 精读模式下可查看整段的词汇表和语法难点
- [ ] 相同文本的释义有缓存，不重复请求 API

---

## Phase 5: 打磨 + Bilibili + 移动端

> 目标：扩展 Bilibili 支持、优化性能与体验

### 5.1 Bilibili 集成

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| Bilibili 播放器 | `lib/video-providers/bilibili-provider.ts` | 实现 `VideoProvider` 接口，通过 postMessage iframe 通信 |
| Bilibili 字幕获取 | `lib/pipeline/subtitle-fetcher.ts` | 扩展 `fetchSubtitles` 支持 Bilibili CC 字幕 |
| URL 解析适配 | `lib/utils/url-parser.ts` | 已支持 BV 号解析，需测试实际播放 |

### 5.2 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Space` | 播放/暂停 |
| `←` / `→` | 快退/快进 5 秒 |
| `S` | 切换影子模式 |
| `R` | 手动回溯 |
| `[` / `]` | 减速/加速播放 |
| `Esc` | 退出影子/精读模式 |

### 5.3 性能优化

| 任务 | 说明 |
|------|------|
| 虚拟滚动 | 长转录 (1000+ 句段) 使用 `@tanstack/react-virtual` 或类似方案 |
| `React.memo` | 对 `TranscriptSegment` 组件做 memo 优化，避免非活跃句段重渲染 |
| 按需加载翻译 | `NextIntlClientProvider` 仅传当前页面命名空间 |
| 图片优化 | 视频缩略图使用 `next/image` + lazy loading |

### 5.4 响应式 & 移动端

| 任务 | 待创建/修改文件 | 说明 |
|------|-----------------|------|
| 移动端导航 | `components/layout/mobile-nav.tsx` | 底部导航栏或汉堡菜单 |
| 移动端布局 | 各 `page.tsx` | 视频页：竖屏时上下布局（视频在上，转录在下） |
| 触控适配 | 各交互组件 | 加大点击区域，长按替代右键标注 |

### 5.5 其他

| 任务 | 说明 |
|------|------|
| 深色模式 | `providers/theme-provider.tsx`，基于 shadcn/ui dark 变量切换 |
| 错误边界 | 播放器、转录面板各自独立的 `error.tsx` |
| 骨架屏 | 各页面的 `loading.tsx` |
| SEO 元数据 | 各页面的 `generateMetadata` |

### 5.5 DoD

- [ ] Bilibili 视频端到端可用（导入、字幕获取、播放、影子练习）
- [ ] 键盘快捷键文档化且全部可用
- [ ] 1000+ 句段转录滚动流畅 (60fps)
- [ ] 移动端可用（响应式布局、触控友好）
- [ ] Lighthouse 性能评分 > 85
- [ ] 深色模式可切换

---

## 开发优先级建议

```
最高优先级（让产品可用）:
  Phase 2.2 视频导入表单 → 2.3 播放器 UI → 2.4 转录面板
  ↑ 这三个完成后用户就能体验核心流程

次高优先级（核心差异化）:
  Phase 3.1 影子模式 UI + 控件
  ↑ 影子跟读是产品核心卖点

可并行开发:
  Phase 2.1 Auth 可以与 2.2-2.4 并行（先用临时 userId 开发）
  Phase 4.1 标注 UI 与 4.2 AI 释义可并行

可延后:
  Phase 5 全部内容（Bilibili、移动端、性能优化）
```

---

## 技术债 & 已知待处理项

| 项目 | 位置 | 说明 |
|------|------|------|
| `BilibiliProvider` 是空 stub | `lib/video-providers/bilibili-provider.ts` | Phase 5 实现 |
| Level 3 音频转录需自托管 | `lib/pipeline/audio-transcriber.ts` | 需要 Dockerfile + yt-dlp + ffmpeg |
| Middleware 弃用警告 | `middleware.ts` | Next.js 16 提示迁移到 `proxy`，next-intl 尚未适配 |
| `ai_explanations` 表缺少 `prompt_tokens`/`response_tokens` 索引 | `supabase/migrations/` | 未来需要追踪 AI 成本 |
| 翻译类型安全 | `global.d.ts` | 尚未配置 next-intl 消息类型声明 |
