import {
  resolveLiveUrl,
  ResolvedLiveUrl,
} from "../../core/resolver/live-url-resolver.js";

import { LiveUrlAdapter, LiveSourceStatus } from "./live-url-adapter.js";

import { LiveUrlAdapterRegistry } from "./live-url-adapter-registry.js";

class TestAdapter implements LiveUrlAdapter {
  readonly platform = "youtube" as const;

  async connect(_source: ResolvedLiveUrl): Promise<void> {}

  async disconnect(_source: ResolvedLiveUrl): Promise<void> {}

  getStatus(_source: ResolvedLiveUrl): LiveSourceStatus {
    return "IDLE";
  }
}

const registry = new LiveUrlAdapterRegistry();
const youtubeAdapter = new TestAdapter();

registry.register(youtubeAdapter);

const result = resolveLiveUrl("https://www.youtube.com/watch?v=abcdefghijk");

if (!result.ok) {
  throw new Error(result.error);
}

if (registry.getFor(result.value) === youtubeAdapter) {
  console.log("PASS: URL YouTube memilih adapter yang benar");
} else {
  throw new Error("FAIL: Adapter YouTube tidak cocok");
}

if (registry.has("youtube")) {
  console.log("PASS: Adapter YouTube terdaftar");
} else {
  throw new Error("FAIL: Adapter YouTube tidak terdaftar");
}

if (!registry.has("tiktok")) {
  console.log("PASS: Platform tanpa adapter terdeteksi");
} else {
  throw new Error("FAIL: TikTok seharusnya belum terdaftar");
}

let rejectedMissingAdapter = false;

try {
  registry.getFor({
    platform: "tiktok",
    inputUrl: "https://www.tiktok.com/@contoh/live",
    canonicalUrl: "https://www.tiktok.com/@contoh/live",
    channelUsername: "contoh",
  });
} catch (error) {
  if (
    error instanceof Error &&
    error.message === "No live adapter registered for platform: tiktok"
  ) {
    rejectedMissingAdapter = true;
  } else {
    throw error;
  }
}

if (rejectedMissingAdapter) {
  console.log("PASS: Registry menolak adapter yang belum tersedia");
} else {
  throw new Error("FAIL: Registry tidak menolak platform tanpa adapter");
}

console.log("\nSemua pengujian registry berhasil.");
