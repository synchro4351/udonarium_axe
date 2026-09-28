import {
  CUT_IN_CHARACTER_FALLBACK,
  drawsLetters,
  LETTER_STAGGER_MS,
  letterFrames,
  letterPoseAt,
  letterTiltOf,
  MAX_LETTER_TILT_DEG,
  resolveCharacterName,
  splitLetters,
  usesCharacterName,
} from '@axe/domain/media/cut-in-text';

describe('cut-in text', () => {
  describe('the character name token', () => {
    it('puts the launched name in for every token and leaves the rest of the text alone', () => {
      expect(resolveCharacterName('{character} 参戦！ {character}', 'アリス')).toBe('アリス 参戦！ アリス');
      expect(resolveCharacterName('{char} {Character} { character } $& \\n', 'アリス')).toBe(
        '{char} {Character} { character } $& \\n'
      );
    });

    it('shows a name as written, even one that looks like a token or a replacement pattern', () => {
      expect(resolveCharacterName('[{character}]', "$&$'{character}")).toBe("[$&$'{character}]");
    });

    it('writes the token itself when it is doubled', () => {
      expect(resolveCharacterName('{{character}} は {character}', 'ボブ')).toBe('{character} は ボブ');
      expect(usesCharacterName('{{character}}')).toBe(true);
    });

    it('shows a stand-in when the launch named nobody', () => {
      expect(resolveCharacterName('{character}参戦！', '')).toBe(`${CUT_IN_CHARACTER_FALLBACK}参戦！`);
      expect(resolveCharacterName('{character}', '   ')).toBe(CUT_IN_CHARACTER_FALLBACK);
      expect(resolveCharacterName('{character}', undefined)).toBe(CUT_IN_CHARACTER_FALLBACK);
    });

    it('says whether a text uses the name at all', () => {
      expect(usesCharacterName('参戦！')).toBe(false);
      expect(usesCharacterName('')).toBe(false);
      expect(usesCharacterName('{character}')).toBe(true);
      // Asked twice in a row, since a global pattern keeps where it last stopped.
      expect(usesCharacterName('x {character}')).toBe(true);
    });
  });

  describe('letters one at a time', () => {
    it('keeps joined emoji and marks whole and every line break where it was written', () => {
      const letters = splitLetters('が👨‍👩‍👧\n\nA🇯🇵');

      expect(letters.map((letter) => letter.text)).toEqual(['が', '👨‍👩‍👧', '\n', '\n', 'A', '🇯🇵']);
      expect(letters.filter((letter) => letter.newline)).toHaveLength(2);
      expect(letters.filter((letter) => !letter.newline).map((letter) => letter.index)).toEqual([0, 1, 2, 3]);
    });

    it('treats a Windows line break as one break', () => {
      expect(splitLetters('a\r\nb').map((letter) => letter.text)).toEqual(['a', '\n', 'b']);
    });

    it('draws letters apart only when they move or lean', () => {
      expect(drawsLetters({ letterMotion: 'none', letterTiltDeg: 0 })).toBe(false);
      expect(drawsLetters({ letterMotion: 'wave', letterTiltDeg: 0 })).toBe(true);
      expect(drawsLetters({ letterMotion: 'none', letterTiltDeg: 5 })).toBe(true);
      expect(drawsLetters({ letterMotion: 'bogus', letterTiltDeg: 0 })).toBe(false);
    });

    it('leans every other letter the other way, never past the limit', () => {
      expect([0, 1, 2].map((index) => letterTiltOf(index, 10))).toEqual([-10, 10, -10]);
      expect(letterTiltOf(1, 90)).toBe(MAX_LETTER_TILT_DEG);
      expect(letterTiltOf(0, Number.NaN)).toBe(0);
    });

    it('pops each letter in after the one before and leaves it upright at rest', () => {
      const first = (ms: number) => letterPoseAt('pop', 0, 0, 40, ms, 500);
      const third = (ms: number) => letterPoseAt('pop', 2, 0, 40, ms, 500);

      expect(first(400).opacity).toBe(0);
      expect(first(560).opacity).toBeGreaterThan(0);
      expect(third(560).opacity).toBe(0);
      expect(third(500 + LETTER_STAGGER_MS * 2 + 400)).toEqual({ dx: 0, dy: 0, rotate: 0, scale: 1, opacity: 1 });
    });

    it('trembles the same way on every screen', () => {
      expect(letterPoseAt('shake', 3, 0, 40, 777, 0)).toEqual(letterPoseAt('shake', 3, 0, 40, 777, 0));
      expect(letterPoseAt('shake', 3, 0, 40, 777, 0)).not.toEqual(letterPoseAt('shake', 4, 0, 40, 777, 0));
    });

    it('writes a letter motion over the whole scene, keeping its lean and a bounded number of frames', () => {
      const frames = letterFrames('wave', 1, 6, 40, 0, 60_000);

      expect(frames[0].offset).toBe(0);
      expect(frames.at(-1)?.offset).toBe(1);
      expect(frames.length).toBeLessThanOrEqual(360);
      expect(frames.every((frame) => frame.transform.includes('rotate(6deg)'))).toBe(true);
      expect(letterFrames('pop', 0, 0, 40, 0, 0)).toEqual([]);
    });
  });
});
