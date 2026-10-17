import assert from "node:assert/strict";
import { StatsAggregator } from "./stats-aggregator.js";

const aggregator = new StatsAggregator();

const consumeStatus = (status: string) =>
  aggregator.consume({
    type: "STREAM_STATUS",
    platform: "youtube",
    timestamp: Date.now(),
    data: { status },
  });

consumeStatus("CONNECTING");
assert.equal(aggregator.getSnapshot().platforms.youtube.connected, false);

consumeStatus("LIVE");
assert.equal(aggregator.getSnapshot().platforms.youtube.connected, true);

consumeStatus("RECONNECTING");
assert.equal(aggregator.getSnapshot().platforms.youtube.connected, false);

consumeStatus("OFFLINE");
assert.equal(aggregator.getSnapshot().platforms.youtube.connected, false);

console.log("StatsAggregator connection-status regression tests passed.");
