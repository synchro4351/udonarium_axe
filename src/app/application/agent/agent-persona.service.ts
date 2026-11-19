import { Injectable, signal } from '@angular/core';
import { readLocal, writeLocal } from '@axe/core/storage/local-preference';
import { STORAGE_KEYS } from '@axe/core/storage/storage-keys';
import type { ChatSpeakAs } from '@axe/domain/chat/chat-outgoing';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';

interface StoredPersona {
  name: string;
  imageIdentifier: string;
}

/**
 * The name and face the AI linked to this seat speaks with (tyoitashi), kept in this browser as the
 * AI GM's instructions are. A line the AI says as no piece goes out under them rather than under the
 * seat's own, so a seat a person shares with the AI tells their lines apart; the AI is told the name
 * as well, so the table can call it by it. With no name chosen it goes by the seat's own name.
 */
@Injectable({ providedIn: 'root' })
export class AgentPersonaService {
  private readonly stored = signal<StoredPersona>(readStored());

  /** The name chosen, empty while none is. */
  readonly chosenName = (): string => this.stored().name;
  /** The picture chosen for the AI's face, empty while none is. */
  readonly imageIdentifier = (): string => this.stored().imageIdentifier;

  /** The name the AI goes by: the one chosen, or the seat's own where none is. */
  name(): string {
    return this.stored().name.trim() || (PeerCursor.myCursor?.name ?? '');
  }

  /** What a line the AI says as no piece goes out as. */
  speakAs(): ChatSpeakAs {
    return { name: this.name(), imageIdentifier: this.stored().imageIdentifier };
  }

  setName(name: string): void {
    this.save({ ...this.stored(), name: name.trim().slice(0, 40) });
  }

  setImage(identifier: string): void {
    this.save({ ...this.stored(), imageIdentifier: identifier });
  }

  private save(persona: StoredPersona): void {
    this.stored.set(persona);
    writeLocal(STORAGE_KEYS.agentPersona, JSON.stringify(persona));
  }
}

function readStored(): StoredPersona {
  try {
    const parsed: unknown = JSON.parse(readLocal(STORAGE_KEYS.agentPersona) ?? '{}');
    const held = (parsed ?? {}) as Record<string, unknown>;
    return {
      name: typeof held['name'] === 'string' ? held['name'] : '',
      imageIdentifier: typeof held['imageIdentifier'] === 'string' ? held['imageIdentifier'] : '',
    };
  } catch {
    return { name: '', imageIdentifier: '' };
  }
}
