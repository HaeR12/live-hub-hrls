import { EventBus } from "./core/events/event-bus.js";
import { Logger } from "./core/diagnostics/logger.js";
import { ConnectionManager } from "./core/connection/connection-manager.js";
import { NetworkMonitor } from "./core/network/network-monitor.js";
import { EventDeduplicator } from "./core/deduplicator/event-deduplicator.js";
import { EventPipeline } from "./core/pipeline/event-pipeline.js";
import { TikTokNormalizer } from "./core/normalizer/tiktok-normalizer.js";
import { YouTubeNormalizer } from "./core/normalizer/youtube-normalizer.js";
import { StatsAggregator } from "./core/stats/stats-aggregator.js";
import "dotenv/config";
import { YouTubeLiveChatApiAdapter } from "./platforms/youtube/youtube-live-chat-api-adapter.js";
import { TikTokLiveAdapter } from "./platforms/tiktok/tiktok-live-adapter.js";

function extractYouTubeVideoId(rawUrl: string): string {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();

  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    videoId = url.searchParams.get("v");

    if (!videoId) {
      const parts = url.pathname.split("/").filter(Boolean);

      if (["live", "shorts", "embed", "v"].includes(parts[0])) {
        videoId = parts[1] ?? null;
      }
    }
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw new Error(
      "YOUTUBE_LIVE_URL harus berupa URL video YouTube langsung dengan ID video yang valid.",
    );
  }

  return videoId;
}

async function main() {
  // =========================
  // EVENT BUS
  // =========================

  const eventBus = new EventBus();
  const statsAggregator = new StatsAggregator();

  eventBus.onAny((event) => {
    if (typeof process.send !== "function" || !process.connected) {
      return;
    }

    try {
      process.send({
        type: "LIVE_HUB_EVENT",
        event,
      });

      const stats = statsAggregator.consume(event);

      if (event.type === "LIKE" || event.type === "VIEW_UPDATE") {
        console.log("[STATS IPC DEBUG]", {
          platform: event.platform,
          type: event.type,
          platformStats: stats.platforms[event.platform.toLowerCase()],
          totals: stats.totals,
        });
      }

      process.send({
        type: "LIVE_HUB_STATS",
        stats,
      });
    } catch (error) {
      console.error("[IPC] Gagal mengirim event ke desktop:", error);
    }
  });

  const logger = new Logger(eventBus);

  logger.start();

  eventBus.on("STREAM_STATUS", (event) => {
    console.log(`[CONNECTION] ${event.platform}:`, event.data);
  });

  const networkMonitor = new NetworkMonitor();

  networkMonitor.onStatusChange((status) => {
    console.log("[NETWORK EVENT]", status);
  });

  networkMonitor.start();

  const deduplicator = new EventDeduplicator();

  const eventPipeline = new EventPipeline(eventBus, deduplicator);

  eventPipeline.registerNormalizer("tiktok", new TikTokNormalizer());
  eventPipeline.registerNormalizer("youtube", new YouTubeNormalizer());

  const tiktokUsername = process.env.TIKTOK_USERNAME;

  if (!tiktokUsername) {
    throw new Error("TIKTOK_USERNAME belum diatur di file .env");
  }

  const tiktok = new TikTokLiveAdapter(eventPipeline, tiktokUsername);

  const youtubeUrl = process.env.YOUTUBE_LIVE_URL;

  if (!youtubeUrl) {
    throw new Error("YOUTUBE_LIVE_URL belum diatur di file .env");
  }

  const targetVideoId = extractYouTubeVideoId(youtubeUrl);

  const youtube = new YouTubeLiveChatApiAdapter(eventPipeline, youtubeUrl);

  // const youtubeBrowserBridge = new YouTubeBrowserBridge(
  //   eventPipeline,
  //   targetVideoId,
  // );

  // youtubeBrowserBridge.start();

  const connectionManager = new ConnectionManager(eventBus, networkMonitor);

  connectionManager.register(tiktok);

  connectionManager.register(youtube);

  await connectionManager.startAll();
  // =========================
  // STATUS
  // =========================

  console.log("[STATUS]", "TikTok connected:", tiktok.isConnected());

  console.log("[STATUS]", "YouTube connected:", youtube.isConnected());

  // =========================
  // CONNECTION MONITOR
  // =========================

  setInterval(() => {
    connectionManager.monitor(tiktok);
    connectionManager.monitor(youtube);
  }, 2000);
}

main().catch((error) => {
  console.error("[APP ERROR]", error);

  process.exit(1);
});
