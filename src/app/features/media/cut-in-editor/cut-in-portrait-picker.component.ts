import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ObjectStore } from '@axe/core/sync/object-store';
import {
  type CharacterPortraitChoice,
  characterPortraitChoices,
  currentPortraitImageIdentifier,
} from '@axe/domain/character/character-portrait';
import { GameCharacter } from '@axe/domain/character/game-character';
import { CutIn } from '@axe/domain/media/cut-in';
import { CutInPortraitPickService } from '@axe/features/media/cut-in-editor/cut-in-portrait-pick.service';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Who a template is tried with, and which of their pictures.
 *
 * The choice is shared with the other tab through `CutInPortraitPickService`. Nothing is written
 * here: how a picture sits in the slot belongs to the character and is set on its sheet, so the
 * preview only shows it.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'cut-in-portrait-picker',
  templateUrl: './cut-in-portrait-picker.component.html',
  host: { class: 'block' },
  imports: [FormsModule, TranslocoModule],
})
export class CutInPortraitPickerComponent {
  private readonly objectStore = inject(ObjectStore);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly pick = inject(CutInPortraitPickService);

  readonly cutIn = input<CutIn | null>(null);
  /** Whether a picture is chosen too: only a scene with a portrait slot has anywhere to show one. */
  readonly showsImage = input(true);

  get characters(): GameCharacter[] {
    this.objectChange.collectionOf(GameCharacter.aliasName)();
    return this.objectStore.getObjects(GameCharacter);
  }

  private get cutInIdentifier(): string {
    return this.cutIn()?.identifier ?? '';
  }

  get character(): string {
    return this.pick.choiceFor(this.cutInIdentifier).characterIdentifier;
  }
  /** Choosing someone brings the picture they are speaking with, as the chat would. */
  set character(identifier: string) {
    const character = this.objectStore.get<GameCharacter>(identifier);
    this.pick.choose(this.cutInIdentifier, {
      characterIdentifier: identifier,
      imageIdentifier: character instanceof GameCharacter ? currentPortraitImageIdentifier(character) : '',
    });
  }

  get images(): CharacterPortraitChoice[] {
    const character = this.objectStore.get<GameCharacter>(this.character);
    return character instanceof GameCharacter ? characterPortraitChoices(character) : [];
  }

  get image(): string {
    return this.pick.choiceFor(this.cutInIdentifier).imageIdentifier;
  }
  set image(identifier: string) {
    this.pick.choose(this.cutInIdentifier, { characterIdentifier: this.character, imageIdentifier: identifier });
  }
}
