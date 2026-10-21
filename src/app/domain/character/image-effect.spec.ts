import {
  imageEffectStyle,
  PLAIN_IMAGE_STYLE,
  readImageEffects,
  toggleImageEffect,
  withImageAura,
  writeImageEffects,
} from '@axe/domain/character/image-effect';

describe('the effects laid over a piece picture', () => {
  it('reads the saved words, passing over any it does not know', () => {
    const effects = readImageEffects(' shake flip  aura:red unknown aura:pink ');
    expect([...effects.toggles]).toEqual(['shake', 'flip']);
    expect(effects.aura).toBe('red');
    expect(readImageEffects('')).toEqual({ toggles: new Set(), aura: null });
  });

  it('writes them back in one order, so the same effects always read the same', () => {
    expect(writeImageEffects(readImageEffects('aura:blue shake flip'))).toBe('flip shake aura:blue');
  });

  it('turns one effect on and off, and sets or takes off the aura, keeping the rest', () => {
    expect(toggleImageEffect('flip', 'ghost')).toBe('flip ghost');
    expect(toggleImageEffect('flip ghost', 'flip')).toBe('ghost');
    expect(withImageAura('flip', 'yellow')).toBe('flip aura:yellow');
    expect(withImageAura('flip aura:yellow', null)).toBe('flip');
  });

  it('draws nothing for a picture with no effects', () => {
    expect(imageEffectStyle(readImageEffects(''))).toBe(PLAIN_IMAGE_STYLE);
  });

  it('flips with the scale apart from the transform, and puts the filters together in order', () => {
    expect(imageEffectStyle(readImageEffects('flip silhouette ghost aura:cyan'))).toEqual({
      filter: 'brightness(0) blur(1px) drop-shadow(0 0 3px #33ffff) drop-shadow(0 -4px 4px #33ffff)',
      scale: '-1 1',
      opacity: 0.6,
      animation: null,
    });
  });

  it('runs the flash and the shake together', () => {
    expect(imageEffectStyle(readImageEffects('flash shake')).animation).toBe(
      'imageEffectFlash 1.2s ease-in-out infinite, imageEffectShake 0.5s linear infinite'
    );
  });
});
