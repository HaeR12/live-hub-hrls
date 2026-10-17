import { EventBus } from "../events/event-bus.js";

export class Logger {
  constructor(private eventBus: EventBus) {}

  start(): void {
    this.eventBus.onAny((event) => {
      console.log(`[EVENT] ${event.type}`, {
        platform: event.platform,
        source: event.source,
        streamId: event.streamId,
        sessionId: event.sessionId,
        data: event.data,
      });
    });
  }
}
