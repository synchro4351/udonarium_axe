import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ObjectStore } from '@axe/core/sync/object-store';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { canRoleViewTab } from '@axe/domain/chat/chat-tab-permission';
import { type OverheadSpeech, overheadSpeechHoldMs, overheadSpeechOf } from '@axe/domain/chat/overhead-speech';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';

/** One bubble over one piece. The key changes each time, so a replaced bubble is drawn afresh. */
export interface OverheadBubble {
  readonly key: number;
  readonly messageIdentifier: string;
  readonly speech: OverheadSpeech;
}

/**
 * The bubbles over speaking pieces, which this screen alone keeps for a few seconds.
 *
 * Nothing here is written to the room: a bubble is how one reader sees a line arrive, and the log
 * keeps the line itself. A piece holds one bubble at a time, the latest line replacing the one before.
 */
@Injectable({ providedIn: 'root' })
export class OverheadSpeechService {
  private readonly store = inject(ObjectStore);
  private readonly bubbles = signal<ReadonlyMap<string, OverheadBubble>>(new Map());
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private key = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  /** The bubble over the piece, or null while it says nothing. */
  bubbleOf(characterIdentifier: string): OverheadBubble | null {
    return this.bubbles().get(characterIdentifier) ?? null;
  }

  /** Whether the room has turned bubbles on. */
  get enabled(): boolean {
    return this.store.get<Config>('Config')?.showsOverheadSpeech ?? false;
  }

  /**
   * Whether this reader may see the line over its speaker's head.
   *
   * Only a line said openly to a tab the reader may read: never one addressed to particular
   * people, one kept back as secret, or what the tool puts out, such as dice results and notices.
   * Even the people a direct line concerns do not see it here, as the table is in view of everyone.
   */
  canShow(message: ChatMessage): boolean {
    if (!this.enabled) return false;
    const tab = this.store.get<ChatTab>(message.tabIdentifier);
    return (
      tab instanceof ChatTab &&
      this.store.get(message.identifier) === message &&
      !message.isDirect &&
      !message.isSecret &&
      !message.isSystem &&
      !message.isSystemMessage &&
      !message.isSystemToPL &&
      canRoleViewTab(tab, PeerCursor.myRole)
    );
  }

  /**
   * Puts the line over the piece that said it, replacing whatever that piece said before.
   *
   * Answers whether a bubble was put up: a line nobody may see here, one not said as a piece, and
   * one with nothing to put over a head all leave the table as it is.
   */
  show(message: ChatMessage): boolean {
    if (!this.canShow(message)) return false;
    const speaker = this.store.get(message.sendFrom);
    if (!(speaker instanceof GameCharacter)) return false;
    const speech = overheadSpeechOf(message);
    if (!speech) return false;

    const characterIdentifier = speaker.identifier;
    clearTimeout(this.timers.get(characterIdentifier));
    this.bubbles.update((current) =>
      new Map(current).set(characterIdentifier, {
        key: ++this.key,
        messageIdentifier: message.identifier,
        speech,
      })
    );
    this.timers.set(
      characterIdentifier,
      setTimeout(() => this.remove(characterIdentifier), overheadSpeechHoldMs(speech))
    );
    return true;
  }

  /**
   * Takes down every bubble whose line this reader may no longer see: gone, moved to a tab they
   * cannot read, or the room having turned bubbles off.
   */
  recheck(): void {
    for (const [characterIdentifier, bubble] of this.bubbles()) {
      const message = this.store.get<ChatMessage>(bubble.messageIdentifier);
      if (!(message instanceof ChatMessage) || !this.canShow(message)) this.remove(characterIdentifier);
    }
  }

  /** Takes every bubble down at once. */
  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    if (this.bubbles().size > 0) this.bubbles.set(new Map());
  }

  private remove(characterIdentifier: string): void {
    clearTimeout(this.timers.get(characterIdentifier));
    this.timers.delete(characterIdentifier);
    if (!this.bubbles().has(characterIdentifier)) return;
    this.bubbles.update((current) => {
      const next = new Map(current);
      next.delete(characterIdentifier);
      return next;
    });
  }
}
