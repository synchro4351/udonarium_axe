import { playingCardCodeOf, playingCardOfCode, playingCardOfPicture } from '@axe/domain/card/playing-card';

describe('playing cards of the bundled deck', () => {
  it('codes each card as its suit and rank, and a joker as a joker', () => {
    expect(playingCardCodeOf('s01')).toBe('s1');
    expect(playingCardCodeOf('h13')).toBe('h13');
    expect(playingCardCodeOf('x02')).toBe('joker');
    expect(playingCardCodeOf('blank_card')).toBe('');
  });

  it('reads a code back as the card it names, and nothing else', () => {
    expect(playingCardOfCode('d12')).toEqual({ suit: 'diamonds', rank: 12 });
    expect(playingCardOfCode('joker')).toEqual({ joker: true });
    expect(playingCardOfCode('s14')).toBeNull();
    expect(playingCardOfCode('カード')).toBeNull();
  });

  it('reads the card of an older deck from its picture', () => {
    expect(playingCardOfPicture('./assets/images/trump/c01.webp')).toEqual({ suit: 'clubs', rank: 1 });
    expect(playingCardOfPicture('./assets/images/trump/blank_card.webp')).toBeNull();
    expect(playingCardOfPicture('./front-a.webp')).toBeNull();
  });
});
