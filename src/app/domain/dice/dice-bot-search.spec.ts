import { diceBotSearch, normalizeDiceBotText } from '@axe/domain/dice/dice-bot-search';

const INFOS = [
  { id: 'SwordWorld2.5', name: 'ソード・ワールド2.5', sortKey: 'そおとわあると2.5' },
  { id: 'Cthulhu7th', name: '新クトゥルフ神話TRPG', sortKey: 'しんくとうるふしんわTRPG' },
  { id: 'LogHorizon', name: 'ログ・ホライズンTRPG', sortKey: 'ろくほらいすんTRPG' },
  { id: 'DiceBot', name: 'DiceBot', sortKey: '*たいすほつと' },
];

describe('the dice bot search', () => {
  const search = diceBotSearch(INFOS);
  const found = (term: string) =>
    INFOS.filter((info) => search(term, { $ngOptionValue: info.id })).map((info) => info.id);

  it('puts typed text as BCDice writes a reading', () => {
    expect(normalizeDiceBotText('ソード・ワールド')).toBe('そおとわあると');
    expect(normalizeDiceBotText('そーどわーるど')).toBe('そおとわあると');
    expect(normalizeDiceBotText('ＳＷ２．５')).toBe('sw25');
  });

  it('finds a system by its name without the middle dot, in katakana or hiragana', () => {
    expect(found('ソードワールド')).toEqual(['SwordWorld2.5']);
    expect(found('そーどわーるど')).toEqual(['SwordWorld2.5']);
    expect(found('ログホライズン')).toEqual(['LogHorizon']);
  });

  it('finds a system by part of its name, as before', () => {
    expect(found('クトゥルフ')).toEqual(['Cthulhu7th']);
  });

  it('finds a system by its id or the initials of its id', () => {
    expect(found('sword')).toEqual(['SwordWorld2.5']);
    expect(found('SW2.5')).toEqual(['SwordWorld2.5']);
    expect(found('lh')).toContain('LogHorizon');
  });

  it('keeps everything for an empty search, and nothing for an unknown id', () => {
    expect(found('')).toHaveLength(INFOS.length);
    expect(search('そーど', { $ngOptionValue: 'Missing' })).toBe(false);
  });
});
