# Bilibili Video Support Feasibility And Plan

## Goal

Add first-class Bilibili imports with the same downstream study experience as YouTube:

1. User pastes a Bilibili video URL.
2. The app resolves metadata and fetches the video's built-in subtitles.
3. The video and transcript are saved to Supabase.
4. The user is redirected to the existing `/video/[id]` study page.
5. CC, scribe, vocabulary, transcript enhancement, seeking, playback speed, and saved annotations work the same way they do for YouTube.

## Feasibility Summary

This is feasible, but it is not only a subtitle-fetcher change.

Implementation status as of this change:

- Bilibili import is enabled in the main server action.
- Provider-neutral metadata fetching exists in `lib/utils/video-meta.ts`.
- Bilibili subtitles are fetched through `x/player/wbi/v2`, `x/player/v2`, and usable `x/web-interface/view` subtitle entries.
- `BilibiliProvider` now embeds the official iframe and exposes a best-effort `VideoProvider` interface.
- The video page accepts BV IDs and uses the stored source URL/type when a DB row exists.
- Full playback-control parity remains the main risk because Bilibili does not expose a stable YouTube-style iframe API.

The current codebase already models Bilibili as a supported source in the database and URL parser:

- `videos.source_type` already allows `youtube` and `bilibili`.
- `types/video.ts` already defines `VideoSourceType = 'youtube' | 'bilibili'`.
- `parseVideoUrl()` and `detectVideoSource()` already recognize `bilibili.com/video/BV...` links.

The original missing pieces were:

- Import flow blocks Bilibili explicitly in `app/actions/import-video.ts`.
- `fetchSubtitles()` returns no subtitles for `bilibili`.
- `BilibiliProvider` was a stub, so the video page could not play/control Bilibili videos yet.
- `/video/[id]` currently validates IDs as YouTube IDs only, builds a YouTube URL, and always calls YouTube metadata/pipeline fallback code.
- Dashboard card thumbnails still fall back to YouTube thumbnail URLs.
- Metadata helpers are YouTube-specific.

## External API Findings

Bilibili's public web APIs expose the data needed for the first implementation:

- Video metadata can be fetched from `https://api.bilibili.com/x/web-interface/view?bvid={bvid}`. The response includes `aid`, `bvid`, `cid`, `title`, `pic`, `duration`, `owner`, and `pages`.
- Player metadata can be fetched from `https://api.bilibili.com/x/player/v2?bvid={bvid}&cid={cid}` or with `aid` plus `cid`. The response includes `data.subtitle.subtitles[]`.
- Each subtitle entry includes `lan`, `lan_doc`, and `subtitle_url`.
- The `subtitle_url` points to JSON subtitle content. Bilibili subtitle JSON commonly uses a `body` array with items shaped like `{ from, to, content }`, which maps directly to this app's `TranscriptSegment` shape: `{ start_time, end_time, text }`.

References checked on 2026-05-09:

- Bilibili API collect, video info: `https://lxb007981.github.io/bilibili-API-collect/video/info.html`
- Bilibili API collect, player info: `https://sessionhu.github.io/bilibili-API-collect/docs/video/player.html`
- SocialSisterYi issue with subtitle API example: `https://github.com/SocialSisterYi/bilibili-API-collect/issues/201`

Important caveats:

- Some videos have no CC subtitles, or expose only non-English subtitles. The import flow should keep the current "no subtitles" failure behavior.
- Some restricted, paid, invisible, region-limited, or login-required videos may fail without cookies.
- `x/player/v2` documentation notes subtitle arrays may be empty when not logged in for some cases. The implementation supports public no-cookie fetching first, plus an optional `BILIBILI_COOKIE` environment variable for videos whose subtitle URLs are only exposed with request cookies.
- Multi-part Bilibili videos have multiple `cid` values. A plain `/video/BV...` URL should default to page 1 unless the URL contains `?p=N`.

## Current Code Impact

### Import Flow

`app/actions/import-video.ts`

- Remove the explicit `parsed.source === 'bilibili'` rejection.
- Replace `fetchYouTubeMeta(videoId)` with a provider-aware metadata function.
- Keep existing behavior: check DB first, fetch metadata plus transcript, persist both, redirect.

`app/api/videos/import/route.ts`

- It already accepts Bilibili through `detectVideoSource()`, but currently receives empty subtitles from the pipeline.
- It should share the same provider-aware parsing and transcript behavior as the server action or be consolidated.

### Subtitle Fetching

`lib/services/subtitle-fetcher.ts`

- Add `fetchBilibiliSubtitles(videoId, preferredLang, page?)`.
- Resolve metadata first to get `aid`, first/default `cid`, and available pages.
- Call Bilibili player metadata to get subtitle candidates.
- Pick subtitles by language preference:
  - exact match, e.g. `en`
  - broader match, e.g. `en-US`
  - fallback to any English subtitle
  - final fallback to the first subtitle if product wants non-English support later
- Fetch `subtitle_url`, normalize protocol-relative URLs, parse JSON, and map `body[]` into `TranscriptSegment[]`.
- Return `source: 'manual' | 'auto-generated'` as best effort. Bilibili exposes fields like `ai_type` and `ai_status`; if those are not reliable, use `manual` for user-submitted/unlocked subtitles and `auto-generated` for AI subtitle URLs or AI-marked entries.

### Metadata

Add `lib/utils/bilibili-meta.ts` or a provider-neutral `lib/video-providers/metadata.ts`.

Minimum metadata:

- `title` from `data.title`
- `channelName` from `data.owner.name`
- `thumbnailUrl` from `data.pic`, normalized from `http://` or protocol-relative if needed
- `duration` from `data.duration`
- `aid`, `cid`, `pages` for subtitle/player setup

The current `VideoInsertData` interface has no `duration`, even though the DB column exists. Add it so Bilibili and YouTube can persist duration consistently.

### Video Page And Routing

`app/[locale]/(app)/video/[id]/page.tsx`

- Replace `YT_ID_RE` with a source-aware lookup:
  - First check DB by `video_ext_id`.
  - Use `source_type` from DB to build the playback URL.
  - If no DB row exists, parse/validate the ID as either YouTube or Bilibili and run provider-specific fallback.
- The page currently constructs `https://www.youtube.com/watch?v=${id}`. For Bilibili, construct `https://www.bilibili.com/video/${id}` or store and reuse the original URL from DB.
- Rename `YouTubeMeta` usage to a provider-neutral `VideoMeta` type.

Potential ID collision note:

- `getVideoByExtId()` and transcript lookup use only `video_ext_id`. YouTube IDs and Bilibili BV IDs are structurally different, so collision risk is low, but source-aware queries are cleaner and safer.

### Player

`lib/video-providers/bilibili-provider.ts`

There are two possible implementation paths:

1. Embed Bilibili's iframe player and use postMessage or iframe URL parameters for control.
2. Use a lightweight wrapper around the embedded player with periodic time polling, matching the existing `VideoProvider` interface as closely as possible.

Required parity for the study page:

- `initialize`
- `play`
- `pause`
- `seekTo`
- `getCurrentTime`
- `getDuration`
- `setPlaybackRate`
- `setVolume`
- `timeUpdate`
- `stateChange`
- `ready`

Risk:

- Bilibili's iframe control API is less stable and less formally documented than YouTube's IFrame API. This is the highest-risk part of "same functionality".
- If reliable iframe control is not possible, fallback options are:
  - Use iframe for display and keep transcript click-to-seek best effort.
  - Add a Bilibili-specific limitation note.
  - Later consider signed media URL playback only if it is legally and technically appropriate.

### Dashboard And UI

- Update i18n messages:
  - Invalid URL should say YouTube or Bilibili.
  - Remove "Bilibili support coming soon".
  - Add `source.bilibili`.
- Update `VideoCard` thumbnail fallback so Bilibili cards do not use YouTube thumbnail URLs.
- Add Bilibili badge styling.

### Tests

Add focused tests around:

- URL parsing:
  - `https://www.bilibili.com/video/BV...`
  - `https://www.bilibili.com/video/BV...?p=2`
  - mobile/share variants if supported
- Bilibili subtitle JSON mapping:
  - normal `body[]`
  - empty body
  - HTML/entities or newline cleanup
- Subtitle language selection.
- Import flow rejects videos with no subtitles and persists videos with subtitles.
- Video page loads a Bilibili DB row and passes a Bilibili URL into `StudyRoom`.

For manual verification:

- Import a public Bilibili video with English CC.
- Import a public Bilibili video with Chinese CC only.
- Import a public Bilibili video with no subtitles.
- Open dashboard card and video page.
- Check play/pause, seek from transcript segment, rewind, speed, mute, vocabulary save, and scribe save.

## Implementation Plan

### Phase 1: Provider-Neutral Import Foundation

1. Introduce a `VideoMeta` type and provider-aware `fetchVideoMeta(source, videoId, options?)`.
2. Implement `fetchBilibiliMeta()` using `x/web-interface/view`.
3. Store `duration` in `insertVideo()`.
4. Keep YouTube behavior unchanged.

Exit criteria:

- Existing YouTube imports still work.
- Bilibili metadata can be fetched in isolation.

### Phase 2: Bilibili Subtitle Fetching

1. Implement `fetchBilibiliSubtitles()`.
2. Wire it into `fetchSubtitles()`.
3. Normalize Bilibili subtitle JSON into `TranscriptSegment[]`.
4. Try both `x/player/wbi/v2` and `x/player/v2`, then fall back to `x/web-interface/view` subtitle entries when they include a usable `subtitle_url`.
5. Add language-selection helper and tests.

Exit criteria:

- Given a public Bilibili video with CC subtitles, pipeline returns `subtitle-raw` or `subtitle-enhanced`.
- Videos without subtitles still return the existing no-subtitles error.

### Phase 3: Import Flow Enablement

1. Remove the Bilibili unsupported guard.
2. Use provider-aware metadata in `importVideo()`.
3. Use source-aware DB lookup where practical.
4. Update i18n messages.

Exit criteria:

- Pasting a Bilibili link saves `videos` and `transcripts`, then redirects to `/video/{BV...}`.

### Phase 4: Video Page Source Awareness

1. Replace YouTube-only ID validation.
2. Fetch source type and original URL from DB.
3. Pass provider-neutral metadata and Bilibili URL to `StudyRoom`.
4. Update direct-access fallback for Bilibili.

Exit criteria:

- `/video/{BV...}` renders the study page using DB transcript data.

### Phase 5: Bilibili Player Parity

1. Implement `BilibiliProvider` iframe rendering.
2. Implement the `VideoProvider` control surface.
3. Add polling/events to keep transcript sync working.
4. Verify playback controls in browser.

Exit criteria:

- Existing study-room controls work for Bilibili at parity or documented near-parity.

### Phase 6: Dashboard Polish And Regression Testing

1. Update `VideoCard` thumbnail fallback and source badge.
2. Verify dashboard filtering/grouping with mixed YouTube and Bilibili rows.
3. Run build/lint and manual import/playback checks.

Exit criteria:

- Mixed-source library feels native, with no YouTube-specific leakage for Bilibili items.

## Recommended First PR Scope

Keep the first implementation narrow:

- Public Bilibili UGC videos only.
- First page of multi-part videos unless `?p=N` support is trivial.
- Built-in CC subtitles only; no audio transcription.
- No Bilibili login cookies.
- English preferred, fallback behavior explicit.

This gives the app the requested import-to-study flow while keeping the unstable parts contained.
