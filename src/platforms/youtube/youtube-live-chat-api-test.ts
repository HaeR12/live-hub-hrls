import "dotenv/config";

import { EventBus } from "../../core/events/event-bus.js";
import type { ChatData } from "../../core/events/types.js";
import { EventDeduplicator } from "../../core/deduplicator/event-deduplicator.js";
import { EventPipeline } from "../../core/pipeline/event-pipeline.js";
import { YouTubeNormalizer } from "../../core/normalizer/youtube-normalizer.js";
import { YouTubeLiveChatApiAdapter } from "./youtube-live-chat-api-adapter.js";

async function main(): Promise<void> {
  const inputUrl = process.argv[2];

  if (!inputUrl) {
    throw new Error("URL live YouTube belum diberikan sebagai argumen.");
  }

  const eventBus = new EventBus();
  const deduplicator = new EventDeduplicator();
  const pipeline = new EventPipeline(eventBus, deduplicator);

  pipeline.registerNormalizer("youtube", new YouTubeNormalizer());

  eventBus.on<ChatData>("CHAT", (event) => {
    console.log("\n[CHAT DITERIMA]");
    console.log(`Platform : ${event.platform}`);
    console.log(`Pengguna : ${event.data.user.name}`);
    console.log(`Pesan    : ${event.data.message}`);
    console.log("------------------------------");
  });

  const adapter = new YouTubeLiveChatApiAdapter(pipeline, inputUrl);

  process.once("SIGINT", () => {
    void adapter.stop().then(() => process.exit(0));
  });

  await adapter.start();

  console.log("\nAdapter berhasil dimulai.");
  console.log("Kirim pesan di live chat untuk menguji penerimaan.");
  console.log("Tekan Ctrl+C untuk menghentikan pengujian.");
}

main().catch((error: unknown) => {
  console.error(
    "\n[TEST GAGAL]",
    error instanceof Error ? error.message : String(error),
  );

  process.exitCode = 1;
});
