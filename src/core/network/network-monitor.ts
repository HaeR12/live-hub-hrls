export type NetworkStatus = "ONLINE" | "OFFLINE";

type NetworkHandler = (status: NetworkStatus) => void;

export class NetworkMonitor {
  private status: NetworkStatus = "ONLINE";
  private listeners = new Set<NetworkHandler>();
  private timer?: ReturnType<typeof setInterval>;
  private checking = false;
  private simulationMode = false;

  constructor(
    private readonly checkIntervalMs = 5000,
    private readonly timeoutMs = 3000,
  ) {}

  getStatus(): NetworkStatus {
    return this.status;
  }

  onStatusChange(handler: NetworkHandler): () => void {
    this.listeners.add(handler);

    return () => {
      this.listeners.delete(handler);
    };
  }

  start(): void {
    if (this.timer) return;

    void this.checkConnection();

    this.timer = setInterval(() => {
      void this.checkConnection();
    }, this.checkIntervalMs);

    console.log("[NETWORK] Pemantauan koneksi dimulai.");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async checkConnection(): Promise<void> {
    if (this.simulationMode || this.checking) return;

    this.checking = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://www.gstatic.com/generate_204", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      // Jangan biarkan hasil pemeriksaan lama
      // mengubah status saat simulasi sedang aktif.
      if (!this.simulationMode) {
        this.setStatus(response.status === 204 ? "ONLINE" : "OFFLINE");
      }
    } catch {
      if (!this.simulationMode) {
        this.setStatus("OFFLINE");
      }
    } finally {
      clearTimeout(timeout);
      this.checking = false;
    }
  }

  private setStatus(status: NetworkStatus): void {
    if (this.status === status) return;

    this.status = status;
    console.log(`[NETWORK] ${status}`);

    for (const handler of this.listeners) {
      try {
        handler(status);
      } catch (error) {
        console.error("[NETWORK] Error pada listener:", error);
      }
    }
  }

  simulateOffline(): void {
    this.simulationMode = true;
    this.setStatus("OFFLINE");
  }

  simulateOnline(): void {
    this.simulationMode = true;
    this.setStatus("ONLINE");
  }

  resumeRealMonitoring(): void {
    this.simulationMode = false;
    void this.checkConnection();
  }
}
