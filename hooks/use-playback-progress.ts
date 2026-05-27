'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { PlayerState } from '@/types/video';

interface UsePlaybackProgressOptions {
  videoId: string;
  currentTime: number;
  duration: number;
  isReady: boolean;
  playerState: PlayerState;
  seekTo: (time: number) => void;
}

const MIN_RESTORE_SECONDS = 3;
const END_BUFFER_SECONDS = 5;
const SAVE_INTERVAL_MS = 5000;
const MIN_SAVE_DELTA_SECONDS = 2;

function getStorageKey(videoId: string) {
  return `video-progress-${videoId}`;
}

function getLocalPosition(videoId: string): number | null {
  try {
    const raw = localStorage.getItem(getStorageKey(videoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { position?: unknown };
    return typeof parsed.position === 'number' && Number.isFinite(parsed.position)
      ? parsed.position
      : null;
  } catch {
    return null;
  }
}

function setLocalPosition(videoId: string, position: number, duration: number) {
  try {
    localStorage.setItem(
      getStorageKey(videoId),
      JSON.stringify({
        position,
        duration,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* ignore storage access issues */
  }
}

function normalizePosition(position: number, duration: number) {
  if (!Number.isFinite(position) || position < MIN_RESTORE_SECONDS) return 0;
  if (duration > 0 && position >= duration - END_BUFFER_SECONDS) return 0;
  return Math.max(0, position);
}

export function usePlaybackProgress({
  videoId,
  currentTime,
  duration,
  isReady,
  playerState,
  seekTo,
}: UsePlaybackProgressOptions) {
  const restoredRef = useRef(false);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const playerStateRef = useRef(playerState);
  const lastSavedAtRef = useRef(0);
  const lastSavedPositionRef = useRef(0);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    restoredRef.current = false;
    lastSavedAtRef.current = 0;
    lastSavedPositionRef.current = 0;
  }, [videoId]);

  useEffect(() => {
    if (!isReady || restoredRef.current) return;

    const localPosition = getLocalPosition(videoId);
    const position = normalizePosition(localPosition ?? 0, durationRef.current);

    restoredRef.current = true;
    if (position > 0) {
      seekTo(position);
    }
  }, [isReady, seekTo, videoId]);

  const saveProgressLocally = useCallback(() => {
    const rawPosition = currentTimeRef.current;

    if (playerStateRef.current !== 'ended' && rawPosition < MIN_RESTORE_SECONDS) {
      return null;
    }

    const position =
      playerStateRef.current === 'ended' ? 0 : normalizePosition(rawPosition, durationRef.current);
    setLocalPosition(videoId, position, durationRef.current);
    return position;
  }, [videoId]);

  useEffect(() => {
    if (!isReady || playerState === 'unstarted' || playerState === 'cued') return;

    const now = Date.now();
    const shouldSaveImmediately = playerState === 'paused' || playerState === 'ended';
    const movedEnough = Math.abs(currentTime - lastSavedPositionRef.current) >= MIN_SAVE_DELTA_SECONDS;
    const intervalElapsed = now - lastSavedAtRef.current >= SAVE_INTERVAL_MS;

    if (!shouldSaveImmediately && (!movedEnough || !intervalElapsed)) return;

    lastSavedAtRef.current = now;
    lastSavedPositionRef.current = currentTime;
    saveProgressLocally();
  }, [currentTime, isReady, playerState, saveProgressLocally]);

  useEffect(() => {
    const handlePageHide = () => saveProgressLocally();
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      saveProgressLocally();
    };
  }, [saveProgressLocally]);
}
