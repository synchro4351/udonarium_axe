import {
  HAND_DRAW_TARGET_ATTRIBUTE,
  HAND_DROP_USER_ATTRIBUTE,
  handDropRecipientAt,
  isOwnHandDrawTargetAt,
} from '@axe/features/card/hand-rail/hand-drop-target';
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

  it('does not pass a drop through a panel covering a hand section', () => {
    const { child } = sectionFor('other');
    const coveringPanel = document.createElement('div');

    expect(handDropRecipientAt([coveringPanel, child], 'me', ['me', 'other'])).toBe('');
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

describe('isOwnHandDrawTargetAt', () => {
  function drawTargetFor(userId: string): { section: HTMLElement; child: HTMLElement } {
    const section = document.createElement('section');
    section.setAttribute(HAND_DRAW_TARGET_ATTRIBUTE, userId);
    const child = document.createElement('div');
    section.appendChild(child);
    return { section, child };
  }

  it('accepts your own section under the pointer, even from a nested element', () => {
    const { child } = drawTargetFor('me');

    expect(isOwnHandDrawTargetAt([child], 'me')).toBe(true);
  });

  it("refuses someone else's section and elements outside any section", () => {
    const { section } = drawTargetFor('other');

    expect(isOwnHandDrawTargetAt([section], 'me')).toBe(false);
    expect(isOwnHandDrawTargetAt([document.createElement('div')], 'me')).toBe(false);
  });

  it('does not pass a drop through a panel covering your section', () => {
    const { child } = drawTargetFor('me');

    expect(isOwnHandDrawTargetAt([document.createElement('div'), child], 'me')).toBe(false);
  });

  it('refuses everything while you have no user id', () => {
    const { section } = drawTargetFor('');

    expect(isOwnHandDrawTargetAt([section], '')).toBe(false);
  });
});
