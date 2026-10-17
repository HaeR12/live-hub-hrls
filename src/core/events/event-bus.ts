import { EventType, HaerEvent } from "./types.js";

type EventHandler<T = unknown> = (event: HaerEvent<T>) => void;

export class EventBus {
  private listeners = new Map<EventType, Set<EventHandler>>();

  private globalListeners = new Set<EventHandler>();

  on<T>(type: EventType, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(handler as EventHandler);

    return () => {
      this.off(type, handler);
    };
  }

  onAny(handler: EventHandler): () => void {
    this.globalListeners.add(handler);

    return () => {
      this.globalListeners.delete(handler);
    };
  }

  off<T>(type: EventType, handler: EventHandler<T>): void {
    this.listeners.get(type)?.delete(handler as EventHandler);
  }

  emit<T>(event: HaerEvent<T>): void {
    const handlers = this.listeners.get(event.type);

    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }

    for (const handler of this.globalListeners) {
      handler(event);
    }
  }
}
