import { DestroyRef, inject, Injectable } from '@angular/core';
import { ChatSpeechService } from '@axe/application/chat/chat-speech.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { networkMessage$ } from '@axe/core/network/network-messaging';
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
        this.reset();
    }, this.destroyRef);
  }

  private reset(): void {
    this.speech.disable();
    this.seen.clear();
    for (const message of this.store.getObjects<ChatMessage>(ChatMessage)) this.seen.add(message.identifier);
  }
}
