import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { ImageService } from '@axe/application/storage/image.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Card } from '@axe/domain/card/card';
import { handHolderOf } from '@axe/domain/card/hand-location';
import { GameCharacter } from '@axe/domain/character/game-character';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { canRoleEdit } from '@axe/domain/peer/peer-role';
import { CardGameService } from '@axe/features/card/card-game.service';
import { OrphanHandRescueComponent } from '@axe/features/card/hand-draw/orphan-hand-rescue.component';
import { elementsAt } from '@axe/features/card/hand-rail/elements-at';
import { HandDragService } from '@axe/features/card/hand-rail/hand-drag.service';
import { handDrawTargetAt, handDropRecipientAt } from '@axe/features/card/hand-rail/hand-drop-target';
import { CardFacePreviewComponent } from '@axe/ui/components/card-face-preview/card-face-preview.component';
import { SafePipe } from '@axe/ui/pipes/safe.pipe';
import { TranslocoModule } from '@jsverse/transloco';

export interface HandOverviewSection {
  userId: string;
  name: string;
  /** Your own hand. */
  isSelf: boolean;
  /** A hand you hold for: your own, or a character's whose cards you see. */
  heldByMe: boolean;
  /** A hand you may give from: your own, or a character's you own. */
  givesFrom: boolean;
  /** The character the hand belongs to; absent for a participant's. */
  characterIdentifier?: string;
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
  imports: [CardFacePreviewComponent, OrphanHandRescueComponent, SafePipe, TranslocoModule],
})
export class HandOverviewPanelComponent {
  private readonly objectStore = inject(ObjectStore);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly imageService = inject(ImageService);
  private readonly cardGame = inject(CardGameService);
  protected readonly drag = inject(HandDragService);

  private drawPending: {
    /** Drawing from a hand you do not hold, or giving from one you do. */
    mode: 'draw' | 'give';
    card: Card;
    fromUserId: string;
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null = null;

  /** The participant whose card is being drawn, empty while no draw drag is under way. */
  protected readonly drawFromUserId = signal('');
  /** The hand you hold for that a card is being given from in this window, empty while none is. */
  protected readonly giveFromUserId = signal('');
  /** The hand the card being drawn is over, among those you may draw into; empty over anything else. */
  protected readonly drawTarget = signal('');

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
   * Every participant who may hold cards, then each character with a hand of its own, each
   * with their hand as everyone else sees it: fronts only while that hand is public.
   */
  readonly sections = computed<HandOverviewSection[]>(() => {
    this.objectChange.collectionOf(Card.aliasName)();
    this.objectChange.collectionOf(PeerCursor.aliasName)();
    this.objectChange.collectionOf(GameCharacter.aliasName)();
    for (const character of this.objectStore.getObjects<GameCharacter>(GameCharacter)) {
      this.objectChange.versionOf(character.identifier)();
    }
    this.objectChange.versionOf('Config')();
    this.objectChange.trackMyCursor();
    for (const cursor of this.objectStore.getObjects<PeerCursor>(PeerCursor)) {
      this.objectChange.versionOf(cursor.identifier)();
    }
    for (const card of this.objectStore.getObjects<Card>(Card)) this.objectChange.versionOf(card.identifier)();

    const myUserId = this.cardGame.myUserId();
    this.objectChange.versionOf('Config')();
    return [...this.cardGame.participants(), ...this.cardGame.characterSeats()].map((seat) => ({
      userId: seat.userId,
      name: seat.name,
      isSelf: seat.userId === myUserId,
      heldByMe: this.cardGame.canHoldFor(seat.userId),
      givesFrom: this.cardGame.canGiveFrom(seat.userId),
      characterIdentifier: seat.characterIdentifier,
      handPublic: this.cardGame.handPublicOf(seat.userId),
      cards: this.cardGame.handCardsOf(seat.userId),
    }));
  });

  /** The hand the card being dragged out of the rail came from, which takes no card back. */
  protected readonly draggedFrom = computed(() => {
    const card = this.drag.card();
    return card ? (handHolderOf(card.location.name) ?? '') : '';
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

  /** True while a card is being given from a hand you hold for in this window. */
  protected readonly giving = computed(() => this.allowsGive() && this.giveFromUserId().length > 0);

  /** True while a loose card from the table is carried, which any section may take. */
  protected readonly tableDropping = computed(() => this.allowsGive() && this.drag.tableCard() !== null);

  /**
   * The hand a card being carried comes from, which takes nothing back: the rail's or this window's
   * hand it is given from. Nothing for a table card, which may go to any hand, your own among them.
   */
  protected readonly giveSource = computed(() => (this.dropping() ? this.draggedFrom() : ''));

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
    // A card in a hand you give from (yours, or a character's you own) is given; one in a hand you
    // do not hold is drawn; one in a hand you only hold for, as the game master an NPC's, stays.
    const mode = section.givesFrom ? 'give' : section.heldByMe ? null : 'draw';
    if (mode === null || (mode === 'draw' ? !this.canDraw() : !this.allowsGive())) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    this.drawPending = {
      mode,
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
      if (pending.mode === 'give') {
        // Carried as a card out of the rail is: a card of a hand you hold, shown as it is.
        this.giveFromUserId.set(pending.fromUserId);
        this.drag.begin(pending.card, event.clientX, event.clientY);
        return;
      }
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
    if (pending.mode === 'give') this.drag.dropUserId.set(this.giveTargetAt(event.clientX, event.clientY));
    else this.drawTarget.set(this.drawTargetAt(event.clientX, event.clientY));
  }

  protected onCardPointerUp(event: PointerEvent): void {
    const pending = this.drawPending;
    if (!pending || pending.pointerId !== event.pointerId) return;
    this.releaseCapture(event);
    if (pending.mode === 'give') {
      const to = pending.dragging && this.giving() ? this.giveTargetAt(event.clientX, event.clientY) : '';
      this.cancelDraw();
      if (to) this.cardGame.giveFromHand(pending.card, to, pending.fromUserId);
      return;
    }
    const wasDragging = pending.dragging && this.drawing();
    const into = wasDragging ? this.drawTargetAt(event.clientX, event.clientY) : '';
    this.cancelDraw();
    if (!into) return;

    const source = this.sections().find((section) => section.userId === pending.fromUserId);
    if (!source || !source.cards.includes(pending.card)) return;
    this.cardGame.drawFromHand(pending.card, source.name, into);
  }

  protected onCardPointerCancel(event: PointerEvent): void {
    const pending = this.drawPending;
    if (!pending || pending.pointerId !== event.pointerId) return;
    this.releaseCapture(event);
    this.cancelDraw();
  }

  /** The hand you hold for under the pointer, other than the one being drawn from; empty elsewhere. */
  private drawTargetAt(clientX: number, clientY: number): string {
    if (!this.canDraw()) return '';
    const holders = this.sections()
      .filter((section) => section.heldByMe && section.userId !== this.drawFromUserId())
      .map((section) => section.userId);
    return handDrawTargetAt(elementsAt(clientX, clientY), holders);
  }

  /** The hand under the pointer a card given from this window would go to; empty elsewhere. */
  private giveTargetAt(clientX: number, clientY: number): string {
    const from = this.giveFromUserId();
    const recipients = this.cardGame.giveRecipients(from).map((seat) => seat.userId);
    return handDropRecipientAt(elementsAt(clientX, clientY), from, recipients);
  }

  private cancelDraw(): void {
    this.drawPending = null;
    this.drawFromUserId.set('');
    if (this.giveFromUserId()) this.drag.end();
    this.giveFromUserId.set('');
    this.drawTarget.set('');
    this.drag.endDraw();
  }

  private releaseCapture(event: PointerEvent): void {
    const element = event.currentTarget as HTMLElement | null;
    if (element?.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
  }
}
