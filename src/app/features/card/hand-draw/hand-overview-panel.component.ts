import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CardGameService } from '@axe/application/card/card-game.service';
import { ImageService } from '@axe/application/storage/image.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card } from '@axe/domain/card/card';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { HandDragService } from '@axe/features/card/hand-rail/hand-drag.service';
import { CardFacePreviewComponent } from '@axe/ui/components/card-face-preview/card-face-preview.component';
import { SafePipe } from '@axe/ui/pipes/safe.pipe';
import { TranslocoModule } from '@jsverse/transloco';

export interface HandOverviewSection {
  userId: string;
  name: string;
  isSelf: boolean;
  handPublic: boolean;
  cards: Card[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'hand-overview-panel',
  templateUrl: './hand-overview-panel.component.html',
  host: { class: 'text-ui-text block h-full overflow-y-auto p-3' },
  imports: [CardFacePreviewComponent, SafePipe, TranslocoModule],
})
export class HandOverviewPanelComponent {
  private readonly objectStore = inject(ObjectStore);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly imageService = inject(ImageService);
  private readonly cardGame = inject(CardGameService);
  protected readonly drag = inject(HandDragService);

  /**
   * Every participant who may hold cards, each with their hand as everyone else sees it: fronts only
   * while that hand is public.
   */
  readonly sections = computed<HandOverviewSection[]>(() => {
    this.objectChange.collectionOf(Card.aliasName)();
    this.objectChange.collectionOf(PeerCursor.aliasName)();
    this.objectChange.versionOf('Config')();
    this.objectChange.trackMyCursor();
    for (const cursor of this.objectStore.getObjects<PeerCursor>(PeerCursor)) {
      this.objectChange.versionOf(cursor.identifier)();
    }
    for (const card of this.objectStore.getObjects<Card>(Card)) this.objectChange.versionOf(card.identifier)();

    const myUserId = this.cardGame.myUserId();
    return this.cardGame.participants().map((seat) => ({
      userId: seat.userId,
      name: seat.name,
      isSelf: seat.userId === myUserId,
      handPublic: this.cardGame.handPublicOf(seat.userId),
      cards: this.cardGame.handCardsOf(seat.userId),
    }));
  });

  /** Whether the room lets you give cards away; while it does not, no section takes a dropped card. */
  protected readonly allowsGive = computed(() => {
    this.objectChange.versionOf('Config')();
    return this.cardGame.allowsHandGive();
  });

  /** True while a card from your own hand is being dragged and may be given, so other sections show as drop targets. */
  protected readonly dropping = computed(() => this.allowsGive() && this.drag.card() !== null);

  /** The URL of a card's back, which is all of a private hand that is shown. */
  backImageUrl(card: Card): string {
    this.objectChange.fileVersion();
    return this.imageService.getEmptyOr(card.backImage).url;
  }

  /** A public hand's card front, including the same card text the owner sees. */
  frontImageUrl(card: Card): string {
    this.objectChange.fileVersion();
    return this.imageService.getEmptyOr(card.frontImage).url;
  }
}
