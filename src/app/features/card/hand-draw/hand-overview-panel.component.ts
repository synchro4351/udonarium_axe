import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { CardGameService } from '@axe/application/card/card-game.service';
import { ImageService } from '@axe/application/storage/image.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card } from '@axe/domain/card/card';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { canRoleEdit } from '@axe/domain/peer/peer-role';
import { elementsAt } from '@axe/features/card/hand-rail/elements-at';
import { HandDragService } from '@axe/features/card/hand-rail/hand-drag.service';
import { isOwnHandDrawTargetAt } from '@axe/features/card/hand-rail/hand-drop-target';
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

/** How far the pointer must travel before pressing a card turns into drawing it. */
const DRAW_DRAG_THRESHOLD_PX = 6;

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

  private drawPending: {
    card: Card;
    fromUserId: string;
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null = null;

  /** The participant whose card is being drawn, empty while no draw drag is under way. */
  protected readonly drawFromUserId = signal('');
  /** Whether the card being drawn is over your own section, where letting go draws it. */
  protected readonly overOwnSection = signal(false);

  constructor() {
    // A draw drag ends when its card leaves that hand (someone else drew it, or the participant left)
    // and the ghost follows the hand turning public or private while it is carried.
    effect(() => {
      const card = this.drag.drawCard();
      const fromUserId = this.drawFromUserId();
      if (!card || fromUserId.length < 1) return;
      const source = this.sections().find((section) => section.userId === fromUserId);
      if (!source || !source.cards.includes(card) || !this.canDraw()) {
        this.cancelDraw();
        return;
      }
      this.drag.drawImageUrl.set(this.ghostImageUrl(card, source.handPublic));
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.drawPending?.dragging) this.drag.endDraw();
    });
  }

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

  /** Whether the room lets anyone take cards from other hands, which the hint follows. */
  protected readonly allowsDraw = computed(() => {
    this.objectChange.versionOf('Config')();
    return this.cardGame.allowsHandDraw();
  });

  /** Whether you may draw from other hands right now: the room allows it and you may hold cards. */
  protected readonly canDraw = computed(() => {
    this.objectChange.versionOf('Config')();
    this.objectChange.trackMyCursor();
    return this.cardGame.allowsHandDraw() && this.cardGame.myUserId().length > 0 && canRoleEdit(PeerCursor.myRole);
  });

  /** True while a card from your own hand is being dragged and may be given, so other sections show as drop targets. */
  protected readonly dropping = computed(() => this.allowsGive() && this.drag.card() !== null);

  /** True while a card from someone else's hand is being drawn, so your own section shows as the drop target. */
  protected readonly drawing = computed(() => this.drag.drawCard() !== null && this.drawFromUserId().length > 0);

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

  private ghostImageUrl(card: Card, handPublic: boolean): string {
    return handPublic ? this.frontImageUrl(card) : this.backImageUrl(card);
  }

  protected onCardPointerDown(event: PointerEvent, section: HandOverviewSection, card: Card): void {
    if (section.isSelf || !this.canDraw()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    this.drawPending = {
      card,
      fromUserId: section.userId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  protected onCardPointerMove(event: PointerEvent): void {
    const pending = this.drawPending;
    if (!pending || pending.pointerId !== event.pointerId) return;
    if (!pending.dragging) {
      const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
      if (distance < DRAW_DRAG_THRESHOLD_PX) return;
      const source = this.sections().find((section) => section.userId === pending.fromUserId);
      if (!source || !source.cards.includes(pending.card)) {
        this.drawPending = null;
        return;
      }
      pending.dragging = true;
      this.drawFromUserId.set(pending.fromUserId);
      this.drag.beginDraw(
        pending.card,
        this.ghostImageUrl(pending.card, source.handPublic),
        event.clientX,
        event.clientY
      );
    } else {
      this.drag.move(event.clientX, event.clientY);
    }
    this.overOwnSection.set(this.isOverOwnSection(event.clientX, event.clientY));
  }

  protected onCardPointerUp(event: PointerEvent): void {
    const pending = this.drawPending;
    if (!pending || pending.pointerId !== event.pointerId) return;
    this.releaseCapture(event);
    const wasDragging = pending.dragging && this.drawing();
    const over = wasDragging && this.isOverOwnSection(event.clientX, event.clientY);
    this.cancelDraw();
    if (!over) return;

    const source = this.sections().find((section) => section.userId === pending.fromUserId);
    if (!source || !source.cards.includes(pending.card)) return;
    this.cardGame.drawFromHand(pending.card, source.name);
  }

  protected onCardPointerCancel(event: PointerEvent): void {
    const pending = this.drawPending;
    if (!pending || pending.pointerId !== event.pointerId) return;
    this.releaseCapture(event);
    this.cancelDraw();
  }

  private isOverOwnSection(clientX: number, clientY: number): boolean {
    if (!this.canDraw()) return false;
    return isOwnHandDrawTargetAt(elementsAt(clientX, clientY), this.cardGame.myUserId());
  }

  private cancelDraw(): void {
    this.drawPending = null;
    this.drawFromUserId.set('');
    this.overOwnSection.set(false);
    this.drag.endDraw();
  }

  private releaseCapture(event: PointerEvent): void {
    const element = event.currentTarget as HTMLElement | null;
    if (element?.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
  }
}
