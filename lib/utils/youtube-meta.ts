export interface YouTubeMeta {
  title: string;
  channelName: string;
  thumbnailUrl: string;
}

const FALLBACK: YouTubeMeta = {
  title: "",
  channelName: "",
  thumbnailUrl: "",
};

/**
 * Fetches basic video metadata from YouTube's public oEmbed endpoint.
 * No API key required. Falls back to empty strings on failure.
 */
export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); // cache 24h

    if (!res.ok) return FALLBACK;

    const data = await res.json();
    return {
      title: data.title ?? "",
      channelName: data.author_name ?? "",
      thumbnailUrl: data.thumbnail_url ?? "",
    };
  } catch {
    return FALLBACK;
  }
}
