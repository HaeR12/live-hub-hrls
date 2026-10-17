import {
  LivePlatform,
  ResolvedLiveUrl,
} from "../../core/resolver/live-url-resolver.js";

export type LiveSourceStatus =
  | "IDLE"
  | "CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "OFFLINE"
  | "UNSUPPORTED"
  | "ERROR";

export interface LiveUrlAdapter {
  readonly platform: LivePlatform;

  connect(source: ResolvedLiveUrl): Promise<void>;

  disconnect(source: ResolvedLiveUrl): Promise<void>;

  getStatus(source: ResolvedLiveUrl): LiveSourceStatus;
}
