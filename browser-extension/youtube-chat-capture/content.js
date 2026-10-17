(() => {
  if (window.__haerLiveHubChatCaptureStarted) return;

  window.__haerLiveHubChatCaptureStarted = true;

  const processed = new WeakSet();

  function getVideoId(url = location.href) {
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

  function captureMessage(element) {
    if (processed.has(element)) return;

    const authorElement = element.querySelector("#author-name");
    const messageElement = element.querySelector("#message");

    if (!authorElement || !messageElement) return;

    const authorName = authorElement.textContent?.trim() ?? "";
    const displayMessage = messageElement.textContent?.trim() ?? "";
    const videoId = getVideoId();

    if (!authorName || !displayMessage || !videoId) return;

    processed.add(element);

    const rendererId = element.getAttribute("id");
    const eventId = rendererId
      ? `youtube:${videoId}:${rendererId}`
      : `youtube:${videoId}:${crypto.randomUUID()}`;

    chrome.runtime
      .sendMessage({
        type: "YOUTUBE_CHAT",
        payload: {
          eventId,
          videoId,
          authorName,
          displayMessage,
        },
      })
      .catch((error) => {
        console.warn(
          "[LiveHub Extension] Could not forward chat:",
          error.message,
        );
      });
  }

  function scanAddedNode(node) {
    if (!(node instanceof Element)) return;

    if (node.matches("yt-live-chat-text-message-renderer")) {
      captureMessage(node);
    }

    node
      .querySelectorAll("yt-live-chat-text-message-renderer")
      .forEach(captureMessage);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        scanAddedNode(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  console.log("[LiveHub Extension] YouTube chat capture initialized", {
    videoId: getVideoId(),
  });
})();
