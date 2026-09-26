/** Attribute naming the participant whose hand overview section a hand card can be dropped on. */
export const HAND_DROP_USER_ATTRIBUTE = 'data-hand-drop-user-id';

/** Attribute marking your own hand overview section as the place a card drawn from another hand drops on. */
export const HAND_DRAW_TARGET_ATTRIBUTE = 'data-hand-draw-target';

/**
 * Whether a card drawn from someone else's hand is let go over your own hand overview section, judged
 * by the topmost element only so a section covered by another window does not take it.
 */
export function isOwnHandDrawTargetAt(elements: readonly Element[], myUserId: string): boolean {
  if (myUserId.length < 1) return false;
  const section = elements[0]?.closest(`[${HAND_DRAW_TARGET_ATTRIBUTE}]`);
  return section?.getAttribute(HAND_DRAW_TARGET_ATTRIBUTE) === myUserId;
}

/**
 * The participant a hand card dropped over these elements (topmost first) goes to, or empty when
 * they are not over a drop section, the section is your own, or its participant has since left.
 */
export function handDropRecipientAt(
  elements: readonly Element[],
  myUserId: string,
  participantUserIds: readonly string[]
): string {
  const section = elements[0]?.closest(`[${HAND_DROP_USER_ATTRIBUTE}]`);
  const userId = section?.getAttribute(HAND_DROP_USER_ATTRIBUTE) ?? '';
  if (userId.length < 1 || userId === myUserId || !participantUserIds.includes(userId)) return '';
  return userId;
}
