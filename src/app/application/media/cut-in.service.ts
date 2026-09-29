import { DestroyRef, inject, Injectable } from '@angular/core';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { AudioStorage } from '@axe/core/storage/audio-storage';
import { ObjectStore } from '@axe/core/sync/object-store';
import { launchPortraitFitOf } from '@axe/domain/character/character-portrait-fit';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { CutIn } from '@axe/domain/media/cut-in';
import { CutInLauncher } from '@axe/domain/media/cut-in-launcher';
import { type CutInPortraitSnapshot, makePortraitSnapshot, portraitFrameOf } from '@axe/domain/media/cut-in-portrait';
import { Jukebox } from '@axe/domain/media/jukebox';
import { parseCutInIdentifiers, pickCutInIdentifier, rollCutIn } from '@axe/domain/media/table-cut-in';
import { GameTable } from '@axe/domain/tabletop/game-table';

const CHAT_TAIL_PATTERN = /\s(@?)(\S+)$/i;

/** Whose picture a launch brings for a template's portrait slot. An empty picture shows the silhouette. */
export interface CutInPortraitPick {
  characterIdentifier: string;
  imageIdentifier: string;
  /**
   * The name `{character}` shows. Left out, it is the named character's own name; a player
   * speaking as themself gives the name they speak under.
   */
  characterName?: string;
}

/**
 * How lately a line has to have been said for its cut-in to still be meant.
 *
 * Joining a room and loading one from a file both hand every line that was ever said to the
 * same event a new line arrives on. Without this, walking in would set off every cut-in the
 * evening has named, and since starting one is spoken to the whole room, everybody would see them.
 */
const JUST_SAID_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class CutInService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly objectStore = inject(ObjectStore);
  private readonly audioStorage = inject(AudioStorage);

  constructor() {
    this.objectChange.messageAdded$.subscribe((event) => {
      const message = this.objectStore.get<ChatMessage>(event.messageIdentifier);
      if (!message || message.tags.includes('secret')) return;
      // Only the end that said it starts the cut-in. Every end hears the line, and starting
      // one is spoken to the whole room, so one line would otherwise start it once per person.
      if (!message.isSendFromSelf) return;
      // A line older than this arrived by sync or by loading a room, and was not just said.
      if (Date.now() - message.timestamp > JUST_SAID_MS) return;
      this.activateFromChatText(message.text, message.to ?? '', this.speakerPortraitOf(message));
    }, this.destroyRef);
  }

  /**
   * Starts the cut-in named by the last word of a chat line.
   *
   * Only cut-ins set to start from chat answer, and a last word written with `@` plays the cut-in's
   * sound alone. `sendTo` is the user id a direct line was sent to, or empty for a line to everyone.
   * It goes onto the launcher, so the other peers leave the cut-in to that one user, while this peer
   * plays it as well. `portrait` is the picture the line was spoken with, for a template's portrait
   * slot.
   */
  activateFromChatText(text: string, sendTo: string, portrait: CutInPortraitPick | null = null): void {
    const matches = ` ${text}`.match(CHAT_TAIL_PATTERN);
    if (!matches) return;

    const isSoundOnly = matches[1] === '@';
    const activateName = matches[2];

    const launcher = this.objectStore.get<CutInLauncher>('CutInLauncher');
    if (!launcher) return;

    const target = this.objectStore.getObjects(CutIn).find((c) => c.chatActivate && c.name === activateName);
    if (!target) return;

    if (isSoundOnly) {
      launcher.startSoundOnlyCutIn(target, sendTo);
    } else {
      this.launch(target, sendTo, portrait);
    }
  }

  /**
   * Plays what the table asks for on being chosen, drawing one when it names several.
   *
   * The draw happens here, on the machine that changed the table, and reaches everyone
   * else as the launcher's own update — so the whole room sees the same cut-in.
   */
  launchForTable(table: GameTable, roll: (count: number) => number = rollCutIn): boolean {
    const identifiers = parseCutInIdentifiers(table.cutInIdentifiers);
    const picked = pickCutInIdentifier(identifiers, (id) => this.objectStore.get<CutIn>(id) != null, roll);
    if (!picked) return false;

    const cutIn = this.objectStore.get<CutIn>(picked);
    return cutIn ? this.launch(cutIn) : false;
  }

  /**
   * Plays a cut-in for everyone, handling the music the same way a chat-started one does.
   *
   * A template with a portrait slot shows the picked portrait, or the silhouette without one. The
   * picture and the character's fit for it are read here, once, and travel with the launch.
   */
  launch(cutIn: CutIn, sendTo = '', portrait: CutInPortraitPick | null = null): boolean {
    const launcher = this.objectStore.get<CutInLauncher>('CutInLauncher');
    if (!launcher) return false;

    if (this.isCutInBgmUploaded(cutIn.audioIdentifier) && cutIn.tagName === '') {
      this.objectStore.get<Jukebox>('Jukebox')?.stop();
    }
    launcher.startCutIn(cutIn, sendTo, this.snapshotOf(cutIn, portrait));
    return true;
  }

  /** Plays a cut-in on this screen alone, with the picked portrait in its slot. */
  launchForMyself(cutIn: CutIn, portrait: CutInPortraitPick | null = null): boolean {
    const launcher = this.objectStore.get<CutInLauncher>('CutInLauncher');
    if (!launcher) return false;

    launcher.startCutInMySelf(cutIn, this.snapshotOf(cutIn, portrait));
    return true;
  }

  /**
   * The name and the fit are read here, once, so every peer shows what the character had at launch.
   * The fit is the character's own for the picture and the slot's frame.
   */
  private snapshotOf(cutIn: CutIn, portrait: CutInPortraitPick | null): CutInPortraitSnapshot | null {
    const scene = cutIn.scene;
    const characterIdentifier = portrait?.characterIdentifier ?? '';
    const found = characterIdentifier ? this.objectStore.get(characterIdentifier) : null;
    const character = found instanceof GameCharacter ? found : null;
    const characterName = portrait?.characterName ?? String(character?.name ?? '');
    const imageIdentifier = portrait?.imageIdentifier ?? '';
    const fit = scene ? launchPortraitFitOf(character, portraitFrameOf(scene.layers), imageIdentifier) : undefined;
    return makePortraitSnapshot(scene, characterIdentifier, imageIdentifier, characterName, fit);
  }

  /**
   * The character a line was spoken as and the picture it was spoken with. A player speaking as
   * themself brings no picture, only the name they spoke under.
   */
  private speakerPortraitOf(message: ChatMessage): CutInPortraitPick | null {
    const speaker = this.objectStore.get(message.sendFrom ?? '');
    if (!(speaker instanceof GameCharacter)) {
      return { characterIdentifier: '', imageIdentifier: '', characterName: message.name ?? '' };
    }
    return { characterIdentifier: speaker.identifier, imageIdentifier: message.imageIdentifier ?? '' };
  }

  /** Plays only what a cut-in sounds like, the way a chat line ending in `@` asks for. */
  launchSoundOnly(cutIn: CutIn, sendTo = ''): boolean {
    const launcher = this.objectStore.get<CutInLauncher>('CutInLauncher');
    if (!launcher) return false;

    launcher.startSoundOnlyCutIn(cutIn, sendTo);
    return true;
  }

  private isCutInBgmUploaded(audioIdentifier: string): boolean {
    return this.audioStorage.get(audioIdentifier) !== null;
  }
}
