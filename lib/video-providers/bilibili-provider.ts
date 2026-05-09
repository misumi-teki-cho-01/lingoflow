import type {
  VideoProvider,
  PlayerState,
  PlayerEvent,
  PlayerEventCallback,
  PlayerOptions,
} from './types';
import { EventEmitter } from './types';

/**
 * Bilibili video provider.
 *
 * Bilibili does not publish a stable YouTube-style iframe API, so this wrapper
 * embeds the official iframe and sends best-effort postMessage commands while
 * maintaining local state for the rest of the study-room UI.
 */
export class BilibiliProvider implements VideoProvider {
  private iframe: HTMLIFrameElement | null = null;
  private container: HTMLDivElement | null = null;
  private emitter = new EventEmitter();
  private timeUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private currentState: PlayerState = 'unstarted';
  private currentTime = 0;
  private duration = 0;
  private lastTick = 0;
  private volume = 100;
  private playbackRate = 1;

  async initialize(
    container: HTMLDivElement,
    videoId: string,
    options?: PlayerOptions,
  ): Promise<void> {
    this.container = container;
    this.duration = await this.fetchDuration(videoId);
    this.currentTime = options?.startTime ?? 0;

    container.innerHTML = '';

    const iframe = document.createElement('iframe');
    const params = new URLSearchParams({
      bvid: videoId,
      page: '1',
      autoplay: options?.autoplay ? '1' : '0',
      high_quality: '1',
      danmaku: '0',
      enablejsapi: '1',
    });

    iframe.src = `https://player.bilibili.com/player.html?${params}`;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#000;';
    iframe.title = 'Bilibili video player';

    this.iframe = iframe;
    container.appendChild(iframe);

    await new Promise<void>((resolve) => {
      iframe.addEventListener(
        'load',
        () => {
          if (options?.muted) this.setVolume(0);
          if (options?.startTime) this.seekTo(options.startTime);
          this.currentState = options?.autoplay ? 'playing' : 'cued';
          if (options?.autoplay) this.startTimeUpdates();
          this.emitter.emit('ready');
          this.emitter.emit('stateChange', this.currentState);
          resolve();
        },
        { once: true },
      );
    });
  }

  destroy(): void {
    this.stopTimeUpdates();
    this.iframe?.remove();
    this.iframe = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.emitter.removeAll();
  }

  play(): void {
    this.postCommand('play');
    this.currentState = 'playing';
    this.lastTick = Date.now();
    this.startTimeUpdates();
    this.emitter.emit('stateChange', this.currentState);
  }

  pause(): void {
    this.syncEstimatedTime();
    this.postCommand('pause');
    this.currentState = 'paused';
    this.stopTimeUpdates();
    this.emitter.emit('stateChange', this.currentState);
  }

  seekTo(timeSeconds: number): void {
    this.currentTime = Math.max(0, Math.min(this.duration || Number.MAX_SAFE_INTEGER, timeSeconds));
    this.lastTick = Date.now();
    this.postCommand('seek', this.currentTime);
    this.postCommand('seekTo', this.currentTime);
    this.emitter.emit('timeUpdate', this.currentTime);
  }

  getCurrentTime(): number {
    this.syncEstimatedTime();
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  getPlayerState(): PlayerState {
    return this.currentState;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    this.postCommand('setPlaybackRate', rate);
    this.postCommand('playbackRate', rate);
    this.emitter.emit('playbackRateChange', rate);
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    this.postCommand('setVolume', this.volume);
    this.postCommand('volume', this.volume / 100);
  }

  getVolume(): number {
    return this.volume;
  }

  on(event: PlayerEvent, callback: PlayerEventCallback): void {
    this.emitter.on(event, callback);
  }

  off(event: PlayerEvent, callback: PlayerEventCallback): void {
    this.emitter.off(event, callback);
  }

  private postCommand(command: string, value?: unknown): void {
    this.iframe?.contentWindow?.postMessage(
      {
        cmd: command,
        command,
        value,
        data: value,
      },
      'https://player.bilibili.com',
    );
  }

  private startTimeUpdates(): void {
    if (this.timeUpdateInterval) return;
    this.lastTick = Date.now();
    this.timeUpdateInterval = setInterval(() => {
      this.syncEstimatedTime();
      this.emitter.emit('timeUpdate', this.currentTime);
    }, 250);
  }

  private stopTimeUpdates(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  private syncEstimatedTime(): void {
    if (this.currentState !== 'playing') return;
    const now = Date.now();
    const elapsed = ((now - this.lastTick) / 1000) * this.playbackRate;
    this.lastTick = now;
    this.currentTime = this.duration
      ? Math.min(this.duration, this.currentTime + elapsed)
      : this.currentTime + elapsed;
    if (this.duration && this.currentTime >= this.duration) {
      this.currentState = 'ended';
      this.stopTimeUpdates();
      this.emitter.emit('stateChange', this.currentState);
    }
  }

  private async fetchDuration(videoId: string): Promise<number> {
    try {
      const res = await fetch(
        `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(videoId)}`,
      );
      if (!res.ok) return 0;
      const json = (await res.json()) as { data?: { duration?: number } };
      return json.data?.duration ?? 0;
    } catch {
      return 0;
    }
  }
}
