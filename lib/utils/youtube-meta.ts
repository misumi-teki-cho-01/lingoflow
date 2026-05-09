export interface YouTubeMeta {
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration?: number;
}

const FALLBACK: YouTubeMeta = {
  title: '',
  channelName: '',
  thumbnailUrl: '',
};

/**
 * Fetches basic video metadata from YouTube's public oEmbed endpoint.
 * No API key required. Falls back to empty strings on failure.
 */
export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const [oembedRes, watchRes] = await Promise.all([
      fetch(oembedUrl, { next: { revalidate: 60 * 60 * 24 } }),
      fetch(watchUrl, { next: { revalidate: 60 * 60 * 24 } }),
    ]);

    if (!oembedRes.ok) return FALLBACK;

    const data = await oembedRes.json();
    const html = watchRes.ok ? await watchRes.text() : '';
    const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);

    return {
      title: data.title ?? '',
      channelName: data.author_name ?? '',
      thumbnailUrl: data.thumbnail_url ?? '',
      duration: durationMatch ? Number(durationMatch[1]) : undefined,
    };
  } catch {
    return FALLBACK;
  }
}
