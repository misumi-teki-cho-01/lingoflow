import type { VideoProvider, PlayerState, PlayerEvent, PlayerEventCallback, PlayerOptions } from "./types";
import { EventEmitter } from "./types";

// YouTube IFrame API type declarations
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: Record<string, unknown>;
    events?: {
      onReady?: (event: { target: Player }) => void;
      onStateChange?: (event: { data: number }) => void;
      onError?: (event: { data: number }) => void;
    };
  }
  class Player {
    constructor(element: HTMLDivElement | string, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    setPlaybackRate(rate: number): void;
    setVolume(volume: number): void;
    getVolume(): number;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    destroy(): void;
  }
}

/** Module-level promise ensuring YT IFrame API script loads exactly once */
let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && window.YT?.Player) {
      resolve();
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}

const YT_STATE_MAP: Record<number, PlayerState> = {
  [-1]: "unstarted",
  [0]: "ended",
  [1]: "playing",
  [2]: "paused",
  [3]: "buffering",
  [5]: "cued",
};

export class YouTubeProvider implements VideoProvider {
  private player: YT.Player | null = null;
  private container: HTMLDivElement | null = null;
  private emitter = new EventEmitter();
  private timeUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private currentState: PlayerState = "unstarted";

  async initialize(
    container: HTMLDivElement,
    videoId: string,
    options?: PlayerOptions,
  ): Promise<void> {
    await loadYouTubeAPI();

    this.container = container;

    // ── Strategy: create a throwaway <div> placeholder inside `container`.
    // YouTube replaces the PLACEHOLDER (not `container`), so `container` stays
    // in the DOM across React StrictMode double-invocations and re-renders.
    // The iframe YouTube creates will be a child of `container`, inheriting
    // its dimensions (width: 100%; height: 100%) correctly.
    container.innerHTML = ""; // clear any leftover from prev init
    const placeholder = document.createElement("div");
    placeholder.style.cssText = "width:100%;height:100%;";
    container.appendChild(placeholder);

    return new Promise<void>((resolve) => {
      this.player = new window.YT.Player(placeholder, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: options?.autoplay ? 1 : 0,
          start: options?.startTime ? Math.floor(options.startTime) : undefined,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            if (options?.muted) this.player?.mute();
            this.startTimeUpdates();
            this.emitter.emit("ready");
            resolve();
          },
          onStateChange: (event) => {
            const state = YT_STATE_MAP[event.data] ?? "unstarted";
            this.currentState = state;
            this.emitter.emit("stateChange", state);

            if (state === "playing") {
              this.startTimeUpdates();
            } else if (state === "paused" || state === "ended") {
              this.stopTimeUpdates();
            }
          },
          onError: (event) => {
            this.emitter.emit("error", event.data);
          },
        },
      });
    });
  }

  destroy(): void {
    this.stopTimeUpdates();
    this.player?.destroy(); // YouTube removes the <iframe> it created
    this.player = null;
    // Clean out container so the next initialize() starts fresh
    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }
    this.emitter.removeAll();
  }

  play(): void {
    if (typeof this.player?.playVideo === "function") {
      this.player.playVideo();
    }
  }

  pause(): void {
    if (typeof this.player?.pauseVideo === "function") {
      this.player.pauseVideo();
    }
  }

  seekTo(timeSeconds: number): void {
    if (typeof this.player?.seekTo === "function") {
      this.player.seekTo(timeSeconds, true);
    }
  }

  getCurrentTime(): number {
    return this.player?.getCurrentTime() ?? 0;
  }

  getDuration(): number {
    return this.player?.getDuration() ?? 0;
  }

  getPlayerState(): PlayerState {
    return this.currentState;
  }

  setPlaybackRate(rate: number): void {
    this.player?.setPlaybackRate(rate);
  }

  setVolume(volume: number): void {
    this.player?.setVolume(volume);
  }

  getVolume(): number {
    return this.player?.getVolume() ?? 100;
  }

  on(event: PlayerEvent, callback: PlayerEventCallback): void {
    this.emitter.on(event, callback);
  }

  off(event: PlayerEvent, callback: PlayerEventCallback): void {
    this.emitter.off(event, callback);
  }

  /** 250ms polling for time updates (YouTube has no native timeupdate event) */
  private startTimeUpdates(): void {
    if (this.timeUpdateInterval) return;
    this.timeUpdateInterval = setInterval(() => {
      if (this.player && this.currentState === "playing") {
        this.emitter.emit("timeUpdate", this.player.getCurrentTime());
      }
    }, 250);
  }

  private stopTimeUpdates(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }
}
