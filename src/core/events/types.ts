export type Platform = "youtube" | "tiktok" | "twitch" | "kick";

export type EventType =
  | "CHAT"
  | "FOLLOW"
  | "LIKE"
  | "GIFT"
  | "DONATION"
  | "MEMBERSHIP"
  | "VIEWER_UPDATE"
  | "VIEW_UPDATE"
  | "STREAM_STATUS";

export type StreamStatus =
  | "OFFLINE"
  | "CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "ENDED"
  | "ERROR";

export interface UserInfo {
  id?: string;
  name: string;
  username?: string;
  avatarUrl?: string;
}

export interface ChatData {
  message: string;
  user: UserInfo;
}

export interface FollowData {
  user: UserInfo;
}

export interface LikeData {
  total: number;
  delta?: number;
}

export interface GiftData {
  user: UserInfo;
  gift: {
    id?: string;
    name: string;
    quantity: number;
  };
  value?: {
    amount: number;
    unit: string;
  };
}

export interface ViewerUpdateData {
  current: number;
}

export interface ViewUpdateData {
  total: number;
}

export interface HaerEvent<T = unknown> {
  id: string;
  eventId?: string;
  type: EventType;
  platform: Platform;
  streamId: string;
  sessionId: string;
  timestamp: number;
  source?: string;
  data: T;
}

export interface ConnectionStatus {
  platform: Platform;
  status: StreamStatus;
  attempt: number;
  message?: string;
}
