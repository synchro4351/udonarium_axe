import {
  partsOfGroup,
  speakerChoices,
  SpeakerPiece,
  WHOLE_GROUP_PREFIX,
  wholeGroupOf,
} from '@axe/features/chat/chat-input/chat-speakers';

function piece(identifier: string, name: string, group = '', groupName = '', partName = ''): SpeakerPiece {
  return { identifier, name, partGroup: group, partGroupName: groupName, partName, partGroupImage: '' };
}

describe('the speaker list', () => {
  const pieces = [
    piece('hero', 'ヒロ'),
    piece('head', 'モンスターC(頭部)', 'g1', 'モンスターC', '頭部'),
    piece('mage', 'メイ'),
    piece('body', 'モンスターC(胴体)', 'g1', 'モンスターC', '胴体'),
  ];

  it('puts a creature of linked parts on one line, where its first part stands', () => {
    expect(speakerChoices(pieces, new Set(), 'hero')).toEqual([
      { value: 'hero', label: 'ヒロ' },
      { value: `${WHOLE_GROUP_PREFIX}g1`, label: 'モンスターC' },
      { value: 'mage', label: 'メイ' },
    ]);
  });

  it('keeps a part beside its creature once it has been spoken as, and while it is chosen', () => {
    expect(speakerChoices(pieces, new Set(['body']), 'head').map((choice) => choice.value)).toEqual([
      'hero',
      `${WHOLE_GROUP_PREFIX}g1`,
      'head',
      'body',
      'mage',
    ]);
  });

  it('falls back to the first part name for a creature with no group name', () => {
    expect(speakerChoices([piece('a', 'パーツA', 'g2')], new Set(), '')[0].label).toBe('パーツA');
  });

  it('reads which creature a choice speaks for, and its parts in order', () => {
    expect(wholeGroupOf(`${WHOLE_GROUP_PREFIX}g1`)).toBe('g1');
    expect(wholeGroupOf('hero')).toBeNull();
    expect(partsOfGroup(pieces, 'g1').map((part) => part.identifier)).toEqual(['head', 'body']);
  });
});
