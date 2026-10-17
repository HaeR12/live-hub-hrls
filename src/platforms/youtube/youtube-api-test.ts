
import "dotenv/config";
import { resolveLiveUrl } from "../../core/resolver/live-url-resolver.js";

interface YouTubeVideoResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      liveBroadcastContent?: string;
    };
    liveStreamingDetails?: {
      activeLiveChatId?: string;
      actualStartTime?: string;
      actualEndTime?: string;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
}

async function main(): Promise<void> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const inputUrl = process.argv[2];

  if (!apiKey) {
    console.error("ERROR: YOUTUBE_API_KEY tidak ditemukan di .env");
    process.exitCode = 1;
    return;
  }

  if (!inputUrl) {
    console.error(
      'Gunakan: npx.cmd tsx src/platforms/youtube/youtube-api-test.ts "URL_LIVE_YOUTUBE"',
    );
    process.exitCode = 1;
    return;
  }

  const resolved = resolveLiveUrl(inputUrl);

  if (!resolved.ok) {
    console.error("URL tidak valid:", resolved.error);
    process.exitCode = 1;
    return;
  }

  if (resolved.value.platform !== "youtube" || !resolved.value.videoId) {
    console.error(
      "URL harus berupa URL video YouTube yang memiliki video ID.",
    );
    process.exitCode = 1;
    return;
  }

  const params = new URLSearchParams({
    part: "snippet,liveStreamingDetails",
    id: resolved.value.videoId,
    key: apiKey,
  });

  console.log("Menguji YouTube Data API v3...");
  console.log("Video ID:", resolved.value.videoId);

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
    );

    const data = (await response.json()) as YouTubeVideoResponse;

    if (!response.ok) {
      const reason = data.error?.errors?.[0]?.reason;
      console.error("API gagal:", data.error?.message ?? response.statusText);
      if (reason) console.error("Alasan:", reason);
      console.error("HTTP status:", response.status);
      process.exitCode = 1;
      return;
    }

    const video = data.items?.[0];

    if (!video) {
      console.log("Video tidak ditemukan atau tidak dapat diakses.");
      return;
    }

    console.log("API berhasil diakses.");
    console.log("Judul:", video.snippet?.title ?? "(tidak tersedia)");
    console.log(
      "Status siaran:",
      video.snippet?.liveBroadcastContent ?? "unknown",
    );

    if (video.liveStreamingDetails?.activeLiveChatId) {
      console.log("Live chat tersedia: YA");
      console.log("Active live chat ID berhasil diperoleh.");
      console.log("ID sengaja tidak ditampilkan.");
    } else {
      console.log("Live chat aktif tidak ditemukan.");
      console.log(
        "Pastikan video sedang live dan live chat tersedia.",
      );
    }
  } catch (error) {
    console.error(
      "Gagal menghubungi YouTube API:",
      error instanceof Error ? error.message : "Kesalahan tidak diketahui",
    );
    process.exitCode = 1;
  }
}

main();
