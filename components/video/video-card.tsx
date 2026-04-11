import { Link } from "@/i18n/navigation";
import { Play, Clock } from "lucide-react";
import { formatTime } from "@/lib/utils/format";

export interface VideoCardData {
  video_ext_id: string;
  title: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  source_type: string;
}

interface VideoCardProps {
  video: VideoCardData;
}

/**
 * Reusable video card — links to /video/{video_ext_id}.
 * Displays thumbnail, title, channel name, and duration badge.
 */
export function VideoCard({ video }: VideoCardProps) {
  const thumbnail =
    video.thumbnail_url ??
    `https://img.youtube.com/vi/${video.video_ext_id}/hqdefault.jpg`;

  return (
    <Link
      href={`/video/${video.video_ext_id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnail}
          alt={video.title ?? "Video thumbnail"}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30">
          <div className="rounded-full bg-white/90 p-3 shadow-lg">
            <Play className="h-5 w-5 fill-black text-black" />
          </div>
        </div>

        {/* Duration badge */}
        {video.duration != null && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] text-white font-mono">
            <Clock className="h-2.5 w-2.5" />
            {formatTime(video.duration)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {video.title ?? video.video_ext_id}
        </p>
        {video.channel_name && (
          <p className="text-xs text-muted-foreground truncate">{video.channel_name}</p>
        )}
      </div>
    </Link>
  );
}
