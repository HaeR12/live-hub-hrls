import { BasePlatformAdapter } from "../base/platform-adapter.js";
import { createEvent } from "../../core/events/event-factory.js";
import { randomUUID } from "node:crypto";

export class YouTubeMockAdapter extends BasePlatformAdapter {
  readonly platform = "youtube" as const;

  readonly streamId = "youtube_mock_stream";

  readonly sessionId = "youtube_mock_session";

  async start(): Promise<void> {
    console.log("[YouTube] Starting...");

    this.connected = true;

    console.log("[YouTube] Connected");

    const viewerEvent = createEvent(
      "VIEWER_UPDATE",
      "youtube",
      this.streamId,
      this.sessionId,
      {
        current: 1245,
      },
      "youtube_mock",
    );

    this.eventPipeline.processRaw(
      {
        platform: "youtube",
        type: "VIEWER_UPDATE",
        data: {
          current: 1245,
        },
      },
      {
        id: randomUUID(),
        platform: "youtube",
        streamId: this.streamId,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        source: "youtube_mock",
      },
    );
  }

  async stop(): Promise<void> {
    console.log("[YouTube] Stopping...");

    this.connected = false;

    console.log("[YouTube] Disconnected");
  }
}
