import assert from "node:assert/strict";
import { YouTubeNormalizer } from "./youtube-normalizer.js";

const normalizer = new YouTubeNormalizer();
const baseEvent = {
  id: "test-id",
  platform: "youtube" as const,
  streamId: "youtube_test",
  sessionId: "session_test",
  timestamp: Date.now(),
};

const views = normalizer.normalize(
  { platform: "youtube", type: "VIEW_UPDATE", data: { total: 1234 } },
  baseEvent,
);
assert.equal(views.type, "VIEW_UPDATE");
assert.deepEqual(views.data, { total: 1234 });

const likes = normalizer.normalize(
  { platform: "youtube", type: "LIKE", data: { total: 56 } },
  baseEvent,
);
assert.equal(likes.type, "LIKE");
assert.deepEqual(likes.data, { total: 56 });

const viewers = normalizer.normalize(
  { platform: "youtube", type: "VIEWER_UPDATE", data: { current: 12 } },
  baseEvent,
);
assert.equal(viewers.type, "VIEWER_UPDATE");
assert.deepEqual(viewers.data, { current: 12 });

console.log("YouTubeNormalizer regression tests passed.");
