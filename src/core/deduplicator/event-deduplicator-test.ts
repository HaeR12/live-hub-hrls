import { EventDeduplicator } from "./event-deduplicator.js";

import { HaerEvent } from "../events/types.js";

function makeEvent(
  eventId: string,
  type: "CHAT" | "VIEWER_UPDATE",
  data: unknown,
): HaerEvent {
  return {
    id: `internal_${eventId}`,
    eventId,
    type,
    platform: "tiktok",
    streamId: "test_stream",
    sessionId: "test_session",
    timestamp: Date.now(),
    source: "deduplicator_test",
    data,
  };
}

function assertEqual(
  actual: boolean,
  expected: boolean,
  description: string,
): void {
  if (actual !== expected) {
    throw new Error(
      `FAIL: ${description}. Expected ${expected}, got ${actual}`,
    );
  }

  console.log(`PASS: ${description}`);
}

const deduplicator = new EventDeduplicator();

console.log("\nTest 1: Pesan sama, ID berbeda");

const chat1 = makeEvent("chat_001", "CHAT", {
  message: "Halo!",
  user: { name: "Andi" },
});

const chat2 = makeEvent("chat_002", "CHAT", {
  message: "Halo!",
  user: { name: "Andi" },
});

assertEqual(deduplicator.isDuplicate(chat1), false, "Pesan pertama diterima");

assertEqual(
  deduplicator.isDuplicate(chat2),
  false,
  "Pesan identik dengan ID berbeda tetap diterima",
);

console.log("\nTest 2: ID event sama");

const chatDuplicate = makeEvent("chat_001", "CHAT", {
  message: "Halo!",
  user: { name: "Andi" },
});

assertEqual(
  deduplicator.isDuplicate(chatDuplicate),
  true,
  "Event dengan ID yang sama ditolak",
);

console.log("\nTest 3: Jumlah penonton sama, ID berbeda");

const viewers1 = makeEvent("view_001", "VIEWER_UPDATE", { current: 1245 });

const viewers2 = makeEvent("view_002", "VIEWER_UPDATE", { current: 1245 });

assertEqual(
  deduplicator.isDuplicate(viewers1),
  false,
  "Pembaruan penonton pertama diterima",
);

assertEqual(
  deduplicator.isDuplicate(viewers2),
  false,
  "Pembaruan penonton dengan ID berbeda tetap diterima",
);

console.log("\nSemua pengujian selesai.");
