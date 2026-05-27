'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { useTranscriptSync } from '@/hooks/use-transcript-sync';
import { useVideoPlayer } from '@/hooks/use-video-player';
import { usePlaybackProgress } from '@/hooks/use-playback-progress';
import { SubtitleUploadPanel } from '@/components/transcript/subtitle-upload-panel';
import { VideoProgressLine } from '@/components/video/video-progress-line';
import { useSeekStep, VideoTransportControls } from '@/components/video/video-transport-controls';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { LogoutButton } from '@/components/layout/logout-button';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { VideoSessionHeader } from './video-session-header';
import type { TranscriptSegment } from '@/types/transcript';

interface CinemaRoomProps {
  videoId: string;
  title?: string | null;
  videoUrl: string;
  segments: TranscriptSegment[];
  transcriptError?: string;
}

type FeedbackState = {
  tone: 'success' | 'error';
  text: string;
} | null;

const HEADER_IDLE_MS = 1600;

function getCenteredSubtitleRows(
  segments: TranscriptSegment[],
  activeIndex: number,
  currentTime: number,
) {
  if (segments.length === 0) return [];

  const nextIndex = segments.findIndex((segment) => segment.start_time > currentTime);
  const centerIndex =
    activeIndex >= 0 ? activeIndex : nextIndex >= 0 ? nextIndex : Math.max(segments.length - 1, 0);
  const start = Math.max(0, Math.min(centerIndex - 1, segments.length - 3));

  return segments.slice(start, start + 3).map((segment, offset) => ({
    segment,
    index: start + offset,
  }));
}

export function CinemaRoom({
  videoId,
  title,
  videoUrl,
  segments: initialSegments,
  transcriptError,
}: CinemaRoomProps) {
  const t = useTranslations('studyRoom');
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerHoveredRef = useRef(false);
  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>(initialSegments);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [showHeader, setShowHeader] = useState(true);
  const seekStep = useSeekStep();

  const player = useVideoPlayer({ containerRef, videoUrl });
  usePlaybackProgress({
    videoId,
    currentTime: player.currentTime,
    duration: player.duration,
    isReady: player.isReady,
    playerState: player.playerState,
    seekTo: player.seekTo,
  });
  const { activeSegmentIndex } = useTranscriptSync(liveSegments, player.currentTime);

  const subtitleRows = useMemo(
    () => getCenteredSubtitleRows(liveSegments, activeSegmentIndex, player.currentTime),
    [activeSegmentIndex, liveSegments, player.currentTime],
  );

  const handleSubtitleUploaded = useCallback(
    (segments: TranscriptSegment[]) => {
      setLiveSegments(segments);
      setFeedback({ tone: 'success', text: t('subtitleUploadSuccess') });
    },
    [t],
  );

  const clearHeaderTimer = useCallback(() => {
    if (headerTimerRef.current) {
      clearTimeout(headerTimerRef.current);
      headerTimerRef.current = null;
    }
  }, []);

  const scheduleHeaderHide = useCallback(() => {
    clearHeaderTimer();
    headerTimerRef.current = setTimeout(() => {
      if (!headerHoveredRef.current) {
        setShowHeader(false);
      }
    }, HEADER_IDLE_MS);
  }, [clearHeaderTimer]);

  const revealHeader = useCallback(() => {
    setShowHeader(true);
    scheduleHeaderHide();
  }, [scheduleHeaderHide]);

  const focusKeyboardSurface = useCallback(() => {
    shellRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    scheduleHeaderHide();
    return clearHeaderTimer;
  }, [clearHeaderTimer, scheduleHeaderHide]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = document.activeElement as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        player.togglePlay();
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          player.seekBy(-seekStep);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          player.seekBy(seekStep);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [player, seekStep]);

  return (
    <div
      ref={shellRef}
      tabIndex={-1}
      className="relative flex h-full min-h-full flex-col overflow-hidden bg-background"
      onMouseMove={revealHeader}
      onFocus={revealHeader}
    >
      <VideoSessionHeader
        videoId={videoId}
        title={title}
        activeMode="cinema"
        onMouseEnter={() => {
          headerHoveredRef.current = true;
          clearHeaderTimer();
          setShowHeader(true);
        }}
        onMouseLeave={() => {
          headerHoveredRef.current = false;
          scheduleHeaderHide();
        }}
        className={`absolute inset-x-0 top-0 transition-all duration-300 ${
          showHeader ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
        actions={<VideoTransportControls player={player} />}
        trailing={
          <>
            <ThemeSwitcher />
            <LocaleSwitcher />
            <LogoutButton />
          </>
        }
      />

      {feedback && (
        <div className="absolute inset-x-0 top-12 z-20 px-4">
          <div
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              feedback.tone === 'success'
                ? 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-200'
            }`}
          >
            {feedback.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-2 py-2 sm:px-3 lg:px-4">
        {liveSegments.length === 0 ? (
          <div className="flex min-h-full w-full max-w-3xl items-center">
            <SubtitleUploadPanel videoId={videoId} onUploaded={handleSubtitleUploaded} />
          </div>
        ) : (
          <div className="flex min-h-full w-full flex-col justify-center gap-2">
            <div
              className="relative mx-auto aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-white/10"
              style={{ maxWidth: 'min(99vw, calc((100vh - 3rem) * 16 / 9))' }}
            >
              <div ref={containerRef} className="h-full w-full" />

              <div
                className="absolute inset-0 z-10 cursor-pointer"
                role="presentation"
                onPointerDown={focusKeyboardSurface}
                onClick={player.togglePlay}
              />

              <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4 sm:bottom-7 sm:px-8">
                {subtitleRows.length > 0 ? (
                  <div className="pointer-events-auto max-w-[92%] select-text space-y-1 text-center text-white">
                    {subtitleRows.map(({ segment, index }) => {
                      const isActive = index === activeSegmentIndex;

                      return (
                        <p
                          key={`${segment.start_time}-${index}`}
                          className={`cursor-text rounded bg-black/55 px-2.5 py-1 leading-relaxed shadow-[0_2px_10px_rgba(0,0,0,0.65)] [text-shadow:0_1px_3px_rgba(0,0,0,0.95)] ${
                            isActive
                              ? 'text-base font-semibold text-white sm:text-lg'
                              : 'text-sm text-white/70 sm:text-base'
                          }`}
                        >
                          {segment.text}
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <p className="pointer-events-auto max-w-[92%] select-text rounded bg-black/55 px-3 py-1.5 text-center text-sm text-white/75 shadow-[0_2px_10px_rgba(0,0,0,0.65)] [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
                    {transcriptError || t('ccNoSubtitle')}
                  </p>
                )}
              </div>
            </div>

            <div
              className="mx-auto w-full"
              style={{ maxWidth: 'min(99vw, calc((100vh - 3rem) * 16 / 9))' }}
            >
              <VideoProgressLine player={player} onSeekCommit={focusKeyboardSurface} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
