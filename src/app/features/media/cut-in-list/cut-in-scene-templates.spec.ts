import { TestBed } from '@angular/core/testing';
import type { CutIn } from '@axe/domain/media/cut-in';
import { type CutInKey, parseCutInTracks } from '@axe/domain/media/cut-in-keyframe';
import type { CutInLayer } from '@axe/domain/media/cut-in-layer';
import {
  createCutInSceneTemplate,
  CUT_IN_SCENE_TEMPLATES,
  type CutInSceneTemplate,
  textFragments,
} from '@axe/features/media/cut-in-list/cut-in-scene-templates';

function layersOf(cutIn: CutIn, kind: CutInLayer['kind']): CutInLayer[] {
  return cutIn.scene!.layers.filter((layer) => layer.kind === kind);
}

function keysOf(layer: CutInLayer, track: 'x' | 'y' | 'scaleX' | 'rotation' | 'opacity'): CutInKey[] {
  return parseCutInTracks(layer.tracks)[track] ?? [];
}

function withExample<T>(kind: CutInSceneTemplate, title: string, check: (cutIn: CutIn) => T): T {
  const cutIn = createCutInSceneTemplate(kind, title);
  try {
    return check(cutIn);
  } finally {
    cutIn.destroy();
  }
}

describe('cut-in scene examples', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it.each(CUT_IN_SCENE_TEMPLATES)('creates an editable, frameless %s scene with no external media', (kind) => {
    withExample(kind, 'Replace this title', (cutIn) => {
      expect(cutIn.name).toBe('Replace this title');
      expect(cutIn.imageIdentifier).toBe('');
      expect(cutIn.audioIdentifier).toBe('');
      expect(cutIn.frameless).toBe(true);
      expect(cutIn.originalSize).toBe(false);
      expect(cutIn.scene?.layers[0].kind).toBe('fill');
      expect(cutIn.scene?.backgroundColor).toBe('');

      const words = layersOf(cutIn, 'text');
      expect(words.length).toBeGreaterThan(0);
      for (const layer of cutIn.scene!.layers) expect(layer.tracks).not.toBe('');
      if (!kind.endsWith('Compact')) {
        expect(words.map((layer) => layer.text).join(' ')).toBe('Replace this title');
      }
    });
  });

  it.each(CUT_IN_SCENE_TEMPLATES)('keeps the %s example short', (kind) => {
    withExample(kind, kind, (cutIn) => {
      const runningMs = cutIn.scene!.runningMs;
      expect(runningMs).toBe(cutIn.scene!.durationMs);
      expect(runningMs).toBeGreaterThanOrEqual(1000);
      expect(runningMs).toBeLessThanOrEqual(kind === 'ending' ? 4500 : 2600);
    });
  });

  it('varies the canvas, fonts, cutouts and fills between examples', () => {
    const examples = CUT_IN_SCENE_TEMPLATES.map((kind) => createCutInSceneTemplate(kind, 'Title'));
    try {
      const fills = examples.map((example) => example.scene!.layers[0]);
      expect(new Set(fills.map((fill) => fill.clip)).size).toBeGreaterThan(4);
      expect(new Set(fills.map((fill) => fill.fillShape)).size).toBeGreaterThan(3);
      expect(new Set(examples.map((example) => `${example.width}x${example.height}`)).size).toBeGreaterThan(8);
      const fonts = examples.flatMap((example) => layersOf(example, 'text').map((layer) => layer.fontFamily));
      expect(new Set(fonts).size).toBeGreaterThanOrEqual(4);
    } finally {
      for (const example of examples) example.destroy();
    }
  });

  it('moves bands as well as words, by position, scale and rotation', () => {
    const examples = CUT_IN_SCENE_TEMPLATES.map((kind) => createCutInSceneTemplate(kind, 'Title'));
    try {
      const bandTracks = examples.flatMap((example) =>
        layersOf(example, 'fill').flatMap((layer) => Object.keys(parseCutInTracks(layer.tracks)))
      );
      for (const track of ['x', 'y', 'scaleX', 'rotation', 'wipe', 'crumble']) expect(bandTracks).toContain(track);
    } finally {
      for (const example of examples) example.destroy();
    }
  });

  it('lets short titles in a piece at a time', () => {
    withExample('victory', '勝利！', (cutIn) => {
      const letters = layersOf(cutIn, 'text');
      expect(letters.map((layer) => layer.text)).toEqual(['勝', '利', '！']);
      const arrivals = letters.map((layer) => keysOf(layer, 'opacity')[0].t);
      expect(arrivals).toEqual([...arrivals].sort((left, right) => left - right));
      expect(new Set(arrivals).size).toBe(3);
      const lefts = letters.map((layer) => layer.x);
      expect(lefts).toEqual([...lefts].sort((left, right) => left - right));
    });
  });

  it('drops the shock in from above and out below', () => {
    withExample('shock', 'ガーン', (cutIn) => {
      for (const layer of cutIn.scene!.layers.filter((layer) => layer.name !== 'rain')) {
        const ys = keysOf(layer, 'y');
        expect(ys[0].v).toBeLessThan(layer.y);
        expect(ys[ys.length - 1].v).toBeGreaterThan(layer.y);
      }
    });
  });

  it.each(['victory', 'levelUp'] as const)('sends %s off upward rather than down', (kind) => {
    withExample(kind, 'Title', (cutIn) => {
      for (const layer of cutIn.scene!.layers) {
        const ys = keysOf(layer, 'y');
        if (ys.length > 0) expect(ys[ys.length - 1].v).toBeLessThanOrEqual(layer.y);
      }
    });
  });

  it('lets the ending come and go slowly', () => {
    withExample('ending', 'おしまい', (cutIn) => {
      for (const layer of cutIn.scene!.layers) {
        const fades = keysOf(layer, layer.name === 'line' ? 'scaleX' : 'opacity');
        expect(fades[1].t - fades[0].t).toBeGreaterThanOrEqual(1000);
        expect(fades[fades.length - 1].t - fades[fades.length - 2].t).toBeGreaterThanOrEqual(1000);
      }
    });
  });

  it.each([
    ['heart', '❤'],
    ['bouquet', '💐'],
  ] as const)('sets a big %s glyph over its circle, with a smaller circle in the compact one', (kind, glyph) => {
    const ratio = (cutIn: CutIn) => {
      const circle = layersOf(cutIn, 'fill')[0];
      const text = layersOf(cutIn, 'text')[0];
      expect(text.text).toBe(glyph);
      return text.fontSizePx / circle.width;
    };
    const full = withExample(kind, glyph, ratio);
    const compact = withExample(`${kind}Compact`, `${glyph} (small circle)`, ratio);
    expect(full).toBeGreaterThanOrEqual(0.85);
    expect(compact).toBeGreaterThan(1);
  });
});

describe('textFragments', () => {
  it('splits words, and the letters of one short word', () => {
    expect(textFragments('Level UP')).toEqual(['Level', 'UP']);
    expect(textFragments('戦闘開始')).toEqual(['戦', '闘', '開', '始']);
  });

  it('keeps long, single-letter and many-word titles whole', () => {
    expect(textFragments('とてもながいタイトルになりました')).toEqual(['とてもながいタイトルになりました']);
    expect(textFragments('❤')).toEqual(['❤']);
    expect(textFragments('a b c d e')).toEqual(['a b c d e']);
  });

  it('never cuts a joined emoji apart', () => {
    expect(textFragments('👍🏽👍')).toEqual(['👍🏽', '👍']);
    expect(textFragments('👨‍👩‍👧!')).toEqual(['👨‍👩‍👧', '!']);
  });
});
