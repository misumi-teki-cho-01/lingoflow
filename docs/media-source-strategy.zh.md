# 媒体来源与字幕策略记录

## 当前结论

LingoFlow 原本主要围绕 YouTube 链接工作：输入视频链接，自动获取字幕，保存到 DB，然后进入 video 学习页面。

我们已经开始加入 Bilibili 支持，并做了第一版实现：

- Bilibili 链接可以被识别。
- Bilibili metadata 可以通过公开接口获取。
- 如果视频有 Bilibili 自带 CC 字幕，可以尝试抓取并转换成现有 `TranscriptSegment[]`。
- 如果 Bilibili 视频没有可用 CC 字幕，也可以保存视频并在 video 页面手动上传字幕。
- video 页面已经开始支持 BV 号。
- Bilibili 播放器目前使用官方 iframe 做 best-effort 接入。

但讨论后发现一个更关键的产品现实：**Bilibili 上很多英语学习视频并没有真正的 CC 字幕轨道，字幕往往是直接压在视频画面里的硬字幕**。这种硬字幕无法通过字幕 API 提取。

所以，Bilibili 的长期策略不能只依赖“自动抓自带字幕”。

## Bilibili 视频遇到的问题

### 1. 英语 CC 字幕覆盖率很低

即使视频内容是英语，Bilibili 上也很少有可提取的英文 CC 字幕。常见情况是：

- 视频画面里有中英双语硬字幕。
- Bilibili 字幕列表为空。
- 字幕列表存在，但没有可用 `subtitle_url`。
- 字幕需要登录态或 cookie 才能看到。
- 只有中文字幕，没有英文字幕。

这意味着当前“抓 Bilibili 自带字幕”的能力只能覆盖一小部分公开视频。

### 2. 硬字幕无法直接提取

硬字幕已经成为视频像素的一部分，不是文本轨道。要提取只能走 OCR 或音频转写。

OCR 的问题：

- 需要抽帧。
- 需要识别字幕区域。
- 需要去重相邻帧。
- 需要恢复时间轴。
- 双语字幕、字体、背景、遮挡都会影响质量。

因此 OCR 不适合作为第一阶段主线，只适合作为未来高级功能。

### 3. 自动音频转写对个人工具来说性价比不高

后台音频转写理论上可行，但需要额外复杂度：

- 下载或抽取视频音频。
- 运行转写模型或调用外部 AI API。
- 维护后台任务队列。
- 处理长视频耗时、失败重试和成本问题。

如果使用外部 API，会产生持续费用；如果使用本地 Whisper，又需要维护 `yt-dlp`、`ffmpeg`、本地模型和 worker。

对当前“个人使用工具”的定位来说，自动转写不是最优先方案。

### 4. Bilibili API 不能可靠判断视频口语语言

Bilibili API 可以暴露字幕轨道的语言，例如 `lan=en`、`lan=zh-CN`。但这只能说明“某条字幕是什么语言”，不能可靠说明视频本身的 spoken language。

例如：

- 英语视频可能只有中文字幕。
- 中文 UP 主搬运的英语内容可能没有英文 CC。
- 标题、分区、tag 只能作为弱推断。
- 硬字幕视频没有文本轨道时，API 更无法判断字幕内容语言。

因此当前不建议做“只有英语视频才允许上传字幕”的硬限制。更好的策略是：

- 允许用户给任何视频上传字幕。
- 默认把字幕语言标记为 `en`，后续可以在上传表单里增加语言选择。
- 如果将来需要，可以根据字幕文本做轻量语言检测，但不要用它阻止用户导入。

## 新方向：手动字幕导入优先

更现实的方案是：

1. Bilibili 有 CC 字幕时，自动抓取。
2. Bilibili 没有 CC 字幕时，也允许保存视频。
3. video 页面显示“暂无字幕”，提供手动补字幕入口。
4. 用户可以上传或粘贴字幕。
5. 字幕保存到 DB 后，继续复用现有学习功能。

当前已实现：

- Bilibili 无 CC 时可以保存视频并进入 video 页面。
- video 页面无字幕时显示上传入口。
- 支持上传 `.srt` 和 `.vtt`。
- 上传后写入 `transcripts` 表，并立即在当前页面进入学习状态。

优先支持的字幕格式：

- `.srt`
- `.vtt`

后续再考虑：

- 粘贴纯文本字幕。
- AI 辅助分段或对齐。
- 从本地 Whisper 生成的字幕文件导入。

这样用户可以自己用任何方式拿到字幕文件，再导入 LingoFlow，而不需要 LingoFlow 承担昂贵且复杂的自动转写流程。

## 本地视频功能

我们还讨论了加入本地视频学习功能。这个方向是可行的，而且很适合个人使用。

推荐新增第三种来源：

```ts
youtube | bilibili | local;
```

本地视频 MVP：

- 支持本地视频文件：`.mp4`、`.webm`、后续可考虑 `.mkv`。
- 支持本地字幕文件：`.srt`、`.vtt`。
- 使用原生 `<video>` 实现 `LocalVideoProvider`。
- 字幕解析后保存成现有 `TranscriptSegment[]`。
- 继续复用 CC、Scribe、生词保存、导出、AI 释义等学习功能。

原生 `<video>` 的控制能力比 Bilibili iframe 更稳定：

- play
- pause
- seek
- playbackRate
- volume
- timeupdate

所以本地视频学习体验理论上可以比 Bilibili 在线 iframe 更可靠。

## NAS 媒体库方向

如果后续自己维护服务器或 NAS，可以把 LingoFlow 部署在 NAS 上，让它直接读取 NAS 上的视频目录。

推荐形态：

```text
浏览器
  -> http://nas-ip:3000
  -> LingoFlow Web app
  -> 读取 NAS 本地媒体目录
  -> 本地 DB
```

例如配置：

```env
MEDIA_LIBRARY_ROOT=/volume1/video/english
```

App 可以扫描该目录：

- 查找视频文件。
- 查找同名字幕文件。
- 解析字幕并写入 DB。
- 通过后端 media route 给浏览器 stream 视频。

浏览器不能直接访问 NAS 文件路径，例如 `/volume1/video/a.mp4`。必须由 Web app 提供 HTTP route，例如：

```text
/api/media/video?id=abc
```

然后后端从文件系统读取视频并返回给 `<video>` 播放。

## Web 是否部署在 NAS 上

如果目标是直接读取 NAS 视频文件，Web app 部署在 NAS 上是最合理的。

局域网访问：

```text
http://nas-ip:3000
```

电脑、手机、平板只要在同一个 Wi-Fi 下，就可以访问。

远程访问可以用：

- Tailscale / ZeroTier：个人使用基本免费，推荐。
- 域名 + HTTPS + 反向代理：更正式，但需要配置。
- 公网 IP + 端口转发：可行，但不建议裸露到公网。

远程观看 NAS 视频主要取决于家里宽带的上行速度。

大致参考：

- 720p：约 2-5 Mbps 上行。
- 1080p：约 5-12 Mbps 上行。
- 高码率 1080p 或 4K：可能需要 20-80+ Mbps。

如果只是语言学习，建议为远程访问准备低码率版本，学习体验通常足够。

## DB 方向

当前项目使用 Supabase 免费方案。后续字幕、词汇、听写记录变多后，可能会遇到云服务额度或费用问题。

如果准备自托管，推荐优先考虑本地 PostgreSQL。

原因：

- Supabase 本质也是 Postgres。
- 现有 migration 更容易迁移。
- 比 SQLite 更贴近当前表结构。
- 后续部署在 NAS 上也比较自然。

两种路线：

### 路线 A：自托管 Supabase

优点：

- 对现有代码改动较少。
- Supabase client 可以继续使用。

缺点：

- 服务比较重。
- Docker compose 组件多。
- 对个人 NAS 维护成本偏高。

### 路线 B：普通 PostgreSQL + ORM/Query Builder

可选：

- Drizzle
- Kysely
- Prisma

优点：

- 更轻。
- 长期维护更清楚。
- 不依赖 Supabase 云服务。

缺点：

- 需要重写 `lib/db/*`。
- auth/session 相关逻辑也要重新考虑。

当前建议：**先不要急着迁 DB**。先把本地视频和 NAS 媒体库设计清楚，因为它会影响数据模型。DB 迁移放到后面更稳。

## 推荐后续计划

### Phase 1：手动字幕导入

目标：

- Bilibili 无 CC 时不再只是失败。
- 允许保存视频。
- video 页面提供“上传字幕 / 粘贴字幕”入口。
- 支持 `.srt` 和 `.vtt` 解析。
- 字幕保存到现有 `transcripts` 表。

这是当前最值得优先做的功能。

### Phase 2：本地视频 MVP

目标：

- 新增 `local` source。
- 实现 `LocalVideoProvider`。
- 支持选择本地视频和字幕。
- 字幕写入 DB。
- 学习页面复用现有功能。

如果视频文件不上传服务器，浏览器重新打开时可能需要用户重新选择视频文件。

### Phase 3：NAS 媒体库

目标：

- 增加 `MEDIA_LIBRARY_ROOT` 配置。
- 扫描 NAS 视频目录。
- 自动匹配同名字幕。
- 后端 stream 视频。
- 本地视频卡片可以像普通视频一样打开。

### Phase 4：本地 PostgreSQL / 自托管

目标：

- 设计 DB adapter。
- 保留 Supabase 云方案一段时间。
- 逐步迁移到本地 PostgreSQL。
- 让部署方式支持 Docker / NAS。

### Phase 5：可选本地转写

这是低优先级高级功能。

可选方案：

- `whisper.cpp`
- `faster-whisper`
- `mlx-whisper`

使用方式更适合做成外部工具链：用户自己生成 `.srt`，再导入 LingoFlow。

不建议当前阶段把自动转写塞进主应用。

## 当前产品策略

短期策略：

```text
YouTube：继续自动抓字幕
Bilibili：能抓 CC 就抓，抓不到就允许手动补字幕
Local：支持本地视频 + 本地字幕
NAS：作为下一阶段自托管媒体库方向
DB：暂时继续 Supabase，后续再迁本地 PostgreSQL
```

核心判断：

**LingoFlow 不应该为了少数 Bilibili 硬字幕视频，过早引入昂贵复杂的自动转写系统。更适合个人使用的路线，是把字幕导入、本地视频和 NAS 媒体库做好。**
