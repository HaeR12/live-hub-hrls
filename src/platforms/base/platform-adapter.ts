import { EventBus } from "../../core/events/event-bus.js";
import { EventPipeline } from "../../core/pipeline/event-pipeline.js";
import { Platform } from "../../core/events/types.js";

export interface PlatformAdapter {
  readonly platform: Platform;

  readonly streamId: string;

  readonly sessionId: string;

  start(): Promise<void>;

  stop(): Promise<void>;

  isConnected(): boolean;
}

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platform: Platform;

  abstract readonly streamId: string;

  abstract readonly sessionId: string;

  protected connected = false;

  constructor(protected eventPipeline: EventPipeline) {}

  abstract start(): Promise<void>;

  abstract stop(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }
}
