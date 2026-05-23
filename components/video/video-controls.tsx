'use client';

import { useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoProgressLine } from '@/components/video/video-progress-line';
import { useSeekStep, VideoTransportControls } from '@/components/video/video-transport-controls';
import type { UseVideoPlayerReturn } from '@/hooks/use-video-player';

interface VideoControlsProps {
  player: UseVideoPlayerReturn;
}

export function VideoControls({ player }: VideoControlsProps) {
  const { play, pause, seekBy, togglePlay, toggleMute, playerState, isReady, isMuted } = player;

  const seekStep = useSeekStep();

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 🐛 Global Key Logger to see EVERYTHING that passes through
      // console.log("[Global KeyDown]", e.key, e.code, "alt:", e.altKey, "meta:", e.metaKey, "ctrl:", e.ctrlKey);

      // 1. Global Shortcuts allowed EVERYWHERE (even while typing)
      // Accept ANY modifier (Ctrl, Alt/Option, or Cmd)
      const hasModifier = e.altKey || e.ctrlKey || e.metaKey;

      // Strict physical key detection bypassing Mac weird character maps
      const isJ = e.code === 'KeyJ' || e.key.toLowerCase() === 'j' || e.key === '∆';
      const isL = e.code === 'KeyL' || e.key.toLowerCase() === 'l' || e.key === '¬';

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
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      // 3. Spacebar to toggle Play/Pause
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        return;
      }

      // 2. Naked Arrow keys (no modifiers), ONLY intercepted when NOT typing
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          seekBy(-seekStep);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          seekBy(seekStep);
        }
      }
    };

    // Use capture phase (true) to intercept the key BEFORE TipTap's contenteditable receives it!
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [seekStep, seekBy, togglePlay]);

  const isPlaying = playerState === 'playing';

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2 shrink-0">
      {/* Progress bar */}
      <VideoProgressLine player={player} seekStep={seekStep} className="gap-2 px-0" />

      {/* Controls row */}
      <div className="flex items-center gap-1">
        {/* Play / Pause */}
        <Button
          variant="ghost"
          size="icon"
          disabled={!isReady}
          onClick={isPlaying ? pause : play}
          className="h-8 w-8"
          aria-label={isPlaying ? 'Pause' : 'Play'}
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
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        <div className="flex-1" />

        <VideoTransportControls
          player={player}
          className="border-transparent bg-transparent px-0 py-0"
        />
      </div>
    </div>
  );
}
