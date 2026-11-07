import { BuffAppearance, parseBuffAppearance } from '@axe/domain/character/buff-appearance';
import { splitBuffRounds } from '@axe/domain/character/buff-command';
import { BuffPileOn } from '@axe/domain/character/buff-stack';
import { GameCharacter } from '@axe/domain/character/game-character';
import type { ResourceSlot } from '@axe/domain/data/resource-slot';

export interface RemoteControllerSelect {
  /** The item the buttons point at. Empty where none has been picked out. */
  name: string;
  nowOrMax: ResourceSlot;
  dispName: string;
}

/** How a buff put on without a number of rounds, held until taken off, is written in the chat line. */
export const HELD_BUFF_WORD = '消えない';

export interface ParsedBuffInput {
  buffname: string;
  sub: string;
  round: number;
  bufftext: string;
  appearance: BuffAppearance;
  /** What second helping the line asks for on a buff already standing. */
  piles: BuffPileOn;
}

/**
 * Reads a line typed into the remote controller's buff field as a buff to put on the targets.
 *
 * The words are, separated by spaces or slashes (as the chat line writes them): the buff's name, an
 * optional note such as `攻撃+2`, an optional number of rounds (3 when not a number), and then any
 * colour, timing, `@trigger` or icon words; a timing in place of the rounds reads as the rounds left
 * out. A buff put on without a number of rounds stays until it is taken off (tyoitashi), unless a
 * timing word says otherwise; one piled on a standing buff without a number keeps that buff's
 * rounds. A `+` in front of the name asks for the note's number to be added to a buff of that name
 * already standing rather than written over it, and `++` lengthens it by the rounds asked for as
 * well. The chat line announcing it joins the words with slashes and marks the rounds with `R`,
 * leaving them out for a buff that never runs out. An empty line is null.
 */
export function parseBuffInput(text: string): ParsedBuffInput | null {
  const parts = text.trim().split(/[\s/／]+/);
  if (parts.length === 0 || parts[0] === '') return null;
  const marked = parts[0].match(/^([+＋]{1,2})(?=[^+＋])/);
  const piles: BuffPileOn = marked ? (marked[1].length > 1 ? 'extend' : 'stack') : 'none';
  if (marked) parts[0] = parts[0].slice(marked[1].length);
  const buffname = parts[0];
  let bufftext = parts[0];
  let sub = '';
  let round = 3;
  if (parts.length > 1) {
    sub = parts[1];
    bufftext += '/' + parts[1];
  }
  const { rounds, look } = splitBuffRounds(parts.slice(2));
  if (rounds !== undefined) {
    round = parseInt(rounds);
    if (Number.isNaN(round)) round = 3;
  }
  const appearance = parseBuffAppearance(look);
  if (!rounds?.trim() && piles === 'none' && !appearance.timing) {
    appearance.timing = 'none';
    bufftext += '/' + HELD_BUFF_WORD;
  }
  if (appearance.timing !== 'none') bufftext += '/' + round + 'R';
  for (const token of look) bufftext += '/' + token;
  return { buffname, sub, round, bufftext, appearance, piles };
}

/**
 * Puts the same buff on each of the given characters for the given number of rounds; a buff one
 * already has starts over with the new values.
 */
export function addBuffRound(
  characters: GameCharacter[],
  name: string,
  info: string,
  round: number,
  appearance: BuffAppearance = {}
): void {
  for (const character of characters) {
    character.buffs.addRound(name, info, round, appearance);
  }
}

/**
 * Puts the same buff on each of the given characters, adding its note's number to whatever a buff
 * of that name already carries instead of writing over it.
 *
 * `extend` lengthens each buff by the rounds asked for as well, rather than leaving whichever
 * count is longer.
 */
export function pileBuffRound(
  characters: GameCharacter[],
  piles: Exclude<BuffPileOn, 'none'>,
  name: string,
  info: string,
  round: number,
  appearance: BuffAppearance = {}
): void {
  for (const character of characters) {
    if (piles === 'extend') character.buffs.extendRound(name, info, round, appearance);
    else character.buffs.stackRound(name, info, round, appearance);
  }
}

/** Steps every buff on the given pieces down a round, and names the pieces it touched. */
export function decreaseBuffRound(characters: readonly GameCharacter[]): string {
  return actOnBuffs(characters, (character) => character.buffs.decreaseRound());
}

/** Clears the buffs that have run out on the given pieces, and names the pieces it touched. */
export function deleteZeroRoundBuffs(characters: readonly GameCharacter[]): string {
  return actOnBuffs(characters, (character) => character.buffs.deleteZeroRound());
}

/**
 * Takes the buff of that name off the given pieces, and names the pieces that had it; empty where
 * none did.
 */
export function removeBuffNamed(characters: readonly GameCharacter[], name: string): string {
  return characters
    .filter((character) => character.buffs.delete(name))
    .map((character) => `[${character.name}]`)
    .join('');
}

function actOnBuffs(characters: readonly GameCharacter[], act: (character: GameCharacter) => void): string {
  if (characters.length < 1) return '';
  const names: string[] = [];
  for (const character of characters) {
    act(character);
    names.push(`[${character.name}]`);
  }
  return names.join('');
}
