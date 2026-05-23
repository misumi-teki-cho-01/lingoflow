'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/utils/format';
import type { UseVideoPlayerReturn } from '@/hooks/use-video-player';

interface VideoProgressLineProps {
  player: UseVideoPlayerReturn;
  seekStep?: number;
  onSeekCommit?: () => void;
  className?: string;
}

export function VideoProgressLine({
  player,
  seekStep,
  onSeekCommit,
  className,
}: VideoProgressLineProps) {
  const { currentTime, duration, isReady, seekBy, seekTo } = player;
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [hoverState, setHoverState] = useState<{ time: number; progress: number } | null>(null);

  const displayTime = isDragging ? dragValue : currentTime;
  const progress = duration > 0 ? Math.max(0, Math.min(100, (displayTime / duration) * 100)) : 0;
  const tooltip = isDragging
    ? { time: dragValue, progress }
    : hoverState && duration > 0
      ? hoverState
      : null;

  function getTimeFromPointer(clientX: number, element: HTMLElement) {
    if (duration <= 0) return { time: 0, progress: 0 };
    const rect = element.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return {
      time: ratio * duration,
      progress: ratio * 100,
    };
  }

  function handleRangeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setIsDragging(true);
    setDragValue(Number(e.target.value));
  }

  function handleRangeCommit(
    e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>,
  ) {
    const val = Number((e.target as HTMLInputElement).value);
    seekTo(val);
    setIsDragging(false);
    onSeekCommit?.();
  }

  return (
    <div
      className={cn('flex items-center gap-3 px-1 py-1 text-xs text-muted-foreground', className)}
    >
      <span className="w-11 text-right tabular-nums">{formatTime(displayTime)}</span>
      <div
        className={cn(
          'group relative flex h-6 flex-1 items-center',
          !isReady && 'pointer-events-none opacity-40',
        )}
        onMouseMove={(event) =>
          setHoverState(getTimeFromPointer(event.clientX, event.currentTarget))
        }
        onMouseLeave={() => setHoverState(null)}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-border/80">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100"
          style={{ left: `${progress}%` }}
        />
        {tooltip && (
          <div
            className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium tabular-nums text-popover-foreground shadow-sm"
            style={{ left: `${tooltip.progress}%` }}
          >
            {formatTime(tooltip.time)}
          </div>
        )}
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={displayTime}
          disabled={!isReady}
          onChange={handleRangeChange}
          onMouseUp={handleRangeCommit}
          onTouchEnd={handleRangeCommit}
          onKeyDown={(e) => {
            if (!seekStep) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              seekBy(e.key === 'ArrowLeft' ? -seekStep : seekStep);
            }
          }}
          className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 cursor-pointer appearance-none bg-transparent opacity-0"
        />
      </div>
      <span className="w-11 tabular-nums">{formatTime(duration)}</span>
    </div>
  );
}
