/** Attribute naming the participant whose hand overview section a hand card can be dropped on. */
export const HAND_DROP_USER_ATTRIBUTE = 'data-hand-drop-user-id';

/**
 * The participant a hand card dropped over these elements (topmost first) goes to, or empty when
 * they are not over a drop section, the section is your own, or its participant has since left.
 */
export function handDropRecipientAt(
  elements: readonly Element[],
  myUserId: string,
  participantUserIds: readonly string[]
): string {
  const section = elements.map((element) => element.closest(`[${HAND_DROP_USER_ATTRIBUTE}]`)).find(Boolean);
  const userId = section?.getAttribute(HAND_DROP_USER_ATTRIBUTE) ?? '';
  if (userId.length < 1 || userId === myUserId || !participantUserIds.includes(userId)) return '';
  return userId;
}
