"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PlayerState, VideoProvider } from "@/types/video";
import { createVideoProvider, detectVideoSource } from "@/lib/video-providers";
import {
  DEFAULT_REWIND_DURATION,
  PAUSE_DEBOUNCE_MS,
  AUTO_RESUME_DELAY_MS,
} from "@/lib/utils/constants";

export interface UseVideoPlayerOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  videoUrl: string;
  rewindDuration?: number;
  autoResumeAfterRewind?: boolean;
  onTimeUpdate?: (time: number) => void;
  onStateChange?: (state: PlayerState) => void;
}

export interface UseVideoPlayerReturn {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  currentTime: number;
  duration: number;
  playerState: PlayerState;
  isReady: boolean;
  isMuted: boolean;
  setPlaybackRate: (rate: number) => void;
  // Shadow practice
  shadowRewind: () => void;
  rewindDuration: number;
  setRewindDuration: (seconds: number) => void;
  isShadowMode: boolean;
  setShadowMode: (enabled: boolean) => void;
}

export function useVideoPlayer({
  containerRef,
  videoUrl,
  rewindDuration: initialRewindDuration = DEFAULT_REWIND_DURATION,
  autoResumeAfterRewind = false,
  onTimeUpdate,
  onStateChange,
}: UseVideoPlayerOptions): UseVideoPlayerReturn {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerState, setPlayerState] = useState<PlayerState>("unstarted");
  const [isReady, setIsReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isShadowMode, setShadowMode] = useState(false);
  const [rewindDuration, setRewindDuration] = useState(initialRewindDuration);

  const providerRef = useRef<VideoProvider | null>(null);
  const isRewinding = useRef(false);
  const isProgrammaticPause = useRef(false);
  const lastPlayTimestamp = useRef(0);

  // Store latest callbacks in refs to avoid stale closures
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  // Initialize player
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !videoUrl) return;

    const parsed = detectVideoSource(videoUrl);
    if (!parsed) return;

    const provider = createVideoProvider(parsed.source);
    providerRef.current = provider;

    provider.on("ready", () => {
      setIsReady(true);
      setDuration(provider.getDuration());
    });

    provider.on("timeUpdate", (time) => {
      const t = time as number;
      setCurrentTime(t);
      onTimeUpdateRef.current?.(t);
    });

    provider.on("stateChange", (state) => {
      const s = state as PlayerState;
      setPlayerState(s);
      onStateChangeRef.current?.(s);
    });

    provider.initialize(container, parsed.videoId).catch(console.error);

    return () => {
      provider.destroy();
      providerRef.current = null;
      setIsReady(false);
    };
  }, [containerRef, videoUrl]);

  // Shadow practice: pause-rewind state machine
  useEffect(() => {
    if (!isShadowMode || !providerRef.current) return;

    const provider = providerRef.current;

    const handleStateForShadow = (state: unknown) => {
      const s = state as PlayerState;

      if (s === "playing") {
        lastPlayTimestamp.current = Date.now();
        isRewinding.current = false;
      }

      if (s === "paused") {
        // Guard 1: ignore programmatic pauses from our own seekTo
        if (isProgrammaticPause.current) {
          isProgrammaticPause.current = false;
          return;
        }

        // Guard 2: debounce rapid pause/play
        if (Date.now() - lastPlayTimestamp.current < PAUSE_DEBOUNCE_MS) {
          return;
        }

        // Execute rewind
        const time = provider.getCurrentTime();
        const target = Math.max(0, time - rewindDuration);
        isRewinding.current = true;
        isProgrammaticPause.current = true;
        provider.seekTo(target);

        if (autoResumeAfterRewind) {
          setTimeout(() => {
            if (isRewinding.current) {
              provider.play();
              isRewinding.current = false;
            }
          }, AUTO_RESUME_DELAY_MS);
        }
      }
    };

    provider.on("stateChange", handleStateForShadow);
    return () => provider.off("stateChange", handleStateForShadow);
  }, [isShadowMode, rewindDuration, autoResumeAfterRewind]);

  const play = useCallback(() => providerRef.current?.play(), []);
  const pause = useCallback(() => providerRef.current?.pause(), []);
  const toggleMute = useCallback(() => {
    const p = providerRef.current;
    if (!p) return;
    if (isMuted) {
      p.setVolume(100);
      setIsMuted(false);
    } else {
      p.setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted]);
  const seekTo = useCallback((time: number) => {
    isRewinding.current = false;
    providerRef.current?.seekTo(time);
  }, []);
  const togglePlay = useCallback(() => {
    if (playerState === "playing") {
      providerRef.current?.pause();
    } else {
      providerRef.current?.play();
    }
  }, [playerState]);

  const setPlaybackRate = useCallback((rate: number) => {
    providerRef.current?.setPlaybackRate(rate);
  }, []);

  const shadowRewind = useCallback(() => {
    const provider = providerRef.current;
    if (!provider) return;
    const time = provider.getCurrentTime();
    const target = Math.max(0, time - rewindDuration);
    provider.seekTo(target);
  }, [rewindDuration]);

  return {
    play,
    pause,
    seekTo,
    togglePlay,
    toggleMute,
    currentTime,
    duration,
    playerState,
    isReady,
    isMuted,
    setPlaybackRate,
    shadowRewind,
    rewindDuration,
    setRewindDuration,
    isShadowMode,
    setShadowMode,
  };
}
