import crypto from 'node:crypto';
import { YoutubeTranscript, type TranscriptResponse } from 'youtube-transcript';
import type { TranscriptSegment } from '@/types/transcript';
import type { VideoSourceType } from '@/types/video';
import {
  fetchBilibiliMeta,
  getBilibiliFetchHeaders,
  type BilibiliSubtitleInfo,
} from '@/lib/utils/video-meta';

export interface SubtitleFetchResult {
  segments: TranscriptSegment[];
  source: 'manual' | 'auto-generated' | 'none';
  language: string;
}

/**
 * Convert youtube-transcript raw response to our TranscriptSegment format.
 * Raw format: { text, offset (ms), duration (ms) }
 * Our format: { text, start_time (s), end_time (s) }
 */
function toSegments(raw: TranscriptResponse[]): TranscriptSegment[] {
  return raw
    .filter((item) => item.text.trim().length > 0)
    .map((item) => ({
      text: decodeHtmlEntities(item.text.trim()),
      start_time: item.offset / 1000,
      end_time: (item.offset + item.duration) / 1000,
    }));
}

/**
 * Decode common HTML entities that YouTube transcripts may contain.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n/g, ' ');
}

type YouTubeTranscriptFetchPhase = 'innertube' | 'watch-page' | 'caption-track' | 'unknown';

interface YouTubeTranscriptRequestDiagnostic {
  phase: YouTubeTranscriptFetchPhase;
  url: string;
  ok?: boolean;
  status?: number;
  statusText?: string;
  contentType?: string | null;
  bodySignals?: Record<string, boolean | number | string | null | undefined>;
  error?: {
    name: string;
    message: string;
  };
}

interface YouTubeTranscriptDiagnostics {
  attempt: 'preferred-language' | 'fallback';
  videoId: string;
  preferredLang: string;
  runtime: {
    vercel: boolean;
    region?: string;
    nodeEnv?: string;
  };
  requests: YouTubeTranscriptRequestDiagnostic[];
}

type YouTubeTranscriptLikelyCause =
  | 'network-fetch-error'
  | 'youtube-rate-limited-or-forbidden'
  | 'youtube-bot-protection'
  | 'youtube-consent-page'
  | 'youtube-sign-in-required'
  | 'youtube-video-unavailable'
  | 'preferred-language-unavailable'
  | 'caption-track-fetch-failed'
  | 'caption-track-empty-or-unparseable'
  | 'no-caption-tracks-visible'
  | 'watch-page-missing-player-response'
  | 'unknown';

function getYouTubeFetchPhase(url: string): YouTubeTranscriptFetchPhase {
  if (url.includes('/youtubei/v1/player')) return 'innertube';
  if (url.includes('/watch?')) return 'watch-page';
  if (url.includes('/api/timedtext') || url.includes('/timedtext')) return 'caption-track';
  return 'unknown';
}

function sanitizeDiagnosticUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (getYouTubeFetchPhase(url) === 'caption-track') {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function getRuntimeDiagnostic() {
  return {
    vercel: process.env.VERCEL === '1',
    region: process.env.VERCEL_REGION,
    nodeEnv: process.env.NODE_ENV,
  };
}

function findInlineJsonSignal(html: string, key: string): boolean {
  return html.includes(`var ${key} = `) || html.includes(`"${key}"`);
}

function bodySnippet(body: string): string {
  return body.replace(/\s+/g, ' ').slice(0, 240);
}

async function inspectYouTubeTranscriptResponse(
  phase: YouTubeTranscriptFetchPhase,
  response: Response,
): Promise<Record<string, boolean | number | string | null | undefined>> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.clone().text();

  if (phase === 'innertube') {
    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(text) as {
          captions?: {
            playerCaptionsTracklistRenderer?: {
              captionTracks?: unknown[];
            };
          };
          playabilityStatus?: {
            status?: string;
            reason?: string;
          };
        };
        const captionTracks = json.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        return {
          hasCaptionsObject: Boolean(json.captions),
          hasCaptionTracklist: Boolean(json.captions?.playerCaptionsTracklistRenderer),
          captionTrackCount: Array.isArray(captionTracks) ? captionTracks.length : 0,
          playabilityStatus: json.playabilityStatus?.status,
          playabilityReason: json.playabilityStatus?.reason,
        };
      } catch {
        return {
          jsonParseFailed: true,
          snippet: bodySnippet(text),
        };
      }
    }

    return {
      unexpectedContentType: contentType || null,
      looksLikeHtml: text.includes('<html') || text.includes('<!doctype html'),
      hasCaptcha: text.includes('g-recaptcha') || text.toLowerCase().includes('captcha'),
      snippet: bodySnippet(text),
    };
  }

  if (phase === 'watch-page') {
    return {
      hasPlayabilityStatus: text.includes('"playabilityStatus":'),
      hasYtInitialPlayerResponse: findInlineJsonSignal(text, 'ytInitialPlayerResponse'),
      hasCaptionTracks: text.includes('captionTracks'),
      hasCaptionsRenderer: text.includes('playerCaptionsTracklistRenderer'),
      hasCaptcha: text.includes('g-recaptcha') || text.toLowerCase().includes('captcha'),
      hasConsent: text.includes('consent.youtube.com') || text.includes('Before you continue'),
      hasSignInPrompt: text.includes('ServiceLogin') || text.includes('accounts.google.com'),
      hasBotCheck: text.toLowerCase().includes('unusual traffic'),
      hasUnavailableMessage: text.includes('Video unavailable'),
      snippet: bodySnippet(text),
    };
  }

  if (phase === 'caption-track') {
    return {
      cueCountSrv3: (text.match(/<p\s/g) ?? []).length,
      cueCountClassic: (text.match(/<text\s/g) ?? []).length,
      hasTranscriptText: text.includes('<transcript') || text.includes('<timedtext'),
      snippet: bodySnippet(text),
    };
  }

  return {
    snippet: bodySnippet(text),
  };
}

function createYouTubeDiagnosticFetch(diagnostics: YouTubeTranscriptDiagnostics): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const phase = getYouTubeFetchPhase(url);

    try {
      const response = await fetch(input, init);
      const diagnostic: YouTubeTranscriptRequestDiagnostic = {
        phase,
        url: sanitizeDiagnosticUrl(url),
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      };

      try {
        diagnostic.bodySignals = await inspectYouTubeTranscriptResponse(phase, response);
      } catch (error) {
        diagnostic.error =
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: 'UnknownError', message: String(error) };
      }

      diagnostics.requests.push(diagnostic);
      return response;
    } catch (error) {
      diagnostics.requests.push({
        phase,
        url: sanitizeDiagnosticUrl(url),
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: 'UnknownError', message: String(error) },
      });
      throw error;
    }
  };
}

function getSignal(
  diagnostic: YouTubeTranscriptRequestDiagnostic | undefined,
  key: string,
): boolean | number | string | null | undefined {
  return diagnostic?.bodySignals?.[key];
}

function inferYouTubeTranscriptLikelyCause(
  diagnostics: YouTubeTranscriptDiagnostics,
  error: unknown,
): YouTubeTranscriptLikelyCause {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const innertube = diagnostics.requests.find((request) => request.phase === 'innertube');
  const watchPage = diagnostics.requests.find((request) => request.phase === 'watch-page');
  const captionTrack = diagnostics.requests.find((request) => request.phase === 'caption-track');

  if (diagnostics.requests.some((request) => request.error)) return 'network-fetch-error';
  if (diagnostics.requests.some((request) => request.status === 403 || request.status === 429)) {
    return 'youtube-rate-limited-or-forbidden';
  }
  if (getSignal(watchPage, 'hasCaptcha') || getSignal(watchPage, 'hasBotCheck')) {
    return 'youtube-bot-protection';
  }
  if (getSignal(watchPage, 'hasConsent')) return 'youtube-consent-page';
  if (getSignal(watchPage, 'hasSignInPrompt')) return 'youtube-sign-in-required';
  if (getSignal(watchPage, 'hasUnavailableMessage')) return 'youtube-video-unavailable';
  if (errorMessage.includes('No transcripts are available in')) {
    return 'preferred-language-unavailable';
  }
  if (captionTrack && !captionTrack.ok) return 'caption-track-fetch-failed';
  if (
    captionTrack?.ok &&
    getSignal(captionTrack, 'cueCountSrv3') === 0 &&
    getSignal(captionTrack, 'cueCountClassic') === 0
  ) {
    return 'caption-track-empty-or-unparseable';
  }
  if (watchPage && !getSignal(watchPage, 'hasPlayabilityStatus')) {
    return 'watch-page-missing-player-response';
  }
  if (
    getSignal(innertube, 'captionTrackCount') === 0 &&
    watchPage &&
    !getSignal(watchPage, 'hasCaptionTracks')
  ) {
    return 'no-caption-tracks-visible';
  }

  return 'unknown';
}

function logYouTubeTranscriptError(
  message: string,
  diagnostics: YouTubeTranscriptDiagnostics,
  error: unknown,
) {
  console.error(message, {
    videoId: diagnostics.videoId,
    preferredLang: diagnostics.preferredLang,
    attempt: diagnostics.attempt,
    runtime: diagnostics.runtime,
    likelyCause: inferYouTubeTranscriptLikelyCause(diagnostics, error),
    requests: diagnostics.requests,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : String(error),
  });
}

interface BilibiliPlayerResponse {
  code: number;
  message?: string;
  data?: {
    subtitle?: {
      subtitles?: BilibiliSubtitleInfo[];
    };
  };
}

interface BilibiliNavResponse {
  code: number;
  data?: {
    wbi_img?: {
      img_url?: string;
      sub_url?: string;
    };
  };
}

interface BilibiliSubtitleResponse {
  body?: Array<{
    from: number;
    to: number;
    content: string;
  }>;
}

function normalizeBilibiliSubtitleUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://');
  return url;
}

function pickBilibiliSubtitle(
  subtitles: BilibiliSubtitleInfo[],
  preferredLang: string,
): BilibiliSubtitleInfo | undefined {
  const normalizedPreferred = preferredLang.toLowerCase();
  const isEnglish = (subtitle: BilibiliSubtitleInfo) =>
    subtitle.lan?.toLowerCase().startsWith('en') ||
    subtitle.lan_doc?.toLowerCase().includes('英语') ||
    subtitle.lan_doc?.toLowerCase().includes('english');

  return (
    subtitles.find((subtitle) => subtitle.lan?.toLowerCase() === normalizedPreferred) ??
    subtitles.find((subtitle) => subtitle.lan?.toLowerCase().startsWith(normalizedPreferred)) ??
    (normalizedPreferred.startsWith('en') ? subtitles.find(isEnglish) : undefined) ??
    subtitles[0]
  );
}

function toBilibiliSegments(raw: BilibiliSubtitleResponse): TranscriptSegment[] {
  return (raw.body ?? [])
    .filter((item) => item.content?.trim().length > 0 && item.to > item.from)
    .map((item) => ({
      text: decodeHtmlEntities(item.content.trim()),
      start_time: item.from,
      end_time: item.to,
    }));
}

const WBI_MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54,
  21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

let cachedWbiMixinKey: { value: string; expiresAt: number } | null = null;

function getBilibiliKeyFromUrl(url: string | undefined): string {
  if (!url) return '';
  const fileName = url.split('/').pop() ?? '';
  return fileName.split('.')[0] ?? '';
}

async function getWbiMixinKey(videoId: string): Promise<string | null> {
  if (cachedWbiMixinKey && cachedWbiMixinKey.expiresAt > Date.now()) {
    return cachedWbiMixinKey.value;
  }

  const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: getBilibiliFetchHeaders(videoId),
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;

  const json = (await res.json()) as BilibiliNavResponse;
  const imgKey = getBilibiliKeyFromUrl(json.data?.wbi_img?.img_url);
  const subKey = getBilibiliKeyFromUrl(json.data?.wbi_img?.sub_url);
  const rawKey = `${imgKey}${subKey}`;

  if (rawKey.length === 0) return null;

  const value = WBI_MIXIN_KEY_ENC_TAB.map((index) => rawKey[index])
    .join('')
    .slice(0, 32);
  cachedWbiMixinKey = {
    value,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  return value;
}

async function fetchBilibiliWbiPlayerInfo(
  videoId: string,
  aid: number | undefined,
  cid: number,
): Promise<BilibiliSubtitleInfo[]> {
  try {
    const mixinKey = await getWbiMixinKey(videoId);
    if (!mixinKey) return [];

    const params: Record<string, string> = {
      bvid: videoId,
      cid: String(cid),
      wts: String(Math.floor(Date.now() / 1000)),
    };
    if (aid) params.aid = String(aid);

    const query = Object.keys(params)
      .sort()
      .map((key) => {
        const value = params[key].replace(/[!'()*]/g, '');
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join('&');
    const wRid = crypto
      .createHash('md5')
      .update(query + mixinKey)
      .digest('hex');

    const res = await fetch(`https://api.bilibili.com/x/player/wbi/v2?${query}&w_rid=${wRid}`, {
      headers: getBilibiliFetchHeaders(videoId),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const json = (await res.json()) as BilibiliPlayerResponse;
    return json.data?.subtitle?.subtitles ?? [];
  } catch {
    return [];
  }
}

async function fetchBilibiliPlayerInfo(
  videoId: string,
  aid: number | undefined,
  cid: number,
): Promise<BilibiliSubtitleInfo[]> {
  const params = new URLSearchParams({
    bvid: videoId,
    cid: String(cid),
  });
  if (aid) params.set('aid', String(aid));

  const playerRes = await fetch(`https://api.bilibili.com/x/player/v2?${params}`, {
    headers: getBilibiliFetchHeaders(videoId),
    next: { revalidate: 3600 },
  });

  if (!playerRes.ok) return [];

  const playerJson = (await playerRes.json()) as BilibiliPlayerResponse;
  return playerJson.data?.subtitle?.subtitles ?? [];
}

/**
 * Fetch existing subtitles from a YouTube video.
 * Tries manual subtitles first (higher quality), then auto-generated.
 */
export async function fetchYouTubeSubtitles(
  videoId: string,
  preferredLang: string = 'en',
): Promise<SubtitleFetchResult> {
  // Attempt 1: Fetch manual subtitles in preferred language
  const preferredDiagnostics: YouTubeTranscriptDiagnostics = {
    attempt: 'preferred-language',
    videoId,
    preferredLang,
    runtime: getRuntimeDiagnostic(),
    requests: [],
  };
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: preferredLang,
      fetch: createYouTubeDiagnosticFetch(preferredDiagnostics),
    });

    if (transcript.length > 0) {
      return {
        segments: toSegments(transcript),
        source: transcript[0].lang ? 'manual' : 'auto-generated',
        language: preferredLang,
      };
    }
  } catch (error) {
    logYouTubeTranscriptError(
      '[YouTube Subtitles] Preferred-language fetch failed',
      preferredDiagnostics,
      error,
    );
  }

  // Attempt 2: Fetch any available transcript (auto-generated fallback)
  const fallbackDiagnostics: YouTubeTranscriptDiagnostics = {
    attempt: 'fallback',
    videoId,
    preferredLang,
    runtime: getRuntimeDiagnostic(),
    requests: [],
  };
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      fetch: createYouTubeDiagnosticFetch(fallbackDiagnostics),
    });

    if (transcript.length > 0) {
      return {
        segments: toSegments(transcript),
        source: 'auto-generated',
        language: 'en',
      };
    }
  } catch (error) {
    logYouTubeTranscriptError(
      '[YouTube Subtitles] Fallback transcript fetch failed',
      fallbackDiagnostics,
      error,
    );
  }

  return { segments: [], source: 'none', language: preferredLang };
}

export async function fetchBilibiliSubtitles(
  videoId: string,
  preferredLang: string = 'en',
): Promise<SubtitleFetchResult> {
  try {
    const meta = await fetchBilibiliMeta(videoId);

    if (!meta.cid) {
      return { segments: [], source: 'none', language: preferredLang };
    }

    const playerSubtitles = [
      ...(await fetchBilibiliWbiPlayerInfo(videoId, meta.aid, meta.cid)),
      ...(await fetchBilibiliPlayerInfo(videoId, meta.aid, meta.cid)),
    ];

    const subtitles = [...playerSubtitles, ...(meta.bilibiliSubtitles ?? [])].filter(
      (subtitle) => subtitle.subtitle_url,
    );
    const selected = pickBilibiliSubtitle(subtitles, preferredLang);

    if (!selected?.subtitle_url) {
      return { segments: [], source: 'none', language: preferredLang };
    }

    const subtitleRes = await fetch(normalizeBilibiliSubtitleUrl(selected.subtitle_url), {
      headers: getBilibiliFetchHeaders(videoId),
      next: { revalidate: 3600 },
    });

    if (!subtitleRes.ok) {
      return { segments: [], source: 'none', language: preferredLang };
    }

    const subtitleJson = (await subtitleRes.json()) as BilibiliSubtitleResponse;
    const segments = toBilibiliSegments(subtitleJson);

    return {
      segments,
      source:
        selected.ai_type || selected.ai_status || selected.subtitle_url.includes('ai_subtitle')
          ? 'auto-generated'
          : 'manual',
      language: selected.lan || preferredLang,
    };
  } catch {
    return { segments: [], source: 'none', language: preferredLang };
  }
}

/**
 * Fetch subtitles based on video source type.
 * Bilibili support to be added in Phase 5.
 */
export async function fetchSubtitles(
  sourceType: VideoSourceType,
  videoId: string,
  preferredLang: string = 'en',
): Promise<SubtitleFetchResult> {
  switch (sourceType) {
    case 'youtube':
      return fetchYouTubeSubtitles(videoId, preferredLang);
    case 'bilibili':
      return fetchBilibiliSubtitles(videoId, preferredLang);
    default:
      return { segments: [], source: 'none', language: preferredLang };
  }
}
