export type VideoSourceType = 'youtube' | 'bilibili';

export interface VideoSource {
  type: VideoSourceType;
  videoId: string;
  url: string;
}

export type PlayerState =
  | 'unstarted'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'cued';

export type PlayerEvent =
  | 'ready'
  | 'stateChange'
  | 'timeUpdate'
  | 'error'
  | 'playbackRateChange';

export type PlayerEventCallback = (data: unknown) => void;

export interface PlayerOptions {
  autoplay?: boolean;
  startTime?: number;
  playbackRate?: number;
  muted?: boolean;
}

export interface VideoProvider {
  initialize(
    container: HTMLDivElement,
    videoId: string,
    options?: PlayerOptions,
  ): Promise<void>;
  destroy(): void;
  play(): void;
  pause(): void;
  seekTo(timeSeconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): PlayerState;
  setPlaybackRate(rate: number): void;
  setVolume(volume: number): void;
  getVolume(): number;
  on(event: PlayerEvent, callback: PlayerEventCallback): void;
  off(event: PlayerEvent, callback: PlayerEventCallback): void;
}
