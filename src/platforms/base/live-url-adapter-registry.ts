import {
  LivePlatform,
  ResolvedLiveUrl,
} from "../../core/resolver/live-url-resolver.js";

import { LiveUrlAdapter } from "./live-url-adapter.js";

export class LiveUrlAdapterRegistry {
  private adapters = new Map<LivePlatform, LiveUrlAdapter>();

  register(adapter: LiveUrlAdapter): void {
    if (this.adapters.has(adapter.platform)) {
      throw new Error(`Adapter already registered: ${adapter.platform}`);
    }

    this.adapters.set(adapter.platform, adapter);
  }

  get(platform: LivePlatform): LiveUrlAdapter | undefined {
    return this.adapters.get(platform);
  }

  getFor(source: ResolvedLiveUrl): LiveUrlAdapter {
    const adapter = this.adapters.get(source.platform);

    if (!adapter) {
      throw new Error(
        `No live adapter registered for platform: ${source.platform}`,
      );
    }

    return adapter;
  }

  has(platform: LivePlatform): boolean {
    return this.adapters.has(platform);
  }

  listPlatforms(): LivePlatform[] {
    return [...this.adapters.keys()];
  }
}
