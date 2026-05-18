'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Captions,
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  FastForward,
  Rewind,
  TriangleAlert,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranscriptSync } from '@/hooks/use-transcript-sync';
import { useVideoPlayer } from '@/hooks/use-video-player';
import { SubtitleUploadPanel } from '@/components/transcript/subtitle-upload-panel';
import { VideoProgressLine } from '@/components/video/video-progress-line';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { Button } from '@/components/ui/button';
import type { TranscriptSegment } from '@/types/transcript';

interface CinemaRoomProps {
  videoId: string;
  videoUrl: string;
  segments: TranscriptSegment[];
  transcriptError?: string;
}

type FeedbackState = {
  tone: 'success' | 'error';
  text: string;
} | null;

const HEADER_IDLE_MS = 1600;
const SEEK_STEP_KEY = 'lingoflow-seek-step';
const DEFAULT_SEEK_STEP = 5;
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function getInitialSeekStep() {
  if (typeof window === 'undefined') return DEFAULT_SEEK_STEP;
  const saved = window.localStorage.getItem(SEEK_STEP_KEY);
  const parsed = saved ? Number(saved) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEEK_STEP;
}

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
  const [seekStep, setSeekStep] = useState(getInitialSeekStep);
  const [playbackRate, setPlaybackRate] = useState(1);

  const player = useVideoPlayer({ containerRef, videoUrl });
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

  const handleSeekStepChange = useCallback((value: number) => {
    setSeekStep(value);
    window.localStorage.setItem(SEEK_STEP_KEY, String(value));
    window.dispatchEvent(new Event('lingoflow-seek-step-change'));
  }, []);

  const handlePlaybackRateChange = useCallback(
    (value: number) => {
      setPlaybackRate(value);
      player.setPlaybackRate(value);
    },
    [player],
  );

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
      <header
        onMouseEnter={() => {
          headerHoveredRef.current = true;
          clearHeaderTimer();
          setShowHeader(true);
        }}
        onMouseLeave={() => {
          headerHoveredRef.current = false;
          scheduleHeaderHide();
        }}
        className={`absolute inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-background/80 px-4 py-2 shadow-sm backdrop-blur-md transition-all duration-300 ${
          showHeader
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('back')}
        </Link>

        <div className="flex-1" />

        <ThemeSwitcher />

        <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-1 py-0.5 text-xs">
          <select
            value={seekStep}
            onChange={(event) => handleSeekStepChange(Number(event.target.value))}
            disabled={!player.isReady}
            className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground disabled:opacity-40"
            title="Fast-forward/Rewind duration"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((seconds) => (
              <option key={seconds} value={seconds}>
                ±{seconds}s
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            disabled={!player.isReady}
            onClick={() => player.seekBy(-seekStep)}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            title={`Rewind ${seekStep}s`}
          >
            <Rewind className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!player.isReady}
            onClick={() => player.seekBy(seekStep)}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            title={`Forward ${seekStep}s`}
          >
            <FastForward className="h-3.5 w-3.5" />
          </Button>
          <select
            value={playbackRate}
            onChange={(event) => handlePlaybackRateChange(Number(event.target.value))}
            disabled={!player.isReady}
            className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground disabled:opacity-40"
            title="Playback rate"
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center rounded-full border border-border bg-muted/30 p-0.5 text-xs">
          <Link
            href={`/video/${videoId}?mode=cc`}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-muted-foreground transition-all hover:text-foreground"
          >
            <Captions className="h-3.5 w-3.5" />
            {t('studyMode')}
          </Link>
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground shadow-sm">
            <Clapperboard className="h-3.5 w-3.5" />
            {t('cinemaMode')}
          </span>
        </div>
      </header>

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
