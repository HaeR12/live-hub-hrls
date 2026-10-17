import { HaerEvent } from "../events/types.js";

export class EventDeduplicator {
  private readonly seenEvents = new Map<string, number>();

  constructor(
    private readonly ttlMs = 5 * 60 * 1000,
    private readonly maxEntries = 10_000,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error("ttlMs harus lebih besar dari 0");
    }

    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new Error("maxEntries harus berupa bilangan bulat positif");
    }
  }

  isDuplicate(event: HaerEvent): boolean {
    const now = Date.now();
    this.cleanupExpired(now);

    const key = this.createKey(event);

    const previous = this.seenEvents.get(key);

    if (previous !== undefined) {
      console.log("[DEDUP DEBUG] Kunci sudah ditemukan:", {
        key,
        firstSeenAt: previous,
        currentTime: now,
        ageMs: now - previous,
      });

      return true;
    }

    // Batasi memori dengan menghapus entri yang paling lama tercatat.
    while (this.seenEvents.size >= this.maxEntries) {
      const oldestKey = this.seenEvents.keys().next().value;

      if (oldestKey === undefined) break;

      this.seenEvents.delete(oldestKey);
    }

    this.seenEvents.set(key, now);
    return false;
  }

  private createKey(event: HaerEvent): string {
    if (event.eventId) {
      return JSON.stringify([
        event.platform,
        event.streamId,
        event.type,
        event.eventId,
      ]);
    }

    return JSON.stringify([
      event.platform,
      event.streamId,
      event.sessionId,
      event.type,
      event.id,
    ]);
  }

  private cleanupExpired(now: number): void {
    for (const [key, timestamp] of this.seenEvents) {
      if (now - timestamp >= this.ttlMs) {
        this.seenEvents.delete(key);
      }
    }
  }

  clear(): void {
    this.seenEvents.clear();
  }
}
