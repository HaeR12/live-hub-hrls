import {
  ChatData,
  LikeData,
  ViewerUpdateData,
  ViewUpdateData,
  HaerEvent,
} from "../events/types.js";

import { EventNormalizer, RawPlatformEvent } from "./event-normalizer.js";

export class YouTubeNormalizer implements EventNormalizer {
  normalize(
    rawEvent: RawPlatformEvent,
    baseEvent: Omit<HaerEvent, "type" | "data">,
  ): HaerEvent {
    switch (rawEvent.type) {
      case "CHAT": {
        const raw = rawEvent.data as {
          displayMessage: string;
          authorName: string;
          authorId?: string;
          authorUsername?: string;
          authorAvatarUrl?: string;
        };

        const data: ChatData = {
          message: raw.displayMessage,
          user: {
            name: raw.authorName,
            ...(raw.authorId ? { id: raw.authorId } : {}),
            ...(raw.authorUsername ? { username: raw.authorUsername } : {}),
            ...(raw.authorAvatarUrl ? { avatarUrl: raw.authorAvatarUrl } : {}),
          },
        };

        return {
          ...baseEvent,
          type: "CHAT",
          data,
        };
      }

      case "VIEWER_UPDATE": {
        const raw = rawEvent.data as {
          current: number;
        };

        const data: ViewerUpdateData = {
          current: raw.current,
        };

        return {
          ...baseEvent,
          type: "VIEWER_UPDATE",
          data,
        };
      }

      case "VIEW_UPDATE": {
        const raw = rawEvent.data as { total: number };

        const data: ViewUpdateData = {
          total: raw.total,
        };

        return {
          ...baseEvent,
          type: "VIEW_UPDATE",
          data,
        };
      }

      case "LIKE": {
        const raw = rawEvent.data as { total: number; delta?: number };

        const data: LikeData = {
          total: raw.total,
          ...(typeof raw.delta === "number" ? { delta: raw.delta } : {}),
        };

        return {
          ...baseEvent,
          type: "LIKE",
          data,
        };
      }

      default:
        throw new Error(`Unsupported YouTube event: ${rawEvent.type}`);
    }
  }
}
