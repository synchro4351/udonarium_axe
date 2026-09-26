import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardGameService, CardSeat, OrphanHandRescueResult } from '@axe/application/card/card-game.service';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { ImageService } from '@axe/application/storage/image.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ConfirmService } from '@axe/application/ui/confirm.service';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card } from '@axe/domain/card/card';
import { OrphanHand, shortUserIdOf } from '@axe/domain/card/orphan-hands';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { SafePipe } from '@axe/ui/pipes/safe.pipe';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * The game master's view of hands left behind by participants who are no longer in the room, with a
 * way to hand each one over whole to someone connected.
 *
 * Shown to nobody else, folded away until opened, and only the backs of the cards are drawn.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'orphan-hand-rescue',
  templateUrl: './orphan-hand-rescue.component.html',
  host: { class: 'block' },
  imports: [SafePipe, TranslocoModule],
})
export class OrphanHandRescueComponent {
  private readonly objectStore = inject(ObjectStore);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly imageService = inject(ImageService);
  private readonly cardGame = inject(CardGameService);
  private readonly confirm = inject(ConfirmService);
  private readonly t = inject(TRANSLATE_FN);

  /** The recipient picked for each orphaned hand, by the absent user's id. */
  private readonly picked = signal<Record<string, string>>({});
  /** How the last attempt ended; a refusal is shown until the next pick, success is told in chat. */
  protected readonly outcome = signal<OrphanHandRescueResult | null>(null);

  /** Whether you are the game master, the only one this is shown to. */
  protected readonly isGameMaster = computed(() => {
    this.objectChange.trackMyCursor();
    return this.cardGame.canRescueOrphanHands();
  });

  /** Every hand held by nobody in the room. */
  readonly hands = computed<OrphanHand[]>(() => {
    this.objectChange.collectionOf(Card.aliasName)();
    this.objectChange.collectionOf(PeerCursor.aliasName)();
    this.objectChange.trackMyCursor();
    for (const cursor of this.objectStore.getObjects<PeerCursor>(PeerCursor)) {
      this.objectChange.versionOf(cursor.identifier)();
    }
    for (const card of this.objectStore.getObjects<Card>(Card)) this.objectChange.versionOf(card.identifier)();
    return this.cardGame.orphanHands();
  });

  /** Who can take an orphaned hand right now. */
  readonly recipients = computed<CardSeat[]>(() => {
    this.objectChange.collectionOf(PeerCursor.aliasName)();
    this.objectChange.networkVersion();
    this.objectChange.trackMyCursor();
    for (const cursor of this.objectStore.getObjects<PeerCursor>(PeerCursor)) {
      this.objectChange.versionOf(cursor.identifier)();
    }
    return this.cardGame.orphanHandRecipients();
  });

  protected shortId(userId: string): string {
    return shortUserIdOf(userId);
  }

  /** The recipient picked for a hand, forgotten once they can no longer take it. */
  protected pickedFor(userId: string): string {
    const picked = this.picked()[userId] ?? '';
    return this.recipients().some((seat) => seat.userId === picked) ? picked : '';
  }

  protected pick(userId: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.picked.update((picked) => ({ ...picked, [userId]: value }));
    this.outcome.set(null);
  }

  /** The URL of a card's back, the only side of an orphaned hand that is ever drawn here. */
  backImageUrl(card: Card): string {
    this.objectChange.fileVersion();
    return this.imageService.getEmptyOr(card.backImage).url;
  }

  /**
   * Asks for confirmation, naming the hand, the number of cards and the recipient, then moves the
   * cards that were in the hand when asked. Nothing moves when anything changed in the meantime.
   */
  protected async rescue(hand: OrphanHand): Promise<void> {
    const recipient = this.recipients().find((seat) => seat.userId === this.pickedFor(hand.userId));
    if (!recipient) return;
    const confirmed = hand.cards.map((card) => card.identifier);
    const params = {
      from: shortUserIdOf(hand.userId),
      count: confirmed.length,
      to: recipient.name || this.t('feature.card.hand.unnamed'),
    };
    const message = [
      this.t('feature.card.orphanHand.confirmMessage', params),
      ...(this.cardGame.handPublicOf(recipient.userId)
        ? [this.t('feature.card.orphanHand.confirmPublicWarning', params)]
        : []),
    ].join('\n');
    const ok = await this.confirm.ask({
      title: this.t('feature.card.orphanHand.confirmTitle'),
      message,
      okLabel: this.t('feature.card.orphanHand.move'),
    });
    if (!ok) return;
    this.outcome.set(this.cardGame.rescueOrphanHand(hand.userId, recipient.userId, confirmed));
  }
}
