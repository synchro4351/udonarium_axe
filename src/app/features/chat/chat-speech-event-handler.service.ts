import { DestroyRef, inject, Injectable } from '@angular/core';
import { ChatSpeechService } from '@axe/application/chat/chat-speech.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { networkMessage$ } from '@axe/core/network/network-messaging';
import { getPeerContext, getRoomKey } from '@axe/core/network/peer-context-source';
import { ObjectStore } from '@axe/core/sync/object-store';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';

@Injectable({ providedIn: 'root' })
export class ChatSpeechEventHandlerService {
  private readonly speech = inject(ChatSpeechService);
  private readonly changes = inject(ObjectChangeService);
  private readonly store = inject(ObjectStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seen = new Set<string>();
  /** The room the reading was turned on in, which a reconnect to the same room keeps it on for. */
  private roomKey: string | null = roomIdentity();

  constructor() {
    for (const message of this.store.getObjects<ChatMessage>(ChatMessage)) this.seen.add(message.identifier);
    this.changes.messageAdded$.subscribe(({ messageIdentifier }) => {
      if (this.seen.has(messageIdentifier)) return;
      this.seen.add(messageIdentifier);
      const message = this.store.get<ChatMessage>(messageIdentifier);
      if (!message) return;
      this.speech.readAutomatically(message);
    }, this.destroyRef);
    this.changes.onObjectChangedForAlias(
      [ChatMessage.aliasName, ChatTab.aliasName, PeerCursor.aliasName],
      () => this.speech.checkPermissions(),
      this.destroyRef
    );
    this.changes.objectRemoved$.subscribe(() => this.speech.checkPermissions(), this.destroyRef);
    this.changes.fileLoaded$.subscribe(() => this.reset(), this.destroyRef);
    networkMessage$.subscribe((event) => {
      if (
        event.eventName === 'CLOSE_NETWORK' ||
        event.eventName === 'OPEN_NETWORK' ||
        event.eventName === 'PEER_RECONNECT'
      )
        this.followConnection();
    }, this.destroyRef);
  }

  /**
   * A connection coming and going in the same room, as a room server's does when the line drops for
   * a moment, leaves the reading on, and only the lines already there are passed over; a move to
   * another room, or out of one, turns it off as a load does.
   */
  private followConnection(): void {
    const roomKey = roomIdentity();
    if (roomKey !== null && roomKey === this.roomKey) {
      this.markSeen();
      return;
    }
    this.roomKey = roomKey;
    this.reset();
  }

  private markSeen(): void {
    for (const message of this.store.getObjects<ChatMessage>(ChatMessage)) this.seen.add(message.identifier);
  }

  private reset(): void {
    this.speech.disable();
    this.seen.clear();
    for (const message of this.store.getObjects<ChatMessage>(ChatMessage)) this.seen.add(message.identifier);
  }
}

/**
 * Which room this device is in: the room server's key, or SkyWay's room by its id and name; null
 * outside a room.
 */
function roomIdentity(): string | null {
  const key = getRoomKey();
  if (key !== null) return key;
  const context = getPeerContext();
  return context.isRoom ? `${context.roomId}/${context.roomName}` : null;
}
