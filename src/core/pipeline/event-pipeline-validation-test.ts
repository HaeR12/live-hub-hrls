import { EventBus } from "../events/event-bus.js";
import { EventDeduplicator } from "../deduplicator/event-deduplicator.js";
import { TikTokNormalizer } from "../normalizer/tiktok-normalizer.js";
import { EventPipeline } from "./event-pipeline.js";
import { RawPlatformEvent } from "../normalizer/event-normalizer.js";
import { HaerEvent } from "../events/types.js";

const eventBus = new EventBus();
const deduplicator = new EventDeduplicator();
const pipeline = new EventPipeline(eventBus, deduplicator);

pipeline.registerNormalizer("tiktok", new TikTokNormalizer());

let receivedEvents = 0;

eventBus.on("CHAT", (_event) => {
  receivedEvents++;
});

const baseEvent: Omit<HaerEvent, "type" | "data" | "eventId"> = {
  id: "internal_001",
  platform: "tiktok",
  streamId: "test_stream",
  sessionId: "test_session",
  timestamp: Date.now(),
  source: "validation_test",
};

function check(condition: boolean, description: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${description}`);
  }

  console.log(`PASS: ${description}`);
}

// 1. Event valid harus diterima.
const validResult = pipeline.processRaw(
  {
    platform: "tiktok",
    type: "CHAT",
    eventId: "chat_001",
    data: {
      nickname: "Andi",
      comment: "Halo!",
    },
  },
  baseEvent,
);

check(validResult, "Event valid diterima");
check(receivedEvents === 1, "Event masuk ke Event Bus");

// 2. Data mentah tidak valid harus ditolak.
const invalidResult = pipeline.processRaw(
  {
    platform: "tiktok",
    type: "CHAT",
    data: null,
  } as unknown as RawPlatformEvent,
  {
    ...baseEvent,
    id: "internal_002",
  },
);

check(!invalidResult, "Event dengan data null ditolak");
check(receivedEvents === 1, "Event invalid tidak masuk Event Bus");

// 3. Platform mentah dan metadata harus cocok.
const mismatchResult = pipeline.processRaw(
  {
    platform: "tiktok",
    type: "CHAT",
    data: {
      nickname: "Budi",
      comment: "Tes",
    },
  },
  {
    ...baseEvent,
    id: "internal_003",
    platform: "youtube",
  },
);

check(!mismatchResult, "Event dengan platform tidak cocok ditolak");
check(receivedEvents === 1, "Jumlah event valid tetap satu");

console.log("\nSemua pengujian validasi selesai.");
