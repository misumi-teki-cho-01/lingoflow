"use client";

import { useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Rewind, FastForward } from "lucide-react";
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
    seekBy,
    togglePlay,
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
  const [seekStep, setSeekStep] = useState(5);

  // Load saved seekStep from localStorage on mount.
  useEffect(() => {
    const saved = localStorage.getItem("lingoflow-seek-step");
    if (saved) {
      setSeekStep(Number(saved));
    }
  }, []);

  const handleSeekStepChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    setSeekStep(val);
    localStorage.setItem("lingoflow-seek-step", String(val));
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 🐛 Global Key Logger to see EVERYTHING that passes through
      // console.log("[Global KeyDown]", e.key, e.code, "alt:", e.altKey, "meta:", e.metaKey, "ctrl:", e.ctrlKey);

      // 1. Global Shortcuts allowed EVERYWHERE (even while typing)
      // Accept ANY modifier (Ctrl, Alt/Option, or Cmd)
      const hasModifier = e.altKey || e.ctrlKey || e.metaKey;

      // Strict physical key detection bypassing Mac weird character maps
      const isJ = e.code === "KeyJ" || e.key.toLowerCase() === "j" || e.key === "∆";
      const isL = e.code === "KeyL" || e.key.toLowerCase() === "l" || e.key === "¬";

      if (hasModifier && isJ) {
        e.preventDefault();
        e.stopPropagation();
        seekBy(-seekStep);
        return;
      }
      if (hasModifier && isL) {
        e.preventDefault();
        e.stopPropagation();
        seekBy(seekStep);
        return;
      }

      // Safely cast to HTMLElement
      const target = document.activeElement as HTMLElement | null;

      // Don't intercept naked arrows/space if user is typing
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      // 3. Spacebar to toggle Play/Pause
      if (e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        return;
      }

      // 2. Naked Arrow keys (no modifiers), ONLY intercepted when NOT typing
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          seekBy(-seekStep);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          seekBy(seekStep);
        }
      }
    };

    // Use capture phase (true) to intercept the key BEFORE TipTap's contenteditable receives it!
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [seekStep, seekBy, togglePlay]);

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

        {/* Seek Controls */}
        <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
          <select
            value={seekStep}
            onChange={handleSeekStepChange}
            disabled={!isReady}
            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs disabled:opacity-40 cursor-pointer outline-none focus:ring-1 focus:ring-ring"
            title="Fast-forward/Rewind duration"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>±{s}s</option>
            ))}
          </select>

          <Button
            variant="ghost"
            size="icon"
            disabled={!isReady}
            onClick={() => seekBy(-seekStep)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={`Rewind ${seekStep}s (Cmd/Ctrl+J or ←)`}
          >
            <Rewind className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            disabled={!isReady}
            onClick={() => seekBy(seekStep)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={`Forward ${seekStep}s (Cmd/Ctrl+L or →)`}
          >
            <FastForward className="h-3.5 w-3.5" />
          </Button>
        </div>

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
