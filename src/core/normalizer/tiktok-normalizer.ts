import {
  ChatData,
  FollowData,
  GiftData,
  HaerEvent,
  LikeData,
  ViewerUpdateData,
  ViewUpdateData,
} from "../events/types.js";
import { EventNormalizer, RawPlatformEvent } from "./event-normalizer.js";

export class TikTokNormalizer implements EventNormalizer {
  normalize(
    rawEvent: RawPlatformEvent,
    baseEvent: Omit<HaerEvent, "type" | "data">,
  ): HaerEvent {
    switch (rawEvent.type) {
      case "CHAT": {
        const raw = rawEvent.data as {
          nickname: string;
          comment: string;
          userId?: string;
          username?: string;
        };

        const data: ChatData = {
          message: raw.comment,
          user: {
            name: raw.nickname,
            ...(raw.userId ? { id: raw.userId } : {}),
            ...(raw.username ? { username: raw.username } : {}),
          },
        };

        return { ...baseEvent, type: "CHAT", data };
      }

      case "VIEWER_UPDATE": {
        const raw = rawEvent.data as { current: number };
        const data: ViewerUpdateData = { current: raw.current };
        return { ...baseEvent, type: "VIEWER_UPDATE", data };
      }

      case "VIEW_UPDATE": {
        const raw = rawEvent.data as { total: number };
        const data: ViewUpdateData = { total: raw.total };
        return { ...baseEvent, type: "VIEW_UPDATE", data };
      }

      case "LIKE": {
        const raw = rawEvent.data as { total: number; delta?: number };
        const data: LikeData = {
          total: raw.total,
          ...(typeof raw.delta === "number" ? { delta: raw.delta } : {}),
        };
        return { ...baseEvent, type: "LIKE", data };
      }

      case "GIFT": {
        const raw = rawEvent.data as {
          nickname: string;
          userId?: string;
          username?: string;
          giftName: string;
          giftId?: string;
          quantity: number;
          amount?: number;
        };

        const data: GiftData = {
          user: {
            name: raw.nickname,
            ...(raw.userId ? { id: raw.userId } : {}),
            ...(raw.username ? { username: raw.username } : {}),
          },
          gift: {
            name: raw.giftName,
            ...(raw.giftId ? { id: raw.giftId } : {}),
            quantity: raw.quantity,
          },
          ...(typeof raw.amount === "number"
            ? { value: { amount: raw.amount, unit: "unknown" } }
            : {}),
        };

        return { ...baseEvent, type: "GIFT", data };
      }

      case "FOLLOW": {
        const raw = rawEvent.data as {
          nickname: string;
          userId?: string;
          username?: string;
        };

        const data: FollowData = {
          user: {
            name: raw.nickname,
            ...(raw.userId ? { id: raw.userId } : {}),
            ...(raw.username ? { username: raw.username } : {}),
          },
        };

        return { ...baseEvent, type: "FOLLOW", data };
      }

      default:
        throw new Error(`Unsupported TikTok event: ${rawEvent.type}`);
    }
  }
}
