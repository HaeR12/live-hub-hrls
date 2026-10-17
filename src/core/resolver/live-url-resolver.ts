export type LivePlatform = "youtube" | "tiktok" | "twitch" | "kick";

export interface ResolvedLiveUrl {
  platform: LivePlatform;
  inputUrl: string;
  canonicalUrl: string;
  videoId?: string;
  channelUsername?: string;
}

export type ResolveResult =
  | {
      ok: true;
      value: ResolvedLiveUrl;
    }
  | {
      ok: false;
      error: string;
    };

export function resolveLiveUrl(input: string): ResolveResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      ok: false,
      error: "URL tidak boleh kosong.",
    };
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "URL tidak valid. Masukkan URL lengkap, termasuk https://.",
    };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      ok: false,
      error: "Hanya URL HTTP atau HTTPS yang didukung.",
    };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    const videoId =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.match(/^\/(?:live|embed)\/([^/]+)/)?.[1];

    if (!videoId || !/^[\w-]{6,}$/.test(videoId)) {
      return {
        ok: false,
        error: "URL YouTube harus berupa URL video atau live yang didukung.",
      };
    }

    return {
      ok: true,
      value: {
        platform: "youtube",
        inputUrl: trimmed,
        canonicalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        videoId,
      },
    };
  }

  if (host === "youtu.be") {
    const videoId = url.pathname.split("/").filter(Boolean)[0];

    if (!videoId || !/^[\w-]{6,}$/.test(videoId)) {
      return {
        ok: false,
        error: "ID video dari URL youtu.be tidak valid.",
      };
    }

    return {
      ok: true,
      value: {
        platform: "youtube",
        inputUrl: trimmed,
        canonicalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        videoId,
      },
    };
  }

  if (host === "tiktok.com" || host === "vm.tiktok.com") {
    const match = url.pathname.match(/^\/@([^/]+)\/live\/?$/);

    if (!match) {
      return {
        ok: false,
        error:
          "Untuk TikTok, masukkan URL profil live dengan format /@username/live.",
      };
    }

    const channelUsername = match[1];

    return {
      ok: true,
      value: {
        platform: "tiktok",
        inputUrl: trimmed,
        canonicalUrl: `https://www.tiktok.com/@${channelUsername}/live`,
        channelUsername,
      },
    };
  }

  if (host === "twitch.tv") {
    const parts = url.pathname.split("/").filter(Boolean);
    const username = parts[0];

    if (
      !username ||
      parts.length !== 1 ||
      [
        "directory",
        "downloads",
        "jobs",
        "p",
        "search",
        "settings",
        "videos",
      ].includes(username.toLowerCase())
    ) {
      return {
        ok: false,
        error:
          "Masukkan URL channel Twitch, misalnya https://www.twitch.tv/username.",
      };
    }

    return {
      ok: true,
      value: {
        platform: "twitch",
        inputUrl: trimmed,
        canonicalUrl: `https://www.twitch.tv/${username}`,
        channelUsername: username,
      },
    };
  }

  if (host === "kick.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const username = parts[0];

    if (
      !username ||
      parts.length !== 1 ||
      ["categories", "clips", "dashboard", "search", "videos"].includes(
        username.toLowerCase(),
      )
    ) {
      return {
        ok: false,
        error: "Masukkan URL channel Kick, misalnya https://kick.com/username.",
      };
    }

    return {
      ok: true,
      value: {
        platform: "kick",
        inputUrl: trimmed,
        canonicalUrl: `https://kick.com/${username}`,
        channelUsername: username,
      },
    };
  }

  return {
    ok: false,
    error: `Platform tidak didukung: ${host}`,
  };
}
