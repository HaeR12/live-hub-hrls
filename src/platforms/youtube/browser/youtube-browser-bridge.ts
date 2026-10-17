import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

import { EventPipeline } from "../../../core/pipeline/event-pipeline.js";

interface BrowserChatMessage {
  platform: "youtube";
  type: "CHAT";
  eventId?: string;
  videoId: string;
  data: {
    authorName: string;
    displayMessage: string;
  };
}

export class YouTubeBrowserBridge {
  private server?: WebSocketServer;

  private readonly streamId: string;
  private readonly sessionId = randomUUID();

  constructor(
    private readonly eventPipeline: EventPipeline,
    private readonly targetVideoId: string,
  ) {
    if (!targetVideoId.trim()) {
      throw new Error(
        "[YouTube Browser Bridge] Target video ID tidak boleh kosong.",
      );
    }

    this.streamId = `youtube_${targetVideoId}`;
  }

  start(port = 3210): void {
    if (this.server) return;

    this.server = new WebSocketServer({
      host: "127.0.0.1",
      port,
    });

    this.server.on("listening", () => {
      console.log(
        `[YouTube Browser Bridge] Listening on 127.0.0.1:${port}; target video: ${this.targetVideoId}`,
      );
    });

    this.server.on("connection", (socket) => {
      console.log("[YouTube Browser Bridge] Browser connected");

      socket.on("message", (buffer) => {
        try {
          const message: unknown = JSON.parse(buffer.toString());

          if (!this.isChatMessage(message)) {
            console.warn("[YouTube Browser Bridge] Invalid message rejected");
            return;
          }

          if (message.videoId !== this.targetVideoId) {
            console.warn(
              `[YouTube Browser Bridge] Chat rejected: video mismatch (received ${message.videoId}, expected ${this.targetVideoId})`,
            );
            return;
          }

          const accepted = this.eventPipeline.processRaw(
            {
              platform: "youtube",
              type: "CHAT",
              eventId: message.eventId,
              data: message.data,
            },
            {
              id: randomUUID(),
              platform: "youtube",
              streamId: this.streamId,
              sessionId: this.sessionId,
              timestamp: Date.now(),
              source: "youtube_browser_dom",
            },
          );

          if (accepted) {
            console.log(
              `[YouTube Browser Bridge] Chat accepted for ${this.targetVideoId}`,
            );
          }
        } catch (error) {
          console.error(
            "[YouTube Browser Bridge] Message error:",
            error instanceof Error ? error.message : String(error),
          );
        }
      });

      socket.on("close", () => {
        console.log("[YouTube Browser Bridge] Browser disconnected");
      });

      socket.on("error", (error) => {
        console.error("[YouTube Browser Bridge] Socket error:", error.message);
      });
    });

    this.server.on("error", (error) => {
      console.error("[YouTube Browser Bridge] Server error:", error.message);
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;

    this.server = undefined;

    for (const client of server.clients) {
      client.close();
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    console.log("[YouTube Browser Bridge] Stopped");
  }

  private isChatMessage(value: unknown): value is BrowserChatMessage {
    if (!value || typeof value !== "object") return false;

    const message = value as Record<string, unknown>;

    if (message.platform !== "youtube" || message.type !== "CHAT") {
      return false;
    }

    if (
      typeof message.videoId !== "string" ||
      !/^[a-zA-Z0-9_-]{11}$/.test(message.videoId)
    ) {
      return false;
    }

    if (
      message.eventId !== undefined &&
      (typeof message.eventId !== "string" || message.eventId.trim() === "")
    ) {
      return false;
    }

    if (
      !message.data ||
      typeof message.data !== "object" ||
      Array.isArray(message.data)
    ) {
      return false;
    }

    const data = message.data as Record<string, unknown>;

    return (
      typeof data.authorName === "string" &&
      data.authorName.trim() !== "" &&
      typeof data.displayMessage === "string" &&
      data.displayMessage.trim() !== ""
    );
  }
}
