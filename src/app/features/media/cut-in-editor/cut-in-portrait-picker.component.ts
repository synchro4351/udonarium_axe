import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
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
import {
  type CutInPortraitFit,
  DEFAULT_CUT_IN_PORTRAIT_FIT,
  MAX_PORTRAIT_ZOOM,
  MIN_PORTRAIT_ZOOM,
  portraitFitFor,
  withPortraitFit,
} from '@axe/domain/media/cut-in-portrait';
import { CutInPortraitPickService } from '@axe/features/media/cut-in-editor/cut-in-portrait-pick.service';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Who a template is tried with, and how their picture sits in its portrait slot.
 *
 * The choice is shared with the other tab through `CutInPortraitPickService`. A fit is written
 * onto the scene for the picture chosen, and `commit` follows every write, for an editor that
 * keeps an undo stack.
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
  readonly isEditable = input(false);
  /** Whether the fit fields are offered: only a scene with a portrait slot has a picture to fit. */
  readonly fits = input(true);
  readonly commit = output<void>();

  readonly minZoom = MIN_PORTRAIT_ZOOM;
  readonly maxZoom = MAX_PORTRAIT_ZOOM;

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

  private get fit(): CutInPortraitFit {
    const scene = this.cutIn()?.scene;
    if (scene) this.objectChange.versionOf(scene.identifier)();
    return portraitFitFor(scene?.portraitFits, this.image);
  }

  private changeFit(change: Partial<CutInPortraitFit>): void {
    const scene = this.cutIn()?.scene;
    if (!this.isEditable() || !scene || !this.image) return;
    scene.portraitFits = withPortraitFit(scene.portraitFits, this.image, { ...this.fit, ...change });
    this.commit.emit();
  }

  get zoom(): number {
    return this.fit.zoom;
  }
  set zoom(value: number) {
    this.changeFit({ zoom: Number(value) });
  }

  get x(): number {
    return this.fit.x;
  }
  set x(value: number) {
    this.changeFit({ x: Number(value) });
  }

  get y(): number {
    return this.fit.y;
  }
  set y(value: number) {
    this.changeFit({ y: Number(value) });
  }

  /** Puts the picture back the way an unfitted one sits. */
  protected resetFit(): void {
    this.changeFit({ ...DEFAULT_CUT_IN_PORTRAIT_FIT });
  }
}
