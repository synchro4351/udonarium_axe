import { inject, Injectable } from '@angular/core';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { generateUuid } from '@axe/core/util/uuid';
import { Hotbar } from '@axe/domain/hotbar/hotbar';
import { HotbarStarterLabels, hotbarStarterSlots } from '@axe/domain/hotbar/hotbar-starter';

const OWNER_KEY = 'ui-hotbar-owner';
/** Present only while a reader named for the first time is still owed the sample slots. */
export const HOTBAR_STARTER_KEY = 'ui-hotbar-starter';
const STARTER_DUE = 'due';

/**
 * Whose bar is on screen, and how to reach it.
 *
 * The reader is named by a mark kept in their browser rather than by the id a connection
 * hands out. The connection's id arrives late and is gone again when a room is left, and a
 * slot written in between would land on a bar nobody could find afterwards.
 */
@Injectable({ providedIn: 'root' })
export class HotbarStoreService {
  private readonly t = inject(TRANSLATE_FN);
  readonly ownerId = readOwnerId();

  constructor() {
    Hotbar.ownerId = this.ownerId;
  }

  /** This reader's hotbar, or null while they have never put anything on one. */
  own(): Hotbar | null {
    return Hotbar.forUser(this.ownerId);
  }

  /** This reader's hotbar, made and added to the room the first time it is needed. */
  ensureOwn(): Hotbar | null {
    return Hotbar.ensureForUser(this.ownerId);
  }

  /**
   * Makes the bar of a reader met for the first time, with a few sample slots on it, and hands
   * it back; null when there is nothing to do.
   *
   * Only a reader whose name was made in this browser is owed the samples, and only once. A
   * name that was already here may have a bar waiting in a room not yet joined, and a second
   * bar made under it would mix into that one when the room arrives. The debt is paid off by
   * the first look at the bar, whether or not it is made then: a bar that is already there,
   * read from a file or filled from a palette, is the reader's and is left exactly as it is,
   * and a bar the reader has emptied stays empty.
   */
  offerStarter(): Hotbar | null {
    if (!takeStarterDue()) return null;
    if (this.own()) return null;

    const hotbar = this.ensureOwn();
    if (!hotbar) return null;
    for (const { cell, draft } of hotbarStarterSlots(this.starterLabels())) {
      hotbar.put(cell.page, cell.slotIndex, draft);
    }
    return hotbar;
  }

  /** Written onto the slots as they are made, so they read in the language the reader met them in. */
  private starterLabels(): HotbarStarterLabels {
    return {
      sheet: this.t('feature.hotbar.starter.sheet'),
      focus: this.t('feature.hotbar.starter.focus'),
    };
  }
}

function readOwnerId(): string {
  try {
    const held = localStorage.getItem(OWNER_KEY);
    if (held && held.length > 0) return held;

    const made = generateUuid();
    localStorage.setItem(OWNER_KEY, made);
    markStarterDue();
    return made;
  } catch {
    /* storage unavailable — the bar still works for as long as the page is open */
    return generateUuid();
  }
}

/** A reader named just now has no bar anywhere yet, and is owed the samples on their first. */
function markStarterDue(): void {
  try {
    localStorage.setItem(HOTBAR_STARTER_KEY, STARTER_DUE);
  } catch {
    /* no samples, then — an empty bar works all the same */
  }
}

/** Whether the samples are still owed, forgetting the debt as it is read so it is paid once. */
function takeStarterDue(): boolean {
  try {
    if (localStorage.getItem(HOTBAR_STARTER_KEY) !== STARTER_DUE) return false;
    localStorage.removeItem(HOTBAR_STARTER_KEY);
    return true;
  } catch {
    return false;
  }
}
