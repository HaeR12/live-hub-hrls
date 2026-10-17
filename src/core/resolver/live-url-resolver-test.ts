import { resolveLiveUrl } from "./live-url-resolver.js";

const tests = [
  {
    name: "YouTube watch URL",
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    expectedPlatform: "youtube",
  },
  {
    name: "YouTube live URL",
    url: "https://www.youtube.com/live/abcdefghijk",
    expectedPlatform: "youtube",
  },
  {
    name: "YouTube short URL",
    url: "https://youtu.be/abcdefghijk",
    expectedPlatform: "youtube",
  },
  {
    name: "TikTok live URL",
    url: "https://www.tiktok.com/@contoh/live",
    expectedPlatform: "tiktok",
  },
  {
    name: "Twitch channel URL",
    url: "https://www.twitch.tv/contoh",
    expectedPlatform: "twitch",
  },
  {
    name: "Kick channel URL",
    url: "https://kick.com/contoh",
    expectedPlatform: "kick",
  },
] as const;

let failed = 0;

for (const test of tests) {
  const result = resolveLiveUrl(test.url);

  if (result.ok && result.value.platform === test.expectedPlatform) {
    console.log(`PASS: ${test.name}`);

    if (result.ok) {
      console.log("  Resolved:", result.value);
    }
  } else {
    failed++;
    console.error(`FAIL: ${test.name}`, result);
  }
}

const invalidTests = ["", "ini-bukan-url", "https://example.com/channel"];

for (const url of invalidTests) {
  const result = resolveLiveUrl(url);

  if (!result.ok) {
    console.log(`PASS: URL invalid ditolak (${url || "kosong"})`);
  } else {
    failed++;
    console.error("FAIL: URL invalid diterima:", url);
  }
}

if (failed > 0) {
  console.error(`\nPengujian gagal: ${failed} kasus.`);
  process.exitCode = 1;
} else {
  console.log("\nSemua pengujian resolver berhasil.");
}
