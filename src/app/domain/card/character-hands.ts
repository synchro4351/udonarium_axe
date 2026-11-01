import { ObjectStore } from '@axe/core/sync/object-store';
import { characterHandHolderOf, characterOfHandHolder, handHolderOf } from '@axe/domain/card/hand-location';
import { GameCharacter } from '@axe/domain/character/game-character';
import { canRoleSeeHidden, PeerRole } from '@axe/domain/peer/peer-role';

/** Who is asking about a character's hand: their user id and their role in the room. */
export interface HandViewer {
  userId: string;
  role: PeerRole;
}

/** The character whose hand a location is, or null for a player's hand, the table or a character gone. */
export function handCharacterAt(locationName: string): GameCharacter | null {
  const holder = handHolderOf(locationName);
  const identifier = holder === null ? null : characterOfHandHolder(holder);
  if (identifier === null) return null;
  const character = ObjectStore.instance.get(identifier);
  return character instanceof GameCharacter ? character : null;
}

/**
 * Whether the viewer sees the fronts of a character's hand, as a player sees their own: the
 * character's owner does, and the game master sees every character's, a character nobody owns
 * included. Anyone else sees them as they see another player's hand.
 */
export function seesCharacterHand(character: GameCharacter, viewer: HandViewer): boolean {
  if (canRoleSeeHidden(viewer.role)) return true;
  return viewer.userId.length > 0 && character.owner === viewer.userId;
}

/** Whether the viewer sees the fronts of the character hand a location is; false for any other location. */
export function seesCharacterHandAt(locationName: string, viewer: HandViewer): boolean {
  const character = handCharacterAt(locationName);
  return character !== null && seesCharacterHand(character, viewer);
}

/** The holder of a character's hand, for moving cards into it. */
export function handHolderForCharacter(character: GameCharacter): string {
  return characterHandHolderOf(character.identifier);
}
