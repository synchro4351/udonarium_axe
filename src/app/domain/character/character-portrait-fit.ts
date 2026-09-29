import { GameCharacter } from '@axe/domain/character/game-character';
import {
  characterPortraitFitIn,
  type CutInPortraitFrame,
  launchPortraitFit,
  type StoredPortraitFit,
  withCharacterPortraitFit,
} from '@axe/domain/media/cut-in-portrait';

/**
 * How a character has one of its pictures fitted into a cut-in's portrait slot of a frame, or none
 * when it never fitted it.
 */
export function portraitFitOf(
  character: GameCharacter,
  frame: CutInPortraitFrame,
  imageIdentifier: string
): StoredPortraitFit | null {
  return characterPortraitFitIn(character.portraitFits, frame, imageIdentifier);
}

/** Keeps how the character has a picture fitted to a frame. It reaches the room like any change to the character. */
export function setPortraitFitOf(
  character: GameCharacter,
  frame: CutInPortraitFrame,
  imageIdentifier: string,
  fit: StoredPortraitFit
): void {
  if (!imageIdentifier) return;
  character.portraitFits = withCharacterPortraitFit(character.portraitFits, frame, imageIdentifier, fit);
}

/** Forgets how the character had a picture fitted to a frame, so it sits the way an unfitted one does. */
export function clearPortraitFitOf(character: GameCharacter, frame: CutInPortraitFrame, imageIdentifier: string): void {
  if (!imageIdentifier) return;
  const next = withCharacterPortraitFit(character.portraitFits, frame, imageIdentifier, null);
  if (next !== character.portraitFits) character.portraitFits = next;
}

/**
 * The fit a cut-in launched for a character's picture carries: the character's own, else what an
 * older scene kept for the picture, else the default.
 */
export function launchPortraitFitOf(
  character: GameCharacter | null,
  legacySceneFits: string | null | undefined,
  frame: CutInPortraitFrame,
  imageIdentifier: string
): StoredPortraitFit {
  return launchPortraitFit(character?.portraitFits, legacySceneFits, frame, imageIdentifier);
}
