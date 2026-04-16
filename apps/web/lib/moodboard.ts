export type MoodboardTileLike = { order?: number | null };

export function sortMoodboardTiles<T extends MoodboardTileLike>(tiles: T[]): T[] {
  return tiles.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

