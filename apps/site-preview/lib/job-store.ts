import type { PageSpec } from "@audion/page-spec";

/** In-memory jobs — use a single Node instance (`next start` one replica) or replace with Redis. */
const store = new Map<string, PageSpec>();

export const jobStore = {
  set(id: string, spec: PageSpec): void {
    store.set(id, spec);
  },
  get(id: string): PageSpec | undefined {
    return store.get(id);
  },
  has(id: string): boolean {
    return store.has(id);
  },
};
