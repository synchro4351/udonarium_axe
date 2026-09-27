import { DestroyRef, inject, Injectable } from '@angular/core';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { OverheadSpeechService } from '@axe/application/chat/overhead-speech.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { networkMessage$ } from '@axe/core/network/network-messaging';
import { ObjectStore } from '@axe/core/sync/object-store';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';

/** How lately a line has to have been said, by the chat clock, to be put over a head. */
const JUST_SAID_MS = 30_000;
/**
 * How far before joining, loading or reconnecting a line may be dated and still count as new,
 * allowing for a sender's clock that runs slightly behind.
 */
const CLOCK_SLACK_MS = 2_000;

/**
 * Puts lines over the pieces that say them as they arrive.
 *
 * Joining a room, loading one and reconnecting all hand every line already said to the same event
 * a new line arrives on, so a line counts only the first time it is heard, and only when it was
 * said after this screen last caught up with the room.
 */
@Injectable({ providedIn: 'root' })
export class OverheadSpeechEventHandlerService {
  private readonly overhead = inject(OverheadSpeechService);
  private readonly changes = inject(ObjectChangeService);
  private readonly store = inject(ObjectStore);
  private readonly chat = inject(ChatMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seen = new Set<string>();
  private caughtUpAt = 0;

  constructor() {
    this.reset();
    this.changes.messageAdded$.subscribe(({ messageIdentifier }) => {
      if (this.seen.has(messageIdentifier)) return;
      this.seen.add(messageIdentifier);
      const message = this.store.get<ChatMessage>(messageIdentifier);
      if (!(message instanceof ChatMessage) || !this.isJustSaid(message)) return;
      this.overhead.show(message);
    }, this.destroyRef);
    this.changes.onObjectChangedForAlias(
      [ChatMessage.aliasName, ChatTab.aliasName, PeerCursor.aliasName, Config.aliasName],
      () => this.overhead.recheck(),
      this.destroyRef
    );
    this.changes.objectRemoved$.subscribe(() => this.overhead.recheck(), this.destroyRef);
    this.changes.fileLoaded$.subscribe(() => this.reset(), this.destroyRef);
    networkMessage$.subscribe((event) => {
      if (
        event.eventName === 'CLOSE_NETWORK' ||
        event.eventName === 'OPEN_NETWORK' ||
        event.eventName === 'PEER_RECONNECT'
      )
        this.reset();
    }, this.destroyRef);
  }

  private isJustSaid(message: ChatMessage): boolean {
    const now = this.chat.getTime();
    return now - message.timestamp <= JUST_SAID_MS && message.timestamp >= this.caughtUpAt - CLOCK_SLACK_MS;
  }

  private reset(): void {
    this.overhead.clear();
    this.caughtUpAt = this.chat.getTime();
    this.seen.clear();
    for (const message of this.store.getObjects<ChatMessage>(ChatMessage)) this.seen.add(message.identifier);
  }
}
