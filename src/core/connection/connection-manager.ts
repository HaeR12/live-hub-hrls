import { EventBus } from "../events/event-bus.js";
import { createEvent } from "../events/event-factory.js";
import { Platform, StreamStatus } from "../events/types.js";
import { NetworkMonitor, NetworkStatus } from "../network/network-monitor.js";

export interface ManagedAdapter {
  platform: Platform;
  streamId: string;
  sessionId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isConnected(): boolean;
  canReconnect?(): boolean;
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const value = (error as { retryAfter?: unknown }).retryAfter;

  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export class ConnectionManager {
  private adapters: ManagedAdapter[] = [];
  private reconnectTimers = new Map<Platform, NodeJS.Timeout>();
  private reconnectAttempts = new Map<Platform, number>();

  // Mencegah start/reconnect ganda pada platform yang sama.
  private starting = new Set<Platform>();

  private networkStatus: NetworkStatus = "ONLINE";

  private isNetworkOffline(): boolean {
    return this.networkStatus === "OFFLINE";
  }

  constructor(
    private eventBus: EventBus,
    private networkMonitor: NetworkMonitor,
  ) {
    this.networkMonitor.onStatusChange((status) => {
      this.handleNetworkChange(status);
    });
  }

  register(adapter: ManagedAdapter): void {
    const alreadyRegistered = this.adapters.some(
      (item) => item.platform === adapter.platform,
    );

    if (alreadyRegistered) {
      throw new Error(`Adapter ${adapter.platform} sudah terdaftar.`);
    }

    this.adapters.push(adapter);
  }

  async startAll(): Promise<void> {
    if (this.isNetworkOffline()) {
      console.log("[ConnectionManager] Network offline, start postponed");
      return;
    }

    console.log(
      "[ConnectionManager] Registered adapters:",
      this.adapters.map((adapter) => adapter.platform),
    );

    for (const adapter of this.adapters) {
      console.log(`[ConnectionManager] Memulai adapter: ${adapter.platform}`);

      await this.startAdapter(adapter);

      console.log(
        `[ConnectionManager] Adapter ${adapter.platform} selesai diproses. Connected:`,
        adapter.isConnected(),
      );
    }
  }

  async stopAll(): Promise<void> {
    for (const adapter of this.adapters) {
      this.clearReconnect(adapter.platform);

      try {
        await adapter.stop();
      } catch (error) {
        console.error(
          `[ConnectionManager] Gagal menghentikan ${adapter.platform}:`,
          error,
        );
      }

      this.emitStatus(adapter, "OFFLINE", 0);
    }
  }

  async startAdapter(adapter: ManagedAdapter): Promise<void> {
    if (this.isNetworkOffline()) {
      console.log(
        `[ConnectionManager] ${adapter.platform} start skipped: network offline`,
      );
      return;
    }

    if (this.starting.has(adapter.platform)) return;
    if (adapter.isConnected()) return;
    if (adapter.canReconnect?.() === false) return;

    this.starting.add(adapter.platform);
    this.emitStatus(adapter, "CONNECTING", 0);

    let shouldRetry = false;
    let retryAfterMs: number | undefined;

    try {
      await adapter.start();

      // Jika internet putus saat start() berjalan, batalkan koneksi.
      if (this.isNetworkOffline()) {
        await adapter.stop();

        this.emitStatus(
          adapter,
          "OFFLINE",
          this.reconnectAttempts.get(adapter.platform) ?? 0,
          "Internet connection lost",
        );

        return;
      }

      // Jangan laporkan LIVE jika adapter belum benar-benar terhubung.
      if (!adapter.isConnected()) {
        throw new Error("Adapter start selesai tetapi koneksi belum aktif.");
      }

      this.reconnectAttempts.set(adapter.platform, 0);
      this.emitStatus(adapter, "LIVE", 0);
    } catch (error) {
      console.error(`[ConnectionManager] ${adapter.platform} failed`, error);

      this.emitStatus(
        adapter,
        "ERROR",
        this.reconnectAttempts.get(adapter.platform) ?? 0,
        error instanceof Error ? error.message : "Connection failed",
      );

      retryAfterMs = getRetryAfterMs(error);
      shouldRetry = true;
    } finally {
      this.starting.delete(adapter.platform);
    }

    if (
      shouldRetry &&
      !this.isNetworkOffline() &&
      adapter.canReconnect?.() !== false
    ) {
      this.scheduleReconnect(adapter, retryAfterMs);
    }
  }

  monitor(adapter: ManagedAdapter): void {
    if (this.isNetworkOffline()) return;
    if (this.starting.has(adapter.platform)) return;
    if (adapter.isConnected()) return;
    if (adapter.canReconnect?.() === false) return;

    this.scheduleReconnect(adapter);
  }

  private handleNetworkChange(status: NetworkStatus): void {
    this.networkStatus = status;

    if (status === "OFFLINE") {
      console.log("[ConnectionManager] Network offline");

      for (const adapter of this.adapters) {
        this.clearReconnect(adapter.platform);

        void adapter.stop().catch((error) => {
          console.error(
            `[ConnectionManager] Gagal menghentikan ${adapter.platform}:`,
            error,
          );
        });

        this.emitStatus(
          adapter,
          "OFFLINE",
          this.reconnectAttempts.get(adapter.platform) ?? 0,
          "Internet connection lost",
        );
      }

      return;
    }

    console.log("[ConnectionManager] Network online");

    for (const adapter of this.adapters) {
      if (
        !adapter.isConnected() &&
        !this.starting.has(adapter.platform) &&
        adapter.canReconnect?.() !== false
      ) {
        this.scheduleReconnect(adapter);
      }
    }
  }

  private scheduleReconnect(
    adapter: ManagedAdapter,
    retryAfterMs?: number,
  ): void {
    if (this.isNetworkOffline()) return;
    if (this.starting.has(adapter.platform)) return;
    if (adapter.canReconnect?.() === false) return;
    if (this.reconnectTimers.has(adapter.platform)) return;
    if (adapter.isConnected()) return;

    const attempt = (this.reconnectAttempts.get(adapter.platform) ?? 0) + 1;

    this.reconnectAttempts.set(adapter.platform, attempt);

    const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);

    const delay = Math.max(backoffDelay, retryAfterMs ?? 0);

    console.log(
      `[ConnectionManager] ${adapter.platform} reconnect attempt ${attempt} in ${delay}ms`,
    );

    this.emitStatus(adapter, "RECONNECTING", attempt, `Retrying in ${delay}ms`);

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(adapter.platform);

      if (this.isNetworkOffline()) {
        console.log(
          `[ConnectionManager] ${adapter.platform} reconnect cancelled: network offline`,
        );
        return;
      }

      if (this.starting.has(adapter.platform)) return;
      if (adapter.canReconnect?.() === false) return;
      if (adapter.isConnected()) return;

      this.starting.add(adapter.platform);

      let shouldRetry = false;
      let nextRetryAfterMs: number | undefined;

      try {
        await adapter.start();

        // Jangan mempertahankan koneksi yang selesai setelah internet putus.
        if (this.isNetworkOffline()) {
          await adapter.stop();

          this.emitStatus(
            adapter,
            "OFFLINE",
            this.reconnectAttempts.get(adapter.platform) ?? attempt,
            "Internet connection lost",
          );

          return;
        }

        // Reconnect hanya berhasil jika adapter benar-benar terhubung.
        if (!adapter.isConnected()) {
          throw new Error("Reconnect selesai tetapi koneksi belum aktif.");
        }

        this.reconnectAttempts.set(adapter.platform, 0);
        this.emitStatus(adapter, "LIVE", 0, "Reconnected");
      } catch (error) {
        console.error(
          `[ConnectionManager] ${adapter.platform} reconnect failed`,
          error,
        );

        this.emitStatus(
          adapter,
          "ERROR",
          this.reconnectAttempts.get(adapter.platform) ?? attempt,
          error instanceof Error ? error.message : "Reconnect failed",
        );

        nextRetryAfterMs = getRetryAfterMs(error);
        shouldRetry = true;
      } finally {
        this.starting.delete(adapter.platform);
      }

      if (
        shouldRetry &&
        !this.isNetworkOffline() &&
        adapter.canReconnect?.() !== false
      ) {
        this.scheduleReconnect(adapter, nextRetryAfterMs);
      }
    }, delay);

    this.reconnectTimers.set(adapter.platform, timer);
  }

  private clearReconnect(platform: Platform): void {
    const timer = this.reconnectTimers.get(platform);

    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(platform);
    }
  }

  private emitStatus(
    adapter: ManagedAdapter,
    status: StreamStatus,
    attempt: number,
    message?: string,
  ): void {
    const event = createEvent(
      "STREAM_STATUS",
      adapter.platform,
      adapter.streamId,
      adapter.sessionId,
      { status, attempt, message },
      "connection_manager",
    );

    this.eventBus.emit(event);
  }
}
