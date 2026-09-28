import { EffectCast } from '@axe/domain/effect/effect-cast';
import { type ReactionKind } from '@axe/domain/effect/effect-kind';
import { EffectPreset, MAX_REACTION_DURATION_MS, reactionLabelOf } from '@axe/domain/effect/effect-preset';
import { effectSprites, impactSoundTimes } from '@axe/domain/effect/effect-timeline';
import { REACTION_FALLBACK_TEXT, reactionMarkOf } from '@axe/domain/effect/timeline/reaction';

describe('the light reactions', () => {
  const base = 50;

  function makePreset(kind: ReactionKind, text = '👍'): EffectPreset {
    const preset = new EffectPreset('reaction');
    preset.kind = kind;
    preset.durationMs = 1000;
    preset.staggerMs = 0;
    preset.reactionText = text;
    return preset;
  }

  function makeCast(origin: EffectCast['origin'] = null, targetCount = 1): EffectCast {
    return {
      presetIdentifier: 'reaction',
      casterIdentifier: '',
      origin,
      seed: 11,
      targets: Array.from({ length: targetCount }, (_unused, index) => ({
        identifier: `char${index}`,
        x: 400 + index * 100,
        y: 300,
        z: 0,
      })),
    };
  }

  describe('what they show', () => {
    it('shows the text that was written', () => {
      expect(reactionMarkOf(makePreset('reactpop', 'ナイス！'), { baseSize: base })).toEqual({
        image: '',
        text: 'ナイス！',
      });
    });

    it('shows the picture in place of the text where the room has it', () => {
      const preset = makePreset('reactpop', '👍');
      preset.reactionImageIdentifier = 'face';

      const mark = reactionMarkOf(preset, {
        baseSize: base,
        resolveImageFile: (identifier) => (identifier === 'face' ? 'blob:face' : ''),
      });

      expect(mark).toEqual({ image: 'blob:face', text: '' });
    });

    it('falls back to the text when the picture is not in the room', () => {
      const preset = makePreset('reactpop', '👍');
      preset.reactionImageIdentifier = 'gone';

      expect(reactionMarkOf(preset, { baseSize: base, resolveImageFile: () => '' })).toEqual({
        image: '',
        text: '👍',
      });
    });

    it('shows a question mark rather than nothing when there is neither', () => {
      const preset = makePreset('reactpop', '   ');
      preset.reactionImageIdentifier = 'gone';

      expect(reactionMarkOf(preset, { baseSize: base }).text).toBe(REACTION_FALLBACK_TEXT);
    });

    it('cuts a long text short, counting a joined emoji as one character', () => {
      expect(reactionLabelOf('  ナイス\n  ファイト  ')).toBe('ナイス ファイト');
      expect(reactionLabelOf('あ'.repeat(40))).toBe('あ'.repeat(12));
      const family = '👨‍👩‍👧';
      expect(reactionLabelOf(family.repeat(12))).toBe(family.repeat(12));
    });

    it('writes the mark on the sprite in the preset colour', () => {
      const preset = makePreset('reactpop', 'GG');
      preset.colorPrimary = '#123456';

      const [sprite] = effectSprites(preset, makeCast(), 300, { baseSize: base });

      expect(sprite.text).toBe('GG');
      expect(sprite.textColor).toBe('#123456');
      expect(sprite.flat).toBe(false);
    });

    it('fits a picture into the sprite and writes no text over it', () => {
      const preset = makePreset('reactrain');
      preset.reactionImageIdentifier = 'face';

      const sprites = effectSprites(preset, makeCast(), 600, { baseSize: base, resolveImageFile: () => 'blob:face' });

      expect(sprites.length).toBeGreaterThan(0);
      for (const sprite of sprites) {
        expect(sprite.background).toBe('url("blob:face") center/contain no-repeat');
        expect(sprite.text).toBeUndefined();
      }
    });
  });

  describe('how long they last', () => {
    it('holds a reaction to three seconds, however long it was written', () => {
      const preset = makePreset('reactpop');
      preset.durationMs = 6000;

      expect(preset.isReaction).toBe(true);
      expect(preset.duration).toBe(MAX_REACTION_DURATION_MS);
    });

    it('leaves the other effects their full length', () => {
      const preset = new EffectPreset('other');
      preset.kind = 'flame';
      preset.durationMs = 6000;

      expect(preset.isReaction).toBe(false);
      expect(preset.duration).toBe(6000);
    });

    it('draws nothing once it is over', () => {
      expect(effectSprites(makePreset('reactthrow'), makeCast(), 1001, { baseSize: base })).toHaveLength(0);
    });
  });

  describe('popping up', () => {
    it('rises over the target and fades out', () => {
      const preset = makePreset('reactpop');
      const early = effectSprites(preset, makeCast(), 300, { baseSize: base });
      const late = effectSprites(preset, makeCast(), 950, { baseSize: base });

      expect(early).toHaveLength(1);
      expect(early[0]).toMatchObject({ x: 400, y: 300 });
      expect(late[0].z).toBeGreaterThan(early[0].z);
      expect(late[0].opacity).toBeLessThan(early[0].opacity);
    });
  });

  describe('throwing', () => {
    it('leaves the caster and lands on the target', () => {
      const preset = makePreset('reactthrow');
      const cast = makeCast({ x: 0, y: 0, z: 0 });
      const mark = (elapsed: number) =>
        effectSprites(preset, cast, elapsed, { baseSize: base }).find((sprite) => sprite.key === '0-reactthrow')!;

      expect(mark(1).x).toBeLessThan(20);
      expect(mark(1).y).toBeLessThan(20);
      expect(mark(700)).toMatchObject({ x: 400, y: 300 });
    });

    it('marks the spot where it lands on the ground', () => {
      const sprites = effectSprites(makePreset('reactthrow'), makeCast({ x: 0, y: 0, z: 0 }), 500, {
        baseSize: base,
      });

      expect(sprites.some((sprite) => sprite.key === '0-reactthrow-ring' && sprite.flat)).toBe(true);
    });

    it('sounds the landing as it hits rather than halfway through', () => {
      const preset = makePreset('reactthrow');
      preset.impactSoundIdentifier = 'se-hit';

      expect(impactSoundTimes(preset)).toEqual([450]);
    });
  });

  describe('raining down', () => {
    it('drops a few marks about the target, more at a higher grade but never many', () => {
      const count = (grade: number) => {
        const preset = makePreset('reactrain');
        preset.grade = grade;
        return effectSprites(preset, makeCast(), 800, { baseSize: base }).length;
      };

      expect(count(1)).toBeLessThan(count(3));
      expect(count(3)).toBeLessThanOrEqual(12);
    });

    it('keeps them close to the target and has every one down by the end', () => {
      const sprites = effectSprites(makePreset('reactrain'), makeCast(), 820, { baseSize: base });

      for (const sprite of sprites) {
        expect(Math.abs(sprite.x - 400)).toBeLessThanOrEqual(base * 1.2);
        expect(Math.abs(sprite.y - 300)).toBeLessThanOrEqual(base * 1.2);
        expect(sprite.z).toBeLessThan(base);
      }
    });

    it('falls the same way on every screen for the same cast', () => {
      const preset = makePreset('reactrain');

      expect(effectSprites(preset, makeCast(), 400, { baseSize: base })).toEqual(
        effectSprites(preset, makeCast(), 400, { baseSize: base })
      );
    });
  });
});
