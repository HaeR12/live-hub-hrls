import { EventBus } from "../events/event-bus.js";
import { createEvent } from "../events/event-factory.js";
import { EventDeduplicator } from "../deduplicator/event-deduplicator.js";
import { EventPipeline } from "./event-pipeline.js";

const eventBus = new EventBus();

const deduplicator = new EventDeduplicator();

const pipeline = new EventPipeline(eventBus, deduplicator);

eventBus.onAny((event) => {
  console.log("[EVENT BUS] Received:", event.type, event.data);
});

const event1 = createEvent(
  "CHAT",
  "tiktok",
  "stream_123",
  "session_123",
  {
    eventId: "chat_001",
    message: "Halo!",
    user: {
      name: "Andi",
    },
  },
  "test",
);

const event2 = {
  ...event1,
};

const event3 = createEvent(
  "CHAT",
  "tiktok",
  "stream_123",
  "session_123",
  {
    eventId: "chat_002",
    message: "Apa kabar?",
    user: {
      name: "Budi",
    },
  },
  "test",
);

console.log("Process event 1:", pipeline.process(event1));

console.log("Process event 2:", pipeline.process(event2));

console.log("Process event 3:", pipeline.process(event3));
