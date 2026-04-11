"use client";

import { useRef } from "react";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { useTranscriptSync } from "@/hooks/use-transcript-sync";
import { VideoControls } from "@/components/video/video-controls";
import { TranscriptPanel } from "@/components/transcript/transcript-panel";
import type { TranscriptSegment } from "@/types/transcript";
import type { TranscriptSource } from "@/lib/pipeline/transcription-pipeline";

interface VideoStudyRoomProps {
  videoId: string;
  segments: TranscriptSegment[];
  transcriptSource?: TranscriptSource;
  transcriptError?: string;
}

export function VideoStudyRoom({
  videoId,
  segments,
  transcriptSource,
  transcriptError,
}: VideoStudyRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const player = useVideoPlayer({
    containerRef,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  });

  const { activeSegmentIndex } = useTranscriptSync(segments, player.currentTime);

  return (
    <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-4 min-h-0 overflow-hidden">
      <div className="grid grid-cols-1 gap-4 h-full lg:grid-cols-3">

        {/* Left — player + controls */}
        <div className="flex flex-col gap-3 lg:col-span-2 min-h-0">
          <div
            ref={containerRef}
            className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg"
          />
          <VideoControls player={player} />
        </div>

        {/* Right — transcript panel */}
        <div className="min-h-[400px] lg:min-h-0">
          <TranscriptPanel
            segments={segments}
            activeSegmentIndex={activeSegmentIndex}
            onSegmentClick={player.seekTo}
            source={transcriptSource}
            errorMessage={transcriptError}
          />
        </div>

      </div>
    </div>
  );
}
