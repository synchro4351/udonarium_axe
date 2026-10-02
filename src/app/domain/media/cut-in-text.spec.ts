import {
  CUT_IN_CHARACTER_FALLBACK,
  drawsLetters,
  LETTER_STAGGER_MS,
  letterControlTakesEffect,
  letterFrames,
  letterPoseAt,
  letterRank,
  letterSettingsOf,
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
      const letters = splitLetters('が👨‍👩‍👧\n\nA🇯🇵');

      expect(letters.map((letter) => letter.text)).toEqual(['が', '👨‍👩‍👧', '\n', '\n', 'A', '🇯🇵']);
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

  describe('the detailed letter controls', () => {
    it('reads a missing, unknown or non-finite control as the way letters moved before', () => {
      const defaults = {
        letterOrder: 'forward',
        letterIntervalMs: LETTER_STAGGER_MS,
        letterDurationMs: 260,
        letterTiltMode: 'alternate',
        letterExit: 'none',
        letterExitDurationMs: 260,
        letterDirection: 'up',
      };

      expect(letterSettingsOf()).toEqual(defaults);
      expect(
        letterSettingsOf({
          letterOrder: 'sideways',
          letterIntervalMs: Number.NaN,
          letterDurationMs: Number.POSITIVE_INFINITY,
          letterTiltMode: '',
          letterExit: 'explode',
          letterExitDurationMs: 'soon' as never,
          letterDirection: 'diagonal',
        })
      ).toEqual(defaults);
    });

    it('holds each timing to its range, reading the text a saved file carries as a number', () => {
      expect(letterSettingsOf({ letterIntervalMs: -5, letterDurationMs: 1, letterExitDurationMs: 9000 })).toMatchObject(
        { letterIntervalMs: 0, letterDurationMs: 50, letterExitDurationMs: 3000 }
      );
      expect(letterSettingsOf({ letterIntervalMs: '120' as never }).letterIntervalMs).toBe(120);
    });

    it('says which controls change anything for the motion and the exit', () => {
      const inUse = (letterMotion: string, letterExit = 'none') =>
        (['letterDirection', 'letterDurationMs', 'letterExitDurationMs', 'letterIntervalMs'] as const).filter((key) =>
          letterControlTakesEffect(key, { letterMotion, letterExit })
        );

      expect(inUse('pop')).toEqual(['letterDirection', 'letterDurationMs', 'letterIntervalMs']);
      expect(inUse('slide')).toEqual(['letterDirection', 'letterDurationMs', 'letterIntervalMs']);
      expect(inUse('fade')).toEqual(['letterDurationMs', 'letterIntervalMs']);
      expect(inUse('wave')).toEqual([]);
      expect(inUse('shake')).toEqual([]);
      expect(inUse('none')).toEqual([]);
      expect(inUse('none', 'rise')).toEqual(['letterExitDurationMs', 'letterIntervalMs']);
      expect(inUse('wave', 'explode')).toEqual([]);
      for (const key of ['letterOrder', 'letterTiltMode', 'letterExit'] as const) {
        expect(letterControlTakesEffect(key, { letterMotion: 'none' })).toBe(true);
      }
    });

    it('moves pop, wave and shake exactly as before when no control is set', () => {
      // Half way into the first letter's pop, by the curve it always sprang in on.
      expect(letterPoseAt('pop', 0, 0, 40, 130, 0)).toEqual({
        dx: 0,
        dy: 6,
        rotate: 0,
        scale: expect.closeTo(1.0877, 4),
        opacity: 1,
      });
      expect(letterPoseAt('pop', 4, 6, 40, 700, 100, {}, 9)).toEqual(letterPoseAt('pop', 4, 6, 40, 700, 100));
      expect(letterPoseAt('wave', 3, 0, 40, 450, 0, {}, 8)).toEqual(letterPoseAt('wave', 3, 0, 40, 450, 0));
      expect(letterPoseAt('shake', 3, 0, 40, 450, 0, {}, 8)).toEqual(letterPoseAt('shake', 3, 0, 40, 450, 0));
    });

    it('counts the order from the start, from the end or out from the middle', () => {
      expect([0, 1, 2, 3].map((at) => letterRank(at, 4, 'forward'))).toEqual([0, 1, 2, 3]);
      expect([0, 1, 2, 3].map((at) => letterRank(at, 4, 'reverse'))).toEqual([3, 2, 1, 0]);
      expect([0, 1, 2, 3, 4].map((at) => letterRank(at, 5, 'center'))).toEqual([4, 2, 0, 1, 3]);
      expect([0, 1, 2, 3].map((at) => letterRank(at, 4, 'center'))).toEqual([2, 0, 1, 3]);
    });

    it('counts the letters once the name is in, keeping joined emoji whole across lines', () => {
      const letters = splitLetters(resolveCharacterName('{character}\n👍🏽!', 'アリス')).filter(
        (letter) => !letter.newline
      );
      const settings = { letterOrder: 'reverse', letterIntervalMs: 100, letterDurationMs: 100 };
      const shownAt = (ms: number) =>
        letters
          .filter((letter) => letterPoseAt('fade', letter.index, 0, 40, ms, 0, settings, letters.length).opacity >= 1)
          .map((letter) => letter.text);

      expect(letters.map((letter) => letter.text)).toEqual(['ア', 'リ', 'ス', '👍🏽', '!']);
      expect(shownAt(100)).toEqual(['!']);
      expect(shownAt(200)).toEqual(['👍🏽', '!']);
      expect(shownAt(500)).toEqual(['ア', 'リ', 'ス', '👍🏽', '!']);
    });

    it('brings letters in from the chosen side and leans them all one way when asked', () => {
      const settings = { letterIntervalMs: 0, letterDurationMs: 400, letterTiltMode: 'uniform' };
      const halfWay = (letterDirection: string) =>
        letterPoseAt('slide', 1, 8, 40, 200, 0, { ...settings, letterDirection }, 2);

      expect(halfWay('up')).toMatchObject({ dx: 0, dy: 6, rotate: 8, opacity: 0.5 });
      expect(halfWay('down')).toMatchObject({ dx: 0, dy: -6 });
      expect(halfWay('left')).toMatchObject({ dx: 6, dy: 0 });
      expect(halfWay('right')).toMatchObject({ dx: -6, dy: 0 });
      expect(letterPoseAt('fade', 0, 0, 40, 200, 0, settings, 2)).toMatchObject({ dx: 0, dy: 0, opacity: 0.5 });
      expect(letterTiltOf(0, 8, 'uniform')).toBe(8);
    });

    it('lets the letters leave one after another, the last gone by the time the layer goes', () => {
      const settings = { letterExit: 'fade', letterIntervalMs: 100, letterExitDurationMs: 200 };
      const opacityAt = (index: number, ms: number) =>
        letterPoseAt('none', index, 0, 40, ms, 0, settings, 3, 1000).opacity;

      expect([0, 1, 2].map((index) => opacityAt(index, 600))).toEqual([1, 1, 1]);
      // The first starts leaving at 1000 - 200 - 200, the last at 1000 - 200.
      expect(opacityAt(0, 700)).toBeCloseTo(0.5, 5);
      expect(opacityAt(2, 700)).toBe(1);
      expect([0, 1, 2].map((index) => opacityAt(index, 1000))).toEqual([0, 0, 0]);
      expect(drawsLetters({ letterMotion: 'none', letterTiltDeg: 0, letterExit: 'fade' })).toBe(true);
    });

    it('shortens the gaps so every letter of a short layer is still gone in time', () => {
      const settings = { letterExit: 'rise', letterIntervalMs: 1000, letterExitDurationMs: 3000 };
      for (let at = 0; at < 5; at++) {
        const pose = letterPoseAt('none', at, 0, 40, 1000, 200, settings, 5, 1000);
        expect(pose).toMatchObject({ opacity: 0, dy: -20 });
      }
      expect(letterPoseAt('none', 0, 0, 40, 999, 200, settings, 5, 1000).opacity).toBeGreaterThan(0);
      expect(letterPoseAt('pop', 2, 0, 40, 400, 200, { letterExit: 'shrink' }, 5, 200).opacity).toBe(0);
    });

    it('keeps a brief entrance and exit exact in a long scene', () => {
      const frames = letterFrames(
        'fade',
        2,
        0,
        40,
        500,
        60_000,
        { letterIntervalMs: 100, letterDurationMs: 50, letterExit: 'shrink', letterExitDurationMs: 50 },
        3,
        1500
      );

      expect(frames.length).toBeLessThanOrEqual(360);
      expect(frames.find((frame) => frame.offset === 700 / 60_000)?.opacity).toBe(0);
      expect(frames.find((frame) => frame.offset === 750 / 60_000)?.opacity).toBe(1);
      expect(frames.find((frame) => frame.offset === 1450 / 60_000)?.opacity).toBe(1);
      expect(frames.find((frame) => frame.offset === 1500 / 60_000)?.opacity).toBe(0);
      expect(frames.map((frame) => frame.offset)).toEqual(
        [...frames.map((frame) => frame.offset)].sort((a, b) => a - b)
      );
    });

    it('keeps a short scene to the moments it has', () => {
      const frames = letterFrames('pop', 0, 0, 40, 0, 300, { letterExit: 'fade' }, 2, 300);

      expect(frames[0].offset).toBe(0);
      expect(frames.at(-1)).toMatchObject({ offset: 1, opacity: 0 });
      expect(frames.every((frame) => frame.offset >= 0 && frame.offset <= 1)).toBe(true);
    });

    it('gives a long text fewer frames a letter, so the layer as a whole stays bounded', () => {
      const frames = (count: number) => letterFrames('wave', 0, 0, 40, 0, 60_000, {}, count).length;

      expect(frames(10)).toBeLessThanOrEqual(360);
      expect(frames(1000) * 1000).toBeLessThanOrEqual(40_000);
      expect(frames(1000)).toBeGreaterThanOrEqual(22);
    });
  });
});
