import { EventBus } from "../events/event-bus.js";

import { HaerEvent, Platform, EventType } from "../events/types.js";

import { EventDeduplicator } from "../deduplicator/event-deduplicator.js";

import {
  EventNormalizer,
  RawPlatformEvent,
} from "../normalizer/event-normalizer.js";

const VALID_PLATFORMS: Platform[] = ["youtube", "tiktok", "twitch", "kick"];

const VALID_EVENT_TYPES: EventType[] = [
  "CHAT",
  "FOLLOW",
  "LIKE",
  "GIFT",
  "DONATION",
  "MEMBERSHIP",
  "VIEWER_UPDATE",
  "VIEW_UPDATE",
  "STREAM_STATUS",
];

export class EventPipeline {
  private normalizers = new Map<Platform, EventNormalizer>();

  constructor(
    private eventBus: EventBus,
    private deduplicator: EventDeduplicator,
  ) {}

  registerNormalizer(platform: Platform, normalizer: EventNormalizer): void {
    this.normalizers.set(platform, normalizer);
  }

  processRaw(
    rawEvent: RawPlatformEvent,
    baseEvent: Omit<HaerEvent, "type" | "data" | "eventId">,
  ): boolean {
    try {
      this.validateRawEvent(rawEvent, baseEvent);

      const normalizer = this.normalizers.get(rawEvent.platform);

      if (!normalizer) {
        throw new Error(
          `No normalizer registered for platform: ${rawEvent.platform}`,
        );
      }

      const normalizedEvent = normalizer.normalize(rawEvent, baseEvent);

      normalizedEvent.eventId = rawEvent.eventId;

      return this.process(normalizedEvent);
    } catch (error) {
      console.error(
        "[PIPELINE] Raw event rejected:",
        this.getErrorMessage(error),
      );

      return false;
    }
  }

  process(event: HaerEvent): boolean {
    if (!this.isValidNormalizedEvent(event)) {
      console.error("[PIPELINE] Invalid normalized event rejected");

      return false;
    }

    if (this.deduplicator.isDuplicate(event)) {
      console.log("[PIPELINE] Duplicate ignored:", {
        platform: event.platform,
        type: event.type,
        eventId: event.eventId,
        id: event.id,
        streamId: event.streamId,
      });

      return false;
    }

    this.eventBus.emit(event);

    return true;
  }

  private validateRawEvent(
    rawEvent: RawPlatformEvent,
    baseEvent: Omit<HaerEvent, "type" | "data" | "eventId">,
  ): void {
    if (!VALID_PLATFORMS.includes(rawEvent.platform)) {
      throw new Error("Unknown platform");
    }

    if (!VALID_EVENT_TYPES.includes(rawEvent.type)) {
      throw new Error("Unknown event type");
    }

    if (
      !rawEvent.data ||
      typeof rawEvent.data !== "object" ||
      Array.isArray(rawEvent.data)
    ) {
      throw new Error("Event data must be a non-null object");
    }

    if (
      rawEvent.eventId !== undefined &&
      (typeof rawEvent.eventId !== "string" || rawEvent.eventId.trim() === "")
    ) {
      throw new Error("Invalid platform event ID");
    }

    if (baseEvent.platform !== rawEvent.platform) {
      throw new Error("Raw event platform does not match base event platform");
    }

    if (!baseEvent.id || !baseEvent.streamId || !baseEvent.sessionId) {
      throw new Error("Event ID, stream ID, and session ID are required");
    }

    if (!Number.isFinite(baseEvent.timestamp) || baseEvent.timestamp <= 0) {
      throw new Error("Invalid event timestamp");
    }
  }

  private isValidNormalizedEvent(event: HaerEvent): boolean {
    if (!event || typeof event !== "object") {
      return false;
    }

    if (!VALID_PLATFORMS.includes(event.platform)) {
      return false;
    }

    if (!VALID_EVENT_TYPES.includes(event.type)) {
      return false;
    }

    if (
      typeof event.id !== "string" ||
      event.id.trim() === "" ||
      typeof event.streamId !== "string" ||
      event.streamId.trim() === "" ||
      typeof event.sessionId !== "string" ||
      event.sessionId.trim() === ""
    ) {
      return false;
    }

    if (!Number.isFinite(event.timestamp) || event.timestamp <= 0) {
      return false;
    }

    if (
      !event.data ||
      typeof event.data !== "object" ||
      Array.isArray(event.data)
    ) {
      return false;
    }

    if (
      event.eventId !== undefined &&
      (typeof event.eventId !== "string" || event.eventId.trim() === "")
    ) {
      return false;
    }

    return true;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
