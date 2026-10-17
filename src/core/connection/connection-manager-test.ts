import assert from "node:assert/strict";

import { ConnectionManager } from "./connection-manager.js";
import { NetworkMonitor } from "../network/network-monitor.js";
import { EventBus } from "../events/event-bus.js";
import type { ManagedAdapter } from "./connection-manager.js";
import type { Platform } from "../events/types.js";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

class FakeAdapter implements ManagedAdapter {
  platform: Platform = "tiktok";
  streamId = "test-stream";
  sessionId = "test-session";

  connected = false;
  startGate = createDeferred<void>();

  async start(): Promise<void> {
    await this.startGate.promise;
    // Sengaja tidak mengubah connected menjadi true.
    // Ini mensimulasikan start() yang selesai tanpa koneksi aktif.
  }

  async stop(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

async function main(): Promise<void> {
  const eventBus = new EventBus();
  const networkMonitor = new NetworkMonitor();

  const manager = new ConnectionManager(eventBus, networkMonitor);
  const adapter = new FakeAdapter();

  const statuses: string[] = [];

  eventBus.on("STREAM_STATUS", (event) => {
    const data = event.data as { status?: string };
    if (data.status) statuses.push(data.status);
  });

  manager.register(adapter);

  const startPromise = manager.startAdapter(adapter);

  // Beri kesempatan startAdapter() mencapai adapter.start().
  await new Promise((resolve) => setTimeout(resolve, 0));

  networkMonitor.simulateOffline();
  await adapter.stop();

  networkMonitor.simulateOnline();

  // Selesaikan start(), tetapi adapter tetap tidak terhubung.
  adapter.startGate.resolve();

  await startPromise;

  try {
    assert.equal(
      adapter.isConnected(),
      false,
      "Fake adapter seharusnya tetap tidak terhubung.",
    );

    assert.equal(
      statuses.includes("LIVE"),
      false,
      "ConnectionManager tidak boleh mengirim status LIVE jika adapter belum terhubung.",
    );

    console.log("ConnectionManager regression test passed.");
  } finally {
    await manager.stopAll();
    networkMonitor.stop();
  }
}

main().catch((error: unknown) => {
  console.error("ConnectionManager regression test failed:", error);
  process.exitCode = 1;
});
