const BRIDGE_URL = "ws://127.0.0.1:3210";

let socket = null;
let reconnectTimer = null;
let reconnectDelay = 1000;

function getVideoId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (host !== "youtube.com" && !host.endsWith(".youtube.com")) {
      return null;
    }

    const queryId = parsed.searchParams.get("v");
    if (queryId) return queryId;

    const parts = parsed.pathname.split("/").filter(Boolean);

    if (["live", "shorts", "embed", "v"].includes(parts[0])) {
      return parts[1] ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

function connect() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  console.log("[LiveHub Extension] Connecting to bridge...");

  const ws = new WebSocket(BRIDGE_URL);
  socket = ws;

  ws.addEventListener("open", () => {
    console.log("[LiveHub Extension] Bridge connected");
    reconnectDelay = 1000;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });

  ws.addEventListener("message", (event) => {
    console.log("[LiveHub Extension] Bridge message:", event.data);
  });

  ws.addEventListener("close", () => {
    if (socket === ws) socket = null;

    console.warn("[LiveHub Extension] Bridge disconnected");
    scheduleReconnect();
  });

  ws.addEventListener("error", () => {
    console.warn("[LiveHub Extension] WebSocket error");
    ws.close();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== "YOUTUBE_CHAT") return;
  if (!sender.tab || !sender.url) return;

  const payload = message.payload;

  if (
    !payload ||
    typeof payload.authorName !== "string" ||
    !payload.authorName.trim() ||
    typeof payload.displayMessage !== "string" ||
    !payload.displayMessage.trim()
  ) {
    return;
  }

  const videoId = getVideoId(sender.url) || payload.videoId;

  if (typeof videoId !== "string" || !videoId.trim()) {
    console.warn("[LiveHub Extension] Chat rejected: video ID missing");
    return;
  }

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("[LiveHub Extension] Chat skipped: bridge is disconnected");
    return;
  }

  socket.send(
    JSON.stringify({
      platform: "youtube",
      type: "CHAT",
      eventId: payload.eventId,
      videoId,
      data: {
        authorName: payload.authorName.trim(),
        displayMessage: payload.displayMessage.trim(),
      },
    }),
  );
});

connect();
