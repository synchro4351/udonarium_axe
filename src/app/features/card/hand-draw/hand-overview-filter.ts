import { readLocal, writeLocal } from '@axe/core/storage/local-preference';
import { STORAGE_KEYS } from '@axe/core/storage/storage-keys';

/**
 * The hands this reader keeps out of the list of everyone's hands (tyoitashi), by holder, kept in
 * this browser: a table of many seats and characters reads more easily with only the ones in play.
 * Each reader chooses for themselves, so it is not shared with the room.
 */
export function readHiddenHands(): Set<string> {
  try {
    const stored: unknown = JSON.parse(readLocal(STORAGE_KEYS.handOverviewHidden) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((one): one is string => typeof one === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Keeps the hands chosen out in this browser; none chosen leaves nothing stored. */
export function writeHiddenHands(hidden: ReadonlySet<string>): void {
  writeLocal(STORAGE_KEYS.handOverviewHidden, hidden.size > 0 ? JSON.stringify([...hidden].sort()) : null);
}
