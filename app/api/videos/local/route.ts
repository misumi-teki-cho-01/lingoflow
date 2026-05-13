import { NextResponse } from 'next/server';
import { getVideoByExtId, insertVideo } from '@/lib/db/videos';

interface LocalVideoImportRequest {
  videoId?: string;
  title?: string;
  duration?: number | null;
  mimeType?: string;
  size?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LocalVideoImportRequest;
    const videoId = body.videoId?.trim();

    if (!videoId || !/^local-[a-f0-9-]+$/i.test(videoId)) {
      return NextResponse.json({ error: 'Invalid local video id' }, { status: 400 });
    }

    const existing = await getVideoByExtId(videoId);
    if (existing) {
      return NextResponse.json({ videoId, existed: true }, { status: 200 });
    }

    await insertVideo({
      url: `local://${videoId}`,
      source_type: 'local',
      video_ext_id: videoId,
      title: body.title?.trim() || 'Local video',
      channel_name: 'Local file',
      thumbnail_url: null,
      duration:
        typeof body.duration === 'number' && Number.isFinite(body.duration)
          ? Math.round(body.duration)
          : null,
      language: 'en',
    });

    return NextResponse.json({ videoId, existed: false }, { status: 201 });
  } catch (error) {
    console.error('[Local Video Import]', error);
    return NextResponse.json({ error: 'Failed to save local video' }, { status: 500 });
  }
}
