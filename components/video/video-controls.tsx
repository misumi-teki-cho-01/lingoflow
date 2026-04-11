"use client";

import { useState } from "react";
import { Play, Pause, Volume2, VolumeX, Rewind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils/format";
import type { UseVideoPlayerReturn } from "@/hooks/use-video-player";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface VideoControlsProps {
  player: UseVideoPlayerReturn;
}

export function VideoControls({ player }: VideoControlsProps) {
  const {
    play,
    pause,
    seekTo,
    setPlaybackRate,
    toggleMute,
    playerState,
    currentTime,
    duration,
    isReady,
    isMuted,
  } = player;

  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [rate, setRate] = useState(1);

  const isPlaying = playerState === "playing";
  const displayTime = isDragging ? dragValue : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  function handleRangeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setIsDragging(true);
    setDragValue(Number(e.target.value));
  }

  function handleRangeCommit(
    e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>
  ) {
    const val = Number((e.target as HTMLInputElement).value);
    seekTo(val);
    setIsDragging(false);
  }

  function handleRateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRate = Number(e.target.value);
    setRate(newRate);
    setPlaybackRate(newRate);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2 shrink-0">
      {/* Progress bar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-10 text-right tabular-nums">{formatTime(displayTime)}</span>
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
          className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full disabled:opacity-40"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, hsl(var(--muted)) ${progress}%)`,
          }}
        />
        <span className="w-10 tabular-nums">{formatTime(duration)}</span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-1">
        {/* Play / Pause */}
        <Button
          variant="ghost"
          size="icon"
          disabled={!isReady}
          onClick={isPlaying ? pause : play}
          className="h-8 w-8"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        {/* Mute — actually calls setVolume on the provider */}
        <Button
          variant="ghost"
          size="icon"
          disabled={!isReady}
          onClick={toggleMute}
          className="h-8 w-8"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        <div className="flex-1" />

        {/* Playback rate */}
        <select
          value={rate}
          onChange={handleRateChange}
          disabled={!isReady}
          className="rounded border border-border bg-background px-2 py-0.5 text-xs disabled:opacity-40 cursor-pointer"
        >
          {PLAYBACK_RATES.map((r) => (
            <option key={r} value={r}>
              {r}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
