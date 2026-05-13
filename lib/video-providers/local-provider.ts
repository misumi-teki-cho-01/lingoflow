import type {
  VideoProvider,
  PlayerState,
  PlayerEvent,
  PlayerEventCallback,
  PlayerOptions,
} from './types';
import { EventEmitter } from './types';
import { getLocalVideo } from '@/lib/utils/local-media-store';

export class LocalVideoProvider implements VideoProvider {
  private video: HTMLVideoElement | null = null;
  private objectUrl: string | null = null;
  private container: HTMLDivElement | null = null;
  private emitter = new EventEmitter();
  private currentState: PlayerState = 'unstarted';
  private volume = 100;
  private cleanups: Array<() => void> = [];
  private initializeToken = 0;
  private isDestroyed = false;

  async initialize(
    container: HTMLDivElement,
    videoId: string,
    options?: PlayerOptions,
  ): Promise<void> {
    const token = ++this.initializeToken;
    this.isDestroyed = false;
    this.container = container;
    container.innerHTML = '';

    const record = await getLocalVideo(videoId);
    if (this.isDestroyed || token !== this.initializeToken) return;

    if (!record?.file) {
      const error = new Error('Local video file is not available in this browser');
      this.emitter.emit('error', error);
      throw error;
    }

    this.objectUrl = URL.createObjectURL(record.file);

    const video = document.createElement('video');
    video.src = this.objectUrl;
    video.preload = 'auto';
    video.playsInline = true;
    video.controls = false;
    this.applyVolume(video);
    video.style.cssText =
      'width:100%;height:100%;display:block;background:#000;object-fit:contain;';

    this.video = video;
    container.appendChild(video);

    this.addListener(video, 'loadedmetadata', () => {
      if (options?.startTime) video.currentTime = options.startTime;
      if (options?.playbackRate) video.playbackRate = options.playbackRate;
      if (options?.muted) this.setVolume(0);
      this.applyVolume(video);
      this.currentState = 'cued';
      this.emitter.emit('ready');
      this.emitter.emit('stateChange', this.currentState);
      if (options?.autoplay) void this.play();
    });
    this.addListener(video, 'timeupdate', () => {
      this.emitter.emit('timeUpdate', video.currentTime);
    });
    this.addListener(video, 'play', () => {
      this.currentState = 'playing';
      this.emitter.emit('stateChange', this.currentState);
    });
    this.addListener(video, 'pause', () => {
      if (video.ended) return;
      this.currentState = 'paused';
      this.emitter.emit('stateChange', this.currentState);
    });
    this.addListener(video, 'waiting', () => {
      this.currentState = 'buffering';
      this.emitter.emit('stateChange', this.currentState);
    });
    this.addListener(video, 'playing', () => {
      this.currentState = 'playing';
      this.emitter.emit('stateChange', this.currentState);
    });
    this.addListener(video, 'ended', () => {
      this.currentState = 'ended';
      this.emitter.emit('stateChange', this.currentState);
    });
    this.addListener(video, 'ratechange', () => {
      this.emitter.emit('playbackRateChange', video.playbackRate);
    });
    this.addListener(video, 'error', () => {
      this.emitter.emit('error', video.error);
    });

    await new Promise<void>((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve();
        return;
      }
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });
  }

  destroy(): void {
    this.isDestroyed = true;
    this.initializeToken++;
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    this.video?.pause();
    this.video?.removeAttribute('src');
    this.video?.load();
    this.video?.remove();
    this.video = null;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.emitter.removeAll();
  }

  play(): void {
    if (!this.video) return;
    this.applyVolume(this.video);
    void this.video.play();
  }

  pause(): void {
    this.video?.pause();
  }

  seekTo(timeSeconds: number): void {
    if (!this.video) return;
    this.video.currentTime = Math.max(
      0,
      Math.min(this.getDuration() || Number.MAX_SAFE_INTEGER, timeSeconds),
    );
    this.emitter.emit('timeUpdate', this.video.currentTime);
  }

  getCurrentTime(): number {
    return this.video?.currentTime ?? 0;
  }

  getDuration(): number {
    const duration = this.video?.duration ?? 0;
    return Number.isFinite(duration) ? duration : 0;
  }

  getPlayerState(): PlayerState {
    return this.currentState;
  }

  setPlaybackRate(rate: number): void {
    if (this.video) this.video.playbackRate = rate;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    if (this.video) this.applyVolume(this.video);
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

  private addListener<K extends keyof HTMLMediaElementEventMap>(
    video: HTMLVideoElement,
    event: K,
    handler: (event: HTMLMediaElementEventMap[K]) => void,
  ): void {
    video.addEventListener(event, handler);
    this.cleanups.push(() => video.removeEventListener(event, handler));
  }

  private applyVolume(video: HTMLVideoElement): void {
    const muted = this.volume === 0;
    video.defaultMuted = muted;
    video.muted = muted;
    video.volume = this.volume / 100;
    if (!muted) {
      video.removeAttribute('muted');
    }
  }
}
