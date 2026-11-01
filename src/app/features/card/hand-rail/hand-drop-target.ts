/** Attribute naming the participant whose hand overview section a hand card can be dropped on. */
export const HAND_DROP_USER_ATTRIBUTE = 'data-hand-drop-user-id';

/**
 * Attribute marking a hand overview section a card drawn from another hand drops on: your own, or a
 * character's you hold for.
 */
export const HAND_DRAW_TARGET_ATTRIBUTE = 'data-hand-draw-target';

/**
 * The hand a card drawn from another hand is let go over, among those you may draw into, or empty
 * over anything else. Judged by the topmost element only, so a section covered by another window
 * does not take it.
 */
export function handDrawTargetAt(elements: readonly Element[], holders: readonly string[]): string {
  const section = elements[0]?.closest(`[${HAND_DRAW_TARGET_ATTRIBUTE}]`);
  const holder = section?.getAttribute(HAND_DRAW_TARGET_ATTRIBUTE) ?? '';
  return holder.length > 0 && holders.includes(holder) ? holder : '';
}

/** Whether a card drawn from someone else's hand is let go over your own hand overview section. */
export function isOwnHandDrawTargetAt(elements: readonly Element[], myUserId: string): boolean {
  return myUserId.length > 0 && handDrawTargetAt(elements, [myUserId]) === myUserId;
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
