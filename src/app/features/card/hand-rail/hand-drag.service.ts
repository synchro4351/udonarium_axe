import { Injectable, signal } from '@angular/core';
import { Card } from '@axe/domain/card/card';

@Injectable({ providedIn: 'root' })
export class HandDragService {
  readonly card = signal<Card | null>(null);
  readonly x = signal(0);
  readonly y = signal(0);
  readonly tableCard = signal<Card | null>(null);
  /** The participant whose hand overview section the carried card is over, empty when none. */
  readonly dropUserId = signal('');
  /** A card being drawn out of someone else's hand in the hand overview, null when none. */
  readonly drawCard = signal<Card | null>(null);
  /**
   * The only image the drag ghost shows of a card being drawn: its back unless the hand it comes from
   * is public, so the ghost never reveals more than the overview does.
   */
  readonly drawImageUrl = signal('');

  /**
   * Starts carrying a card out of the hand rail, with the drag ghost drawn at the given viewport
   * point.
   */
  begin(card: Card, x = 0, y = 0): void {
    this.card.set(card);
    this.x.set(x);
    this.y.set(y);
  }

  /** Moves the drag ghost of the carried hand card to a new viewport point. */
  move(x: number, y: number): void {
    this.x.set(x);
    this.y.set(y);
  }

  /** Stops carrying a hand card, which takes the drag ghost away. */
  end(): void {
    this.card.set(null);
    this.dropUserId.set('');
  }

  /**
   * Starts carrying a card out of another participant's hand in the hand overview, with the drag
   * ghost showing only the given image at the given viewport point.
   */
  beginDraw(card: Card, imageUrl: string, x = 0, y = 0): void {
    this.drawCard.set(card);
    this.drawImageUrl.set(imageUrl);
    this.x.set(x);
    this.y.set(y);
  }

  /** Stops carrying a card being drawn, which takes the drag ghost away. */
  endDraw(): void {
    this.drawCard.set(null);
    this.drawImageUrl.set('');
  }

  /**
   * Marks a card from the table as being dragged, so the hand rail lights up as a place it can drop
   * into.
   */
  armTableDrag(card: Card): void {
    this.tableCard.set(card);
  }

  /** Clears the table card being dragged, turning the hand rail's highlight off. */
  disarmTableDrag(): void {
    this.tableCard.set(null);
  }
}
