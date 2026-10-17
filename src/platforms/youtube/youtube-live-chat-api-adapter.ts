import { randomUUID } from "node:crypto";
import { EventPipeline } from "../../core/pipeline/event-pipeline.js";
import { BasePlatformAdapter } from "../base/platform-adapter.js";
import { resolveLiveUrl } from "../../core/resolver/live-url-resolver.js";

interface YouTubeVideoResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      liveBroadcastContent?: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
    };
    liveStreamingDetails?: {
      activeLiveChatId?: string;
      concurrentViewers?: string;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
}

interface YouTubeChatMessage {
  id: string;
  snippet?: {
    type?: string;
    displayMessage?: string;
    publishedAt?: string;
  };
  authorDetails?: {
    channelId?: string;
    displayName?: string;
    profileImageUrl?: string;
  };
}

interface YouTubeChatResponse {
  items?: YouTubeChatMessage[];
  nextPageToken?: string;
  pollingIntervalMillis?: number;
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
}

export class YouTubeLiveChatApiAdapter extends BasePlatformAdapter {
  readonly platform = "youtube" as const;
  readonly streamId: string;
  readonly sessionId = randomUUID();

  private readonly apiKey: string;
  private readonly videoId: string;
  private videoTitle: string;
  private liveChatId?: string;
  private nextPageToken?: string;
  private stopped = true;
  private runId = 0;
  private skipInitialMessages = true;
  private reconnectAllowed = true;
  private statsTimer?: ReturnType<typeof setInterval>;

  constructor(eventPipeline: EventPipeline, inputUrl: string) {
    super(eventPipeline);

    const resolved = resolveLiveUrl(inputUrl);

    if (
      !resolved.ok ||
      resolved.value.platform !== "youtube" ||
      !resolved.value.videoId
    ) {
      throw new Error(
        resolved.ok ? "URL harus berupa URL video YouTube." : resolved.error,
      );
    }

    this.videoId = resolved.value.videoId;
    this.streamId = `youtube_${this.videoId}`;
    this.videoTitle = this.videoId;

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      throw new Error("YOUTUBE_API_KEY tidak ditemukan di .env");
    }

    this.apiKey = apiKey;
  }

  async start(): Promise<void> {
    if (this.connected) {
      console.log("[YouTube API] Adapter sudah berjalan.");
      return;
    }

    this.reconnectAllowed = true;
    this.skipInitialMessages = true;
    this.nextPageToken = undefined;

    const currentRun = ++this.runId;
    this.stopped = false;

    console.log(`[YouTube API] Menghubungkan video ${this.videoId}...`);

    try {
      await this.loadVideoDetails();

      if (this.stopped || currentRun !== this.runId) return;

      if (!this.liveChatId) {
        throw new Error(
          "Live chat tidak tersedia. Pastikan siaran sedang live dan live chat aktif.",
        );
      }

      this.connected = true;
      console.log(`[YouTube API] Terhubung: ${this.videoTitle}`);

      // Perbarui statistik secara berkala selama adapter aktif.
      await this.refreshStatistics(currentRun);

      if (this.stopped || currentRun !== this.runId) return;

      this.statsTimer = setInterval(() => {
        void this.refreshStatistics(currentRun).catch((error: unknown) => {
          console.error(
            "[YouTube API] Gagal memperbarui statistik:",
            this.errorMessage(error),
          );
        });
      }, 60_000);

      void this.pollLoop(currentRun);
    } catch (error) {
      if (currentRun !== this.runId) return;

      this.stopped = true;
      this.connected = false;
      this.clearStatsTimer();

      const message = this.errorMessage(error);

      if (this.isPermanentError(message)) {
        this.reconnectAllowed = false;
      }

      console.error("[YouTube API] Gagal memulai:", message);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.connected = false;
    this.runId++;
    this.clearStatsTimer();

    console.log(`[YouTube API] Adapter dihentikan: ${this.videoId}`);
  }

  canReconnect(): boolean {
    return this.reconnectAllowed;
  }

  private clearStatsTimer(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }
  }

  private emitStat(
    type: "VIEWER_UPDATE" | "VIEW_UPDATE" | "LIKE",
    data: { current: number } | { total: number },
  ): void {
    this.eventPipeline.processRaw(
      {
        platform: "youtube",
        type,
        data,
      },
      {
        id: randomUUID(),
        platform: "youtube",
        streamId: this.streamId,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        source: "youtube_data_api",
      },
    );
  }

  private async refreshStatistics(runId: number): Promise<void> {
    if (this.stopped || runId !== this.runId) return;

    const params = new URLSearchParams({
      part: "snippet,liveStreamingDetails,statistics",
      id: this.videoId,
      key: this.apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
    );

    const data = (await response.json()) as YouTubeVideoResponse;

    if (!response.ok) {
      throw new Error(this.apiError(data.error, response.status));
    }

    if (this.stopped || runId !== this.runId) return;

    const video = data.items?.[0];

    if (!video) {
      throw new Error("Video tidak ditemukan atau tidak dapat diakses.");
    }

    const viewers = video.liveStreamingDetails?.concurrentViewers;
    const views = video.statistics?.viewCount;
    const likes = video.statistics?.likeCount;

    if (viewers !== undefined) {
      const current = Number(viewers);

      if (Number.isFinite(current) && current >= 0) {
        this.emitStat("VIEWER_UPDATE", { current });
      }
    }

    if (views !== undefined) {
      const total = Number(views);

      if (Number.isFinite(total) && total >= 0) {
        this.emitStat("VIEW_UPDATE", { total });
      }
    }

    if (likes !== undefined) {
      const total = Number(likes);

      if (Number.isFinite(total) && total >= 0) {
        this.emitStat("LIKE", { total });
      }
    }
  }

  private async loadVideoDetails(): Promise<void> {
    const params = new URLSearchParams({
      part: "snippet,liveStreamingDetails",
      id: this.videoId,
      key: this.apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
    );

    const data = (await response.json()) as YouTubeVideoResponse;

    if (!response.ok) {
      throw new Error(this.apiError(data.error, response.status));
    }

    const video = data.items?.[0];

    if (!video) {
      throw new Error("Video tidak ditemukan atau tidak dapat diakses.");
    }

    this.liveChatId = video.liveStreamingDetails?.activeLiveChatId;

    if (video.snippet?.title) {
      this.videoTitle = video.snippet.title;
      console.log(`[YouTube API] Judul video: ${this.videoTitle}`);
    }
  }

  private async pollLoop(runId: number): Promise<void> {
    let delayMs = 5000;

    while (!this.stopped && runId === this.runId) {
      try {
        const result = await this.fetchMessages();

        if (this.stopped || runId !== this.runId) break;

        // Lewati backlog pada polling pertama.
        if (this.skipInitialMessages) {
          this.skipInitialMessages = false;
          delayMs = result.pollingIntervalMillis ?? 5000;

          await new Promise<void>((resolve) => {
            setTimeout(resolve, delayMs);
          });

          continue;
        }

        for (const item of result.items ?? []) {
          if (this.stopped || runId !== this.runId) break;

          if (item.snippet?.type !== "textMessageEvent") continue;

          const message = item.snippet.displayMessage;
          const author = item.authorDetails;

          if (!message || !author?.displayName) continue;

          const timestamp = item.snippet.publishedAt
            ? Date.parse(item.snippet.publishedAt)
            : Date.now();

          this.eventPipeline.processRaw(
            {
              platform: "youtube",
              type: "CHAT",
              eventId: item.id,
              data: {
                displayMessage: message,
                authorName: author.displayName,
                authorId: author.channelId,
                authorAvatarUrl: author.profileImageUrl,
              },
            },
            {
              id: randomUUID(),
              platform: "youtube",
              streamId: this.streamId,
              sessionId: this.sessionId,
              timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
              source: "youtube_data_api",
            },
          );
        }

        delayMs = result.pollingIntervalMillis ?? 5000;
      } catch (error) {
        if (this.stopped || runId !== this.runId) break;

        const message = this.errorMessage(error);

        console.error("[YouTube API] Gagal mengambil chat:", message);

        if (this.isPermanentError(message)) {
          console.error("[YouTube API] Error permanen. Polling dihentikan.");
          this.reconnectAllowed = false;
          this.stopped = true;
          this.connected = false;
          this.clearStatsTimer();
          break;
        }

        delayMs = 10_000;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }

    console.log(`[YouTube API] Polling selesai: ${this.videoId}`);
  }

  private async fetchMessages(): Promise<YouTubeChatResponse> {
    if (!this.liveChatId) {
      throw new Error("Active live chat ID tidak tersedia.");
    }

    const params = new URLSearchParams({
      part: "snippet,authorDetails",
      liveChatId: this.liveChatId,
      maxResults: "200",
      key: this.apiKey,
    });

    if (this.nextPageToken) {
      params.set("pageToken", this.nextPageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/liveChat/messages?${params}`,
    );

    const data = (await response.json()) as YouTubeChatResponse;

    if (!response.ok) {
      throw new Error(this.apiError(data.error, response.status));
    }

    this.nextPageToken = data.nextPageToken;

    return data;
  }

  private isPermanentError(message: string): boolean {
    return /quotaExceeded|dailyLimitExceeded|liveChatEnded|liveChatDisabled|liveChatNotFound|forbidden|Live chat tidak tersedia|Video tidak ditemukan atau tidak dapat diakses/i.test(
      message,
    );
  }

  private apiError(
    error: YouTubeVideoResponse["error"] | YouTubeChatResponse["error"],
    status: number,
  ): string {
    const reason = error?.errors?.[0]?.reason;
    const message = error?.message ?? "Permintaan API gagal";

    return `HTTP ${status}${reason ? ` (${reason})` : ""}: ${message}`;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
