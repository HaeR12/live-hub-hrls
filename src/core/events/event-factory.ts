import { randomUUID } from "node:crypto";

import { EventType, HaerEvent, Platform } from "./types.js";

export function createEvent<T>(
  type: EventType,
  platform: Platform,
  streamId: string,
  sessionId: string,
  data: T,
  source?: string,
): HaerEvent<T> {
  return {
    id: randomUUID(),
    type,
    platform,
    streamId,
    sessionId,
    timestamp: Date.now(),
    source,
    data,
  };
}
