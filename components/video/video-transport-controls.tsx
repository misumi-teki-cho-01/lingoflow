'use client';

import { useState, useSyncExternalStore } from 'react';
import { FastForward, Rewind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { UseVideoPlayerReturn } from '@/hooks/use-video-player';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SEEK_STEP_KEY = 'lingoflow-seek-step';
const SEEK_STEP_CHANGED_EVENT = 'lingoflow-seek-step-change';
const DEFAULT_SEEK_STEP = 5;

function getSeekStepSnapshot() {
  if (typeof window === 'undefined') return DEFAULT_SEEK_STEP;
  const saved = window.localStorage.getItem(SEEK_STEP_KEY);
  const parsed = saved ? Number(saved) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEEK_STEP;
}

function subscribeToSeekStep(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('storage', onStoreChange);
  window.addEventListener(SEEK_STEP_CHANGED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(SEEK_STEP_CHANGED_EVENT, onStoreChange);
  };
}

export function useSeekStep() {
  return useSyncExternalStore(subscribeToSeekStep, getSeekStepSnapshot, () => DEFAULT_SEEK_STEP);
}

interface VideoTransportControlsProps {
  player: UseVideoPlayerReturn;
  className?: string;
}

export function VideoTransportControls({ player, className }: VideoTransportControlsProps) {
  const seekStep = useSeekStep();
  const [playbackRate, setPlaybackRate] = useState(1);

  const handleSeekStepChange = (value: number) => {
    window.localStorage.setItem(SEEK_STEP_KEY, String(value));
    window.dispatchEvent(new Event(SEEK_STEP_CHANGED_EVENT));
  };

  const handlePlaybackRateChange = (value: number) => {
    setPlaybackRate(value);
    player.setPlaybackRate(value);
  };

  const compactTriggerClass =
    'h-7 rounded-full border-border bg-background px-2.5 py-0 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40';

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-border bg-muted/30 px-1 py-0.5 text-xs',
        className,
      )}
    >
      <Select<number>
        value={seekStep}
        onValueChange={(value) => {
          if (value !== null) handleSeekStepChange(value);
        }}
        disabled={!player.isReady}
      >
        <SelectTrigger className={compactTriggerClass} title="Fast-forward/Rewind duration">
          <SelectValue>±{seekStep}s</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((seconds) => (
            <SelectItem key={seconds} value={seconds}>
              ±{seconds}s
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      <Select<number>
        value={playbackRate}
        onValueChange={(value) => {
          if (value !== null) handlePlaybackRateChange(value);
        }}
        disabled={!player.isReady}
      >
        <SelectTrigger className={compactTriggerClass} title="Playback rate">
          <SelectValue>{playbackRate}x</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PLAYBACK_RATES.map((rate) => (
            <SelectItem key={rate} value={rate}>
              {rate}x
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
