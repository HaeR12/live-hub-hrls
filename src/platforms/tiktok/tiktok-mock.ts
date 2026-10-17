import { BasePlatformAdapter } from "../base/platform-adapter.js";
import { randomUUID } from "node:crypto";

export class TikTokMockAdapter extends BasePlatformAdapter {
  readonly platform = "tiktok" as const;

  readonly streamId = "tiktok_mock_stream";

  readonly sessionId = "tiktok_mock_session";

  private reconnectFailuresRemaining = 0;

  async start(): Promise<void> {
    console.log("[TikTok] Starting...");

    /*
     * Simulasi kegagalan reconnect.
     */
    if (this.reconnectFailuresRemaining > 0) {
      this.reconnectFailuresRemaining--;

      console.log("[TikTok] Simulated connection failure");

      this.connected = false;

      throw new Error("Simulated TikTok connection failure");
    }

    this.connected = true;

    console.log("[TikTok] Connected");

    /*
     * Raw TikTok event.
     *
     * Event ini sengaja menggunakan
     * format yang berbeda dari HaerEvent.
     *
     * Normalizer yang akan mengubahnya
     * menjadi format standar HaeR LiveHub.
     */
    this.eventPipeline.processRaw(
      {
        platform: "tiktok",
        type: "CHAT",
        eventId: "tiktok_chat_001",
        data: {
          nickname: "Andi",
          comment: "Halo dari TikTok!",
        },
      },
      {
        id: randomUUID(),
        platform: "tiktok",
        streamId: this.streamId,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        source: "tiktok_mock",
      },
    );
  }

  async stop(): Promise<void> {
    console.log("[TikTok] Stopping...");

    this.connected = false;

    console.log("[TikTok] Disconnected");
  }

  async simulateDisconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    console.log("[TikTok] Simulating connection loss...");

    this.connected = false;

    /*
     * Dua reconnect pertama
     * sengaja dibuat gagal.
     */
    this.reconnectFailuresRemaining = 2;

    console.log("[TikTok] Connection lost");

    console.log("[TikTok] Next 2 reconnect attempts will fail");
  }
}
