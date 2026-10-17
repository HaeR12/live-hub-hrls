export type PlatformStats = {
  connected: boolean | null;
  viewers: number | null;
  views: number | null;
  likes: number | null;
  chatMessages: number;
  giftEvents: number;
  followEvents: number;
  membershipEvents: number;
  donationEvents: number;
};

export type DashboardStats = {
  platforms: Record<string, PlatformStats>;
  totals: {
    viewers: number | null;
    views: number | null;
    likes: number | null;
    chatMessages: number;
    giftEvents: number;
    followEvents: number;
    membershipEvents: number;
    donationEvents: number;
  };
  eventsReceived: number;
  updatedAt: number | null;
};

type IncomingEvent = {
  type?: string;
  platform?: string;
  timestamp?: number;
  data?: unknown;
};

const SUPPORTED_PLATFORMS = ["tiktok", "youtube", "twitch", "kick"];

function createPlatformStats(): PlatformStats {
  return {
    connected: null,
    viewers: null,
    views: null,
    likes: null,
    chatMessages: 0,
    giftEvents: 0,
    followEvents: 0,
    membershipEvents: 0,
    donationEvents: 0,
  };
}

function readNumber(
  data: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return null;
}

function readConnectionStatus(data: Record<string, unknown>): boolean | null {
  if (typeof data.connected === "boolean") return data.connected;
  if (typeof data.isConnected === "boolean") return data.isConnected;

  const raw = data.status ?? data.state;
  if (typeof raw !== "string") return null;

  const status = raw.toLowerCase();

  // StreamStatus resmi dari ConnectionManager.
  if (status === "live" || status === "connected" || status === "online" || status === "terhubung") {
    return true;
  }

  if (
    [
      "offline",
      "ended",
      "error",
      "failed",
      "disconnected",
      "terputus",
      "connecting",
      "reconnecting",
    ].includes(status)
  ) {
    return false;
  }

  return null;
}

export class StatsAggregator {
  private platforms = new Map<string, PlatformStats>();
  private eventsReceived = 0;
  private updatedAt: number | null = null;

  constructor() {
    for (const platform of SUPPORTED_PLATFORMS) {
      this.platforms.set(platform, createPlatformStats());
    }
  }

  consume(event: IncomingEvent): DashboardStats {
    const platform = String(event.platform ?? "").toLowerCase();
    const type = String(event.type ?? "");

    const data: Record<string, unknown> =
      event.data !== null &&
      typeof event.data === "object" &&
      !Array.isArray(event.data)
        ? (event.data as Record<string, unknown>)
        : {};

    this.eventsReceived += 1;
    this.updatedAt =
      typeof event.timestamp === "number" ? event.timestamp : Date.now();

    if (!this.platforms.has(platform)) {
      this.platforms.set(platform, createPlatformStats());
    }

    const stats = this.platforms.get(platform)!;

    switch (type) {
      case "STREAM_STATUS": {
        const status = readConnectionStatus(data);
        if (status !== null) stats.connected = status;
        break;
      }

      case "VIEWER_UPDATE": {
        const value = readNumber(data, ["current", "viewers", "count"]);
        if (value !== null) stats.viewers = value;
        break;
      }

      case "VIEW_UPDATE": {
        const value = readNumber(data, ["views", "total", "current", "count"]);
        if (value !== null) stats.views = value;
        break;
      }

      case "LIKE": {
        const value = readNumber(data, [
          "totalLikes",
          "total",
          "likes",
          "count",
        ]);
        if (value !== null) stats.likes = value;
        break;
      }

      case "CHAT":
        stats.chatMessages += 1;
        break;

      case "GIFT":
        stats.giftEvents += 1;
        break;

      case "FOLLOW":
        stats.followEvents += 1;
        break;

      case "MEMBERSHIP":
        stats.membershipEvents += 1;
        break;

      case "DONATION":
        stats.donationEvents += 1;
        break;
    }

    return this.getSnapshot();
  }

  getSnapshot(): DashboardStats {
    const platforms: Record<string, PlatformStats> = {};

    for (const [name, stats] of this.platforms) {
      platforms[name] = { ...stats };
    }

    const values = Object.values(platforms);

    // Jangan menjumlahkan viewer lintas platform jika ada kemungkinan
    // penonton yang sama menonton kedua siaran.
    const sumKnown = (key: "views" | "likes") => {
      const known = values
        .map((stats) => stats[key])
        .filter((value): value is number => value !== null);

      return known.length > 0
        ? known.reduce((sum, value) => sum + value, 0)
        : null;
    };

    return {
      platforms,
      totals: {
        viewers: null,
        views: sumKnown("views"),
        likes: sumKnown("likes"),
        chatMessages: values.reduce(
          (sum, stats) => sum + stats.chatMessages,
          0,
        ),
        giftEvents: values.reduce((sum, stats) => sum + stats.giftEvents, 0),
        followEvents: values.reduce(
          (sum, stats) => sum + stats.followEvents,
          0,
        ),
        membershipEvents: values.reduce(
          (sum, stats) => sum + stats.membershipEvents,
          0,
        ),
        donationEvents: values.reduce(
          (sum, stats) => sum + stats.donationEvents,
          0,
        ),
      },
      eventsReceived: this.eventsReceived,
      updatedAt: this.updatedAt,
    };
  }

  reset(): void {
    this.platforms.clear();

    for (const platform of SUPPORTED_PLATFORMS) {
      this.platforms.set(platform, createPlatformStats());
    }

    this.eventsReceived = 0;
    this.updatedAt = null;
  }
}
