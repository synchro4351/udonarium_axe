/*
 * The bundled deck of playing cards (tyoitashi). Its cards all go by one name, so each also keeps
 * which card it is as a short code in its details, such as `s1`, `h13` or `joker`: a room server
 * keeps a card's details from whoever may not see its face, so the code goes only where the face
 * does. Shown to people only in the card's details; read by the AI's card tools.
 */

/** The name of the detail a bundled playing card keeps its code under. */
export const PLAYING_CARD_DETAIL = 'playing_card';

/** A bundled playing card: a suit and a rank from 1 (ace) to 13 (king), or a joker. */
export type PlayingCard =
  { readonly suit: 'clubs' | 'diamonds' | 'hearts' | 'spades'; readonly rank: number } | { readonly joker: true };

const SUITS = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' } as const;

/** The code kept with a card of the bundled deck, from the code its picture is filed under (`c01` is `c1`, `x01` a joker). */
export function playingCardCodeOf(pictureCode: string): string {
  const match = /^([cdhsx])(\d{2})$/.exec(pictureCode);
  if (!match) return '';
  return match[1] === 'x' ? 'joker' : `${match[1]}${Number(match[2])}`;
}

/** The playing card a kept code names, or null for anything else. */
export function playingCardOfCode(code: string): PlayingCard | null {
  if (code === 'joker') return { joker: true };
  const match = /^([cdhs])(\d{1,2})$/.exec(code);
  if (!match) return null;
  const rank = Number(match[2]);
  return rank >= 1 && rank <= 13 ? { suit: SUITS[match[1] as keyof typeof SUITS], rank } : null;
}

/**
 * The playing card a front picture of the bundled deck shows, for a deck made before its cards kept
 * their codes (`trump/c01.webp` is the ace of clubs).
 */
export function playingCardOfPicture(front: string): PlayingCard | null {
  const match = /\/trump\/([cdhsx]\d{2})\.\w+$/.exec(front);
  return match ? playingCardOfCode(playingCardCodeOf(match[1])) : null;
}
