'use client';

import { useState } from 'react';
import { formatTime } from '@/lib/utils/format';
import type { UseVideoPlayerReturn } from '@/hooks/use-video-player';

interface VideoProgressLineProps {
  player: UseVideoPlayerReturn;
  onSeekCommit?: () => void;
}

export function VideoProgressLine({ player, onSeekCommit }: VideoProgressLineProps) {
  const { currentTime, duration, isReady, seekTo } = player;
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const displayTime = isDragging ? dragValue : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

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
    <div className="flex items-center gap-3 px-1 py-1 text-xs text-muted-foreground">
      <span className="w-11 text-right tabular-nums">{formatTime(displayTime)}</span>
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
        className="h-px flex-1 cursor-pointer appearance-none rounded-full disabled:opacity-40"
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, hsl(var(--border)) ${progress}%)`,
        }}
      />
      <span className="w-11 tabular-nums">{formatTime(duration)}</span>
    </div>
  );
}
