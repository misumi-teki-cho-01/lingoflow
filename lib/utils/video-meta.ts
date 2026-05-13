import type { VideoSourceType } from '@/types/video';
import { fetchYouTubeMeta } from './youtube-meta';

export interface VideoMeta {
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration?: number;
  aid?: number;
  cid?: number;
  bilibiliSubtitles?: BilibiliSubtitleInfo[];
}

export interface BilibiliSubtitleInfo {
  lan?: string;
  lan_doc?: string;
  subtitle_url?: string;
  ai_type?: number;
  ai_status?: number;
  is_lock?: boolean;
}

interface BilibiliViewResponse {
  code: number;
  message?: string;
  data?: {
    aid: number;
    bvid: string;
    cid: number;
    title: string;
    pic: string;
    duration: number;
    owner?: {
      name?: string;
    };
    pages?: Array<{
      cid: number;
      page: number;
      duration: number;
      part?: string;
    }>;
    subtitle?: {
      list?: BilibiliSubtitleInfo[];
    };
  };
}

function normalizeBilibiliUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://');
  return url;
}

export function getBilibiliFetchHeaders(videoId: string): HeadersInit {
  const headers: Record<string, string> = {
    Referer: `https://www.bilibili.com/video/${videoId}`,
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  };

  if (process.env.BILIBILI_COOKIE) {
    headers.Cookie = process.env.BILIBILI_COOKIE;
  }

  return headers;
}

export async function fetchBilibiliMeta(videoId: string): Promise<VideoMeta> {
  const res = await fetch(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(videoId)}`,
    {
      headers: getBilibiliFetchHeaders(videoId),
      next: { revalidate: 3600 },
    },
  );

  if (!res.ok) {
    throw new Error(`Bilibili metadata request failed: ${res.status}`);
  }

  const json = (await res.json()) as BilibiliViewResponse;
  if (json.code !== 0 || !json.data) {
    throw new Error(json.message || `Bilibili metadata request failed with code ${json.code}`);
  }

  const firstPage = json.data.pages?.[0];

  return {
    title: json.data.title || '',
    channelName: json.data.owner?.name || '',
    thumbnailUrl: normalizeBilibiliUrl(json.data.pic),
    duration: json.data.duration,
    aid: json.data.aid,
    cid: firstPage?.cid ?? json.data.cid,
    bilibiliSubtitles: json.data.subtitle?.list ?? [],
  };
}

export async function fetchVideoMeta(source: VideoSourceType, videoId: string): Promise<VideoMeta> {
  if (source === 'bilibili') {
    return fetchBilibiliMeta(videoId);
  }

  if (source === 'local') {
    return {
      title: videoId,
      channelName: 'Local file',
      thumbnailUrl: '',
    };
  }

  const meta = await fetchYouTubeMeta(videoId);
  return {
    title: meta.title,
    channelName: meta.channelName,
    thumbnailUrl: meta.thumbnailUrl,
    duration: meta.duration,
  };
}
