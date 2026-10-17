import { HaerEvent, Platform, EventType } from "../events/types.js";

export interface RawPlatformEvent {
  platform: Platform;
  type: EventType;
  eventId?: string;
  data: unknown;
}

export interface EventNormalizer {
  normalize(
    rawEvent: RawPlatformEvent,
    baseEvent: Omit<HaerEvent, "type" | "data" | "eventId">,
  ): HaerEvent;
}
