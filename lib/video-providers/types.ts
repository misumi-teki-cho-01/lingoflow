import type {
  PlayerState,
  PlayerEvent,
  PlayerEventCallback,
  PlayerOptions,
  VideoProvider,
} from "@/types/video";

export type { VideoProvider, PlayerState, PlayerEvent, PlayerEventCallback, PlayerOptions };

export class EventEmitter {
  private listeners = new Map<string, Set<PlayerEventCallback>>();

  on(event: PlayerEvent, callback: PlayerEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: PlayerEvent, callback: PlayerEventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: PlayerEvent, data?: unknown) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  removeAll() {
    this.listeners.clear();
  }
}
