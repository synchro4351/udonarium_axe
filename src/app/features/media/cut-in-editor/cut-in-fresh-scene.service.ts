import { Injectable } from '@angular/core';

/**
 * The cut-ins just made from a template, which the scene editor first shows at their fullest
 * moment rather than on an empty stage at nought.
 *
 * Asked once and forgotten, so a cut-in already in the room, or one opened again later, keeps
 * the playhead wherever the reader has it.
 */
@Injectable({ providedIn: 'root' })
export class CutInFreshSceneService {
  private readonly fresh = new Set<string>();

  mark(identifier: string): void {
    this.fresh.add(identifier);
  }

  /** Whether the cut-in was just made from a template, forgetting it as it answers. */
  take(identifier: string): boolean {
    return this.fresh.delete(identifier);
  }
}
