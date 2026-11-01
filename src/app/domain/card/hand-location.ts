export const HAND_LOCATION_PREFIX = 'hand:';

/** The location name a card takes while it is held in the given user's hand. */
export function handLocationOf(userId: string): string {
  return HAND_LOCATION_PREFIX + userId;
}

/** Whether a location name puts the object in some player's hand; a bare prefix with no user does not count. */
export function isHandLocation(locationName: string): boolean {
  return locationName.startsWith(HAND_LOCATION_PREFIX) && locationName.length > HAND_LOCATION_PREFIX.length;
}

/** The user id of the player holding a hand location, or null when the location is not a hand. */
export function handHolderOf(locationName: string): string | null {
  return isHandLocation(locationName) ? locationName.slice(HAND_LOCATION_PREFIX.length) : null;
}

/** Whether a location name is the given user's hand; always false for an empty user id. */
export function isHandOf(locationName: string, userId: string): boolean {
  // Asked before a room has been joined, nobody holds anything.
  if (!userId) return false;
  return handHolderOf(locationName) === userId;
}

/**
 * What a character's hand is held under, in place of a user id: the same `hand:` locations as a
 * player's hand, so every way of moving a card into or out of a hand works on it unchanged.
 */
export const CHARACTER_HAND_HOLDER_PREFIX = 'chr:';

/** The holder a character's hand goes by. */
export function characterHandHolderOf(characterIdentifier: string): string {
  return CHARACTER_HAND_HOLDER_PREFIX + characterIdentifier;
}

/** The character a holder stands for, or null for a player's hand or a holder with no character. */
export function characterOfHandHolder(holder: string): string | null {
  return holder.startsWith(CHARACTER_HAND_HOLDER_PREFIX) && holder.length > CHARACTER_HAND_HOLDER_PREFIX.length
    ? holder.slice(CHARACTER_HAND_HOLDER_PREFIX.length)
    : null;
}
