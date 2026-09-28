import { GameCharacter } from '@axe/domain/character/game-character';
import { DataElement } from '@axe/domain/data/data-element';

/**
 * The character's picture entry at that position in its picture list, or null when the index is out
 * of range.
 */
export function portraitElementAt(character: GameCharacter, index: number): DataElement | null {
  const children = character.imageDataElement?.children ?? [];
  return index >= 0 && index < children.length ? children[index] : null;
}

/**
 * The name given to a picture entry, which is kept in its current value. Empty when it has none.
 */
export function portraitNameOf(element: DataElement | null | undefined): string {
  const name = element?.currentValue;
  return name == null ? '' : String(name);
}

/** One of a character's pictures, as a list to choose a portrait from shows it. */
export interface CharacterPortraitChoice {
  index: number;
  imageIdentifier: string;
  name: string;
}

/** Every picture the character has, in its own order. Entries naming no picture are left out. */
export function characterPortraitChoices(character: GameCharacter): CharacterPortraitChoice[] {
  const choices: CharacterPortraitChoice[] = [];
  for (const [index, element] of (character.imageDataElement?.children ?? []).entries()) {
    const imageIdentifier = String(element.value ?? '');
    if (imageIdentifier.length > 0) choices.push({ index, imageIdentifier, name: portraitNameOf(element) });
  }
  return choices;
}

/** The picture the character is speaking with in chat on this screen, or empty when it has none. */
export function currentPortraitImageIdentifier(character: GameCharacter): string {
  return String(portraitElementAt(character, character.selectedPortraitIndex)?.value ?? '');
}

/** Gives a picture entry a name, trimmed and kept in its current value. */
export function setPortraitNameOf(element: DataElement, name: string): void {
  element.currentValue = name.trim();
}
