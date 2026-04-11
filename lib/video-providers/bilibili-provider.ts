import type { VideoProvider, PlayerState, PlayerEvent, PlayerEventCallback, PlayerOptions } from "./types";

/**
 * Bilibili video provider — stub for Phase 5.
 * Will use postMessage-based iframe communication.
 */
export class BilibiliProvider implements VideoProvider {
  async initialize(
    _container: HTMLDivElement,
    _videoId: string,
    _options?: PlayerOptions,
  ): Promise<void> {
    throw new Error("BilibiliProvider is not yet implemented. Coming in Phase 5.");
  }

  destroy(): void {}
  play(): void {}
  pause(): void {}
  seekTo(_timeSeconds: number): void {}
  getCurrentTime(): number { return 0; }
  getDuration(): number { return 0; }
  getPlayerState(): PlayerState { return "unstarted"; }
  setPlaybackRate(_rate: number): void {}
  setVolume(_volume: number): void {}
  getVolume(): number { return 100; }
  on(_event: PlayerEvent, _callback: PlayerEventCallback): void {}
  off(_event: PlayerEvent, _callback: PlayerEventCallback): void {}
}
