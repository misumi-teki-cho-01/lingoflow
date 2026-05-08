import type { VideoProvider, PlayerState, PlayerEvent, PlayerEventCallback, PlayerOptions } from "./types";

/**
 * Bilibili video provider — stub for Phase 5.
 * Will use postMessage-based iframe communication.
 */
export class BilibiliProvider implements VideoProvider {
  async initialize(
    container: HTMLDivElement,
    videoId: string,
    options?: PlayerOptions,
  ): Promise<void> {
    void container;
    void videoId;
    void options;
    throw new Error("BilibiliProvider is not yet implemented. Coming in Phase 5.");
  }

  destroy(): void {}
  play(): void {}
  pause(): void {}
  seekTo(timeSeconds: number): void { void timeSeconds; }
  getCurrentTime(): number { return 0; }
  getDuration(): number { return 0; }
  getPlayerState(): PlayerState { return "unstarted"; }
  setPlaybackRate(rate: number): void { void rate; }
  setVolume(volume: number): void { void volume; }
  getVolume(): number { return 100; }
  on(event: PlayerEvent, callback: PlayerEventCallback): void {
    void event;
    void callback;
  }
  off(event: PlayerEvent, callback: PlayerEventCallback): void {
    void event;
    void callback;
  }
}
