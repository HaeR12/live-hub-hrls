import { randomUUID } from "node:crypto";
import { BasePlatformAdapter } from "../base/platform-adapter.js";
import { EventPipeline } from "../../core/pipeline/event-pipeline.js";

interface TikTokChatPayload {
  content?: string;
  common?: {
    msgId?: string | number;
  };
  user?: {
    id?: string | number;
    uniqueId?: string;
    displayId?: string;
    nickname?: string;
  };
}

interface TikTokUserPayload {
  userId?: string | number;
  uniqueId?: string;
  nickname?: string;
}

interface TikTokRoomUserPayload {
  total?: string | number;
  totalUser?: string | number;
  viewerCount?: number;
}

interface TikTokLikePayload {
  count?: number;
  total?: string | number;
  totalLikeCount?: number;
  likeCount?: number;
}

interface TikTokGiftPayload {
  giftId?: number | string;
  giftName?: string;
  repeatCount?: number;
  repeatEnd?: number;
  giftType?: number;
  user?: TikTokUserPayload;
}

interface TikTokConnectionLike {
  connect(): Promise<unknown>;
  disconnect(): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

export class TikTokLiveAdapter extends BasePlatformAdapter {
  readonly platform = "tiktok" as const;
  readonly streamId: string;
  readonly sessionId = randomUUID();

  private connection?: TikTokConnectionLike;
  private stopped = false;
  private runId = 0;

  constructor(
    eventPipeline: EventPipeline,
    private readonly username: string,
  ) {
    super(eventPipeline);

    const normalizedUsername = username.replace(/^@/, "").trim();

    if (!normalizedUsername) {
      throw new Error("Username TikTok tidak boleh kosong.");
    }

    this.username = normalizedUsername;
    this.streamId = `tiktok_${normalizedUsername.toLowerCase()}`;
  }

  canReconnect(): boolean {
    return true;
  }

  async start(): Promise<void> {
    console.log("[TikTok] start() dipanggil.");

    if (this.connected) {
      console.log("[TikTok] Sudah terhubung, melewati start().");
      return;
    }

    console.log("[TikTok] Status stopped:", this.stopped);
    console.log("[TikTok] Username:", this.username);

    this.stopped = false;
    const runId = ++this.runId;

    try {
      // Dynamic import untuk kompatibilitas dengan package ESM.
      console.log(`[TikTok] Memulai koneksi ke @${this.username}...`);

      console.log("[TikTok] Memuat library...");

      const { TikTokLiveConnection } = await import("tiktok-live-connector");

      console.log("[TikTok] Library berhasil dimuat.");

      if (this.stopped || runId !== this.runId) return;

      const signApiKey = process.env.EULERSTREAM_API_KEY;

      const connection = new TikTokLiveConnection(
        this.username,
        signApiKey ? { signApiKey } : {},
      ) as unknown as TikTokConnectionLike;

      this.connection = connection;
      connection.on("connected", (...args: unknown[]) => {
        console.log("[TikTok] Event connected diterima:", ...args);
      });

      connection.on("chat", (...args: unknown[]) => {
        if (this.stopped || runId !== this.runId) return;

        const payload = args[0] as TikTokChatPayload | undefined;
        const message = payload?.content?.trim();
        const user = payload?.user;

        if (!message || !user) {
          console.warn("[TikTok DEBUG] Payload chat ditolak:", {
            messageIsString: typeof payload?.content === "string",
            messageLength:
              typeof payload?.content === "string"
                ? payload.content.length
                : null,
            messageIsEmptyAfterTrim:
              typeof payload?.content === "string"
                ? payload.content.trim().length === 0
                : null,
            userIsNull: payload?.user === null,
            userType: typeof payload?.user,
            userKeys:
              payload?.user && typeof payload.user === "object"
                ? Object.keys(payload.user)
                : [],
          });

          return;
        }

        const nickname =
          user.nickname || user.displayId || user.uniqueId || "Pengguna TikTok";

        const userId = user.id == null ? undefined : String(user.id);

        const username = user.uniqueId || user.displayId;

        console.log("[TikTok DEBUG] Chat diterima adapter:", {
          eventId:
            payload.common?.msgId == null
              ? undefined
              : String(payload.common.msgId),
          username,
          messageLength: message.length,
          runId,
        });

        this.eventPipeline.processRaw(
          {
            platform: "tiktok",
            type: "CHAT",
            eventId:
              payload.common?.msgId == null
                ? undefined
                : String(payload.common.msgId),
            data: {
              nickname,
              comment: message,
              userId,
              username,
            },
          },
          {
            id: randomUUID(),
            platform: "tiktok",
            streamId: this.streamId,
            sessionId: this.sessionId,
            timestamp: Date.now(),
            source: "tiktok_live_connector",
          },
        );
      });

      connection.on("roomUser", (...args: unknown[]) => {
        if (this.stopped || runId !== this.runId) return;

        const payload = args[0] as TikTokRoomUserPayload | undefined;

        const toNumber = (value: unknown): number | undefined => {
          const number =
            typeof value === "number"
              ? value
              : typeof value === "string"
                ? Number(value)
                : NaN;

          return Number.isFinite(number) && number >= 0 ? number : undefined;
        };

        const viewers = toNumber(payload?.viewerCount ?? payload?.totalUser);

        // Berdasarkan hasil pengujianmu, total adalah views realtime.
        const views = toNumber(payload?.total);

        console.log("[TikTok DEBUG] roomUser:", {
          total: payload?.total,
          totalUser: payload?.totalUser,
          viewers,
          views,
        });

        const metadata = {
          id: randomUUID(),
          platform: "tiktok" as const,
          streamId: this.streamId,
          sessionId: this.sessionId,
          timestamp: Date.now(),
          source: "tiktok_live_connector",
        };

        if (viewers !== undefined) {
          this.eventPipeline.processRaw(
            {
              platform: "tiktok",
              type: "VIEWER_UPDATE",
              data: { current: viewers },
            },
            { ...metadata, id: randomUUID() },
          );
        }

        if (views !== undefined) {
          this.eventPipeline.processRaw(
            {
              platform: "tiktok",
              type: "VIEW_UPDATE",
              data: { total: views },
            },
            { ...metadata, id: randomUUID() },
          );
        }
      });

      connection.on("like", (...args: unknown[]) => {
        if (this.stopped || runId !== this.runId) return;

        console.log(
          "[TikTok DEBUG] RAW LIKE:",
          JSON.stringify(args[0], (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        );

        const payload = args[0] as TikTokLikePayload | undefined;
        const rawTotal =
          payload?.totalLikeCount ?? payload?.likeCount ?? payload?.total;

        const total =
          typeof rawTotal === "number"
            ? rawTotal
            : typeof rawTotal === "string"
              ? Number(rawTotal)
              : NaN;

        console.log("[TikTok DEBUG] like:", {
          count: payload?.count,
          total: payload?.total,
          selectedTotal: total,
        });

        if (!Number.isFinite(total) || total < 0) {
          console.warn("[TikTok DEBUG] Total likes tidak valid.");
          return;
        }

        const accepted = this.eventPipeline.processRaw(
          {
            platform: "tiktok",
            type: "LIKE",
            data: { total },
          },
          {
            id: randomUUID(),
            platform: "tiktok",
            streamId: this.streamId,
            sessionId: this.sessionId,
            timestamp: Date.now(),
            source: "tiktok_live_connector",
          },
        );

        console.log("[TikTok DEBUG] LIKE dikirim ke pipeline:", {
          total,
          accepted,
        });
      });

      connection.on("gift", (...args: unknown[]) => {
        if (this.stopped || runId !== this.runId) return;

        console.log(
          "[TikTok DEBUG] RAW GIFT:",
          JSON.stringify(args[0], (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        );

        const payload = args[0] as TikTokGiftPayload | undefined;
        const user = payload?.user;

        // Gift dengan streak hanya dihitung saat rangkaian selesai,
        // agar satu gift tidak dihitung berkali-kali.
        if (payload?.giftType === 1 && payload.repeatEnd !== 1) return;

        if (!user || !payload) return;

        const nickname = user.nickname || user.uniqueId || "Pengguna TikTok";

        const giftName = payload.giftName || "Gift";
        const quantity =
          typeof payload.repeatCount === "number" && payload.repeatCount > 0
            ? payload.repeatCount
            : 1;

        this.eventPipeline.processRaw(
          {
            platform: "tiktok",
            type: "GIFT",
            eventId: undefined,
            data: {
              nickname,
              userId: user.userId == null ? undefined : String(user.userId),
              username: user.uniqueId,
              giftName,
              giftId:
                payload.giftId == null ? undefined : String(payload.giftId),
              quantity,
            },
          },
          {
            id: randomUUID(),
            platform: "tiktok",
            streamId: this.streamId,
            sessionId: this.sessionId,
            timestamp: Date.now(),
            source: "tiktok_live_connector",
          },
        );
      });

      connection.on("error", (...args: unknown[]) => {
        console.error("[TikTok] Connection error:", ...args);
      });

      connection.on("disconnected", () => {
        if (runId !== this.runId || this.stopped) return;

        this.connected = false;
        console.warn("[TikTok] Disconnected; menunggu ConnectionManager.");
      });

      console.log("[TikTok] Memanggil connection.connect()...");

      await connection.connect();

      console.log("[TikTok] connection.connect() selesai.");

      if (this.stopped || runId !== this.runId) {
        await connection.disconnect().catch(() => undefined);
        return;
      }

      this.connected = true;
      console.log(`[TikTok] Connected ke @${this.username}`);
    } catch (error) {
      this.connected = false;

      console.error("[TikTok] Gagal memulai koneksi:");

      if (error instanceof Error) {
        console.error(error.stack || error.message);
      } else {
        console.error(error);
      }

      if (runId === this.runId) {
        const connection = this.connection;
        this.connection = undefined;
        await connection?.disconnect().catch(() => undefined);
      }

      throw error;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.connected = false;
    this.runId++;

    const connection = this.connection;
    this.connection = undefined;

    if (connection) {
      await connection.disconnect();
    }

    console.log(`[TikTok] Disconnected dari @${this.username}`);
  }
}
