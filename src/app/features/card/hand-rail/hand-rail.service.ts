import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HandRailService {
  readonly isOpen = signal(false);
  readonly hasUpdate = signal(false);

  /** Shows this user's hand rail. */
  open(): void {
    this.isOpen.set(true);
    this.hasUpdate.set(false);
  }

  /** Hides this user's hand rail. */
  close(): void {
    this.isOpen.set(false);
  }

  /**
   * Shows the hand rail if it is hidden and hides it if it is showing, from the toolbar and mobile
   * menu buttons.
   */
  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }

  /** Remembers a hand change only while the hand is out of view. */
  markUpdated(): void {
    if (!this.isOpen()) this.hasUpdate.set(true);
  }
}
