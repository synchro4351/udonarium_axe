import { HAND_DROP_USER_ATTRIBUTE, handDropRecipientAt } from '@axe/features/card/hand-rail/hand-drop-target';
import { describe, expect, it } from 'vitest';

describe('handDropRecipientAt', () => {
  function sectionFor(userId: string): { section: HTMLElement; child: HTMLElement } {
    const section = document.createElement('section');
    section.setAttribute(HAND_DROP_USER_ATTRIBUTE, userId);
    const child = document.createElement('div');
    section.appendChild(child);
    return { section, child };
  }

  it('finds the participant of the section under the pointer, even from a nested element', () => {
    const { child } = sectionFor('other');

    expect(handDropRecipientAt([child], 'me', ['me', 'other'])).toBe('other');
  });

  it('ignores elements outside any drop section', () => {
    expect(handDropRecipientAt([document.createElement('div')], 'me', ['me', 'other'])).toBe('');
  });

  it('never sends a card to yourself', () => {
    const { section } = sectionFor('me');

    expect(handDropRecipientAt([section], 'me', ['me', 'other'])).toBe('');
  });

  it('refuses a section whose participant has left', () => {
    const { section } = sectionFor('gone');

    expect(handDropRecipientAt([section], 'me', ['me', 'other'])).toBe('');
  });
});
