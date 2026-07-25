import { searchAsync, type MapKitPlace } from 'mapkit-search';

export type { MapKitPlace };

const DEBOUNCE_MS = 250;

type Listener = (results: MapKitPlace[], error: Error | null) => void;

export class DebouncedMapKitSearch {
  private latestId = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private bias: { latitude: number; longitude: number } | null = null;

  setRegionBias(bias: { latitude: number; longitude: number } | null) {
    this.bias = bias;
  }

  search(query: string, listener: Listener): void {
    if (this.timer) clearTimeout(this.timer);
    const id = ++this.latestId;
    const trimmed = query.trim();
    if (!trimmed) {
      listener([], null);
      return;
    }
    this.timer = setTimeout(() => {
      void this.run(id, trimmed, listener);
    }, DEBOUNCE_MS);
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.latestId++;
  }

  private async run(id: number, query: string, listener: Listener): Promise<void> {
    try {
      const results = await searchAsync(query, this.bias?.latitude, this.bias?.longitude);
      if (id !== this.latestId) return; // stale
      listener(results, null);
    } catch (e) {
      if (id !== this.latestId) return;
      listener([], e instanceof Error ? e : new Error(String(e)));
    }
  }
}
