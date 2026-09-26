import { readFileSync } from 'node:fs';

import { TestBed } from '@angular/core/testing';
import type { CutIn } from '@axe/domain/media/cut-in';
import { clipPoints } from '@axe/domain/media/cut-in-clip';
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

const LANGUAGES = ['ja', 'en', 'ko'] as const;
const MORE_TITLES = ['WWWWW', 'SAN 체크', 'Level UP', '成功！'];

function titleIn(language: string, kind: CutInSceneTemplate): string {
  const tree = JSON.parse(readFileSync(`src/assets/i18n/${language}.json`, 'utf-8'));
  return tree.feature.media.cutIn[`sceneTemplate_${kind}`];
}

/** A cautious guess at how wide the letters run, in ems: a full em for CJK, 0.6 for anything else. */
function roughEm(text: string): number {
  let width = 0;
  for (const letter of text) width += (letter.codePointAt(0) ?? 0) >= 0x2e80 ? 1 : 0.6;
  return width;
}

function lastOf<T>(items: readonly T[]): T {
  return items[items.length - 1];
}

function centerOf(layers: readonly CutInLayer[]): { x: number; y: number } {
  const left = Math.min(...layers.map((layer) => layer.x));
  const right = Math.max(...layers.map((layer) => layer.x + layer.width));
  const top = Math.min(...layers.map((layer) => layer.y));
  const bottom = Math.max(...layers.map((layer) => layer.y + layer.height));
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
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
      expect(words.map((layer) => layer.text).join(' ')).toBe('Replace this title');
    });
  });

  it('offers one bouquet and one heart', () => {
    expect(CUT_IN_SCENE_TEMPLATES.filter((kind) => /bouquet|heart/i.test(kind))).toEqual(['bouquet', 'heart']);
  });

  it.each(CUT_IN_SCENE_TEMPLATES)('gives every piece of the %s lettering room to stay on one line', (kind) => {
    const glyph = kind === 'bouquet' || kind === 'heart';
    // The title each language gives the example, and for the lettered ones a few wide or spaced ones too.
    const titles = [...LANGUAGES.map((language) => titleIn(language, kind)), ...(glyph ? [] : MORE_TITLES)];
    for (const title of titles) {
      withExample(kind, title, (cutIn) => {
        const words = layersOf(cutIn, 'text');
        for (const layer of words) {
          // A piece with no space in it has nowhere to break but between letters that run wider than its box.
          if (words.length > 1) expect(layer.text).not.toMatch(/\s/);
          expect(layer.width, `${kind} ${title} ${layer.text}`).toBeGreaterThanOrEqual(
            layer.fontSizePx * (roughEm(layer.text) + 0.3)
          );
          expect(layer.height).toBeGreaterThanOrEqual(layer.fontSizePx);
        }
      });
    }
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

  it('drops the shock in from above and out below, rain and all', () => {
    withExample('shock', 'ガーン', (cutIn) => {
      for (const layer of cutIn.scene!.layers) {
        const ys = keysOf(layer, 'y');
        expect(ys[0].v).toBeLessThan(layer.y);
        expect(ys[ys.length - 1].v).toBeGreaterThan(layer.y);
      }
    });
  });

  it('spreads the shock rain across the whole stage', () => {
    withExample('shock', 'ガーン', (cutIn) => {
      const rain = cutIn.scene!.layers.filter((layer) => layer.name === 'rain');
      expect(rain.length).toBeGreaterThanOrEqual(5);
      expect(Math.min(...rain.map((layer) => layer.x))).toBeLessThan(cutIn.width * 0.15);
      expect(Math.max(...rain.map((layer) => layer.x + layer.width))).toBeGreaterThan(cutIn.width * 0.85);
      // Each streak starts wholly above the stage and ends wholly below it.
      for (const layer of rain) {
        const ys = keysOf(layer, 'y');
        expect(ys[0].v + layer.height).toBeLessThanOrEqual(0);
        expect(ys[ys.length - 1].v).toBeGreaterThanOrEqual(cutIn.height);
      }
    });
  });

  it('sets the success lettering on the middle of its band', () => {
    withExample('success', '成功！', (cutIn) => {
      const [base] = layersOf(cutIn, 'fill');
      const words = centerOf(layersOf(cutIn, 'text'));
      expect(Math.abs(words.x - (base.x + base.width / 2))).toBeLessThanOrEqual(2);
      expect(Math.abs(words.y - (base.y + base.height / 2))).toBeLessThanOrEqual(2);
    });
  });

  it('runs the success glint only where the band is', () => {
    withExample('success', '成功！', (cutIn) => {
      const [base, glint] = layersOf(cutIn, 'fill');
      expect(glint.name).toBe('glint');
      expect([glint.x, glint.y, glint.width, glint.height]).toEqual([base.x, base.y, base.width, base.height]);
      expect(glint.clip).toBe(base.clip);
      expect(parseCutInTracks(glint.tracks).x).toBeUndefined();

      // A strip with its leading edge let in ahead of its trailing edge being taken away.
      const tracks = parseCutInTracks(glint.tracks);
      expect(glint.wipeShape).toBe('right');
      expect(glint.crumbleShape).toBe('left');
      expect(tracks.wipe?.map((key) => key.v)).toEqual([0, 1]);
      expect(tracks.crumble?.map((key) => key.v)).toEqual([1, 0]);
      expect(tracks.crumble![0].t).toBeGreaterThan(tracks.wipe![0].t);
      // It sweeps after the band has opened out and is gone before the band leaves.
      expect(tracks.wipe![0].t).toBeGreaterThanOrEqual(lastOf(keysOf(base, 'scaleX')).t);
      expect(lastOf(tracks.crumble!).t).toBeLessThanOrEqual(keysOf(base, 'opacity')[0].t);
    });
  });

  it('lays three stars over the victory ribbon, rolling in from the left in turn', () => {
    withExample('victory', '勝利！', (cutIn) => {
      const layers = cutIn.scene!.layers;
      const ribbon = layers[0];
      expect(ribbon.name).toBe('ribbon');
      const stars = layers.filter((layer) => layer.name === 'star');
      expect(stars).toHaveLength(3);
      expect(layers.indexOf(stars[0])).toBeGreaterThan(0);

      const arrivals = stars.map((star) => keysOf(star, 'opacity')[0].t);
      expect(arrivals).toEqual([...arrivals].sort((left, right) => left - right));
      expect(new Set(arrivals).size).toBe(3);
      for (const star of stars) {
        expect(star.x).toBeGreaterThanOrEqual(ribbon.x - star.width / 2);
        expect(star.x + star.width).toBeLessThanOrEqual(ribbon.x + ribbon.width + star.width / 2);
        expect(star.y).toBeLessThan(ribbon.y);
        expect(star.y + star.height).toBeGreaterThan(ribbon.y + ribbon.height);
        expect(keysOf(star, 'x')[0].v).toBeLessThan(star.x);
        expect(keysOf(star, 'rotation')[0].v).not.toBe(star.rotation);
      }
      const lefts = stars.map((star) => star.x);
      expect(lefts).toEqual([...lefts].sort((left, right) => left - right));
    });
  });

  it('uses only outlines and wipes that copies of the app without the newest ones can draw', () => {
    // As the app knew them before these examples changed; a peer that meets a name it does not
    // know cannot draw the layer.
    const known = ['none', 'slant', 'slantBack', 'torn', 'tornLeft', 'gash', 'burst', 'star', 'chevron', 'circle'];
    const wipes = ['none', 'right', 'left', 'down', 'up', 'chevronRight', 'chevronLeft', 'crumbleRight', 'crumbleLeft'];
    for (const kind of CUT_IN_SCENE_TEMPLATES) {
      withExample(kind, 'Title', (cutIn) => {
        for (const layer of cutIn.scene!.layers) {
          expect(known, `${kind} ${layer.name}`).toContain(layer.clip);
          expect(wipes, `${kind} ${layer.name}`).toContain(layer.wipeShape);
          expect(wipes, `${kind} ${layer.name}`).toContain(layer.crumbleShape);
        }
      });
    }
  });

  it('points the level up arrow upward, with the words in its shaft', () => {
    withExample('levelUp', 'Level UP', (cutIn) => {
      const head = cutIn.scene!.layers.find((layer) => layer.name === 'head')!;
      const shaft = cutIn.scene!.layers.find((layer) => layer.name === 'band')!;
      const layers = cutIn.scene!.layers;
      expect(layers.indexOf(head)).toBeGreaterThan(layers.indexOf(shaft));

      // The head is the pointed end of a chevron turned to face up, let in only to its shoulders.
      const shoulder = Math.max(...clipPoints('chevron').map(([x, y]) => (y === 0 ? x : 0)));
      expect(head.clip).toBe('chevron');
      expect(head.rotation).toBe(-90);
      expect(head.wipeShape).toBe('left');
      expect(head.wipe).toBeCloseTo(1 - shoulder, 5);

      // Turned about its middle, the chevron's point is at the top and its shoulders below it.
      const middleX = head.x + head.width / 2;
      const middleY = head.y + head.height / 2;
      const tipY = middleY - head.width / 2;
      const baseY = middleY - (shoulder - 0.5) * head.width;
      const baseHalf = head.height / 2;
      expect(tipY).toBeGreaterThanOrEqual(0);
      expect(baseY - tipY).toBeGreaterThan(baseHalf * 0.5);
      expect(Math.abs(middleX - cutIn.width / 2)).toBeLessThanOrEqual(1);

      // A plain shaft, narrower than the head, runs down from its base with no gap.
      expect(shaft.clip).toBe('none');
      expect(shaft.rotation).toBe(0);
      expect(Math.abs(shaft.x + shaft.width / 2 - middleX)).toBeLessThanOrEqual(1);
      expect(shaft.width).toBeLessThan(baseHalf * 2 * 0.9);
      expect(shaft.y).toBeLessThanOrEqual(baseY);
      expect(shaft.y).toBeGreaterThan(baseY - 6);
      expect(shaft.y + shaft.height).toBeLessThanOrEqual(cutIn.height);

      const words = layersOf(cutIn, 'text');
      const first = words[0];
      const last = words[words.length - 1];
      // The words' own letters, not the room around them, sit between the sides of the shaft.
      const room = (first.width - first.fontSizePx * 0.5) / 2;
      expect(first.x + room).toBeGreaterThanOrEqual(shaft.x);
      expect(last.x + last.width - room).toBeLessThanOrEqual(shaft.x + shaft.width);
      for (const word of words) {
        expect(word.y).toBeGreaterThanOrEqual(baseY);
        expect(word.y + word.height).toBeLessThanOrEqual(shaft.y + shaft.height);
      }
    });
  });

  it('moves the level up head and shaft as one', () => {
    withExample('levelUp', 'Level UP', (cutIn) => {
      const head = cutIn.scene!.layers.find((layer) => layer.name === 'head')!;
      const shaft = cutIn.scene!.layers.find((layer) => layer.name === 'band')!;
      const moves = (layer: CutInLayer) =>
        (['y', 'opacity'] as const).map((track) =>
          keysOf(layer, track).map((key) => [key.t, track === 'y' ? key.v - layer.y : key.v])
        );
      expect(moves(head)).toEqual(moves(shaft));
    });
  });

  it('flashes the rebuttal above and below its band, crossing each other', () => {
    withExample('rebuttal', '論破', (cutIn) => {
      const slash = cutIn.scene!.layers.find((layer) => layer.name === 'band')!;
      const flashes = cutIn.scene!.layers.filter((layer) => layer.name === 'flash');
      expect(flashes).toHaveLength(2);
      const [top, bottom] = [...flashes].sort((left, right) => left.y - right.y);
      expect(top.y + top.height).toBeLessThanOrEqual(slash.y);
      expect(bottom.y).toBeGreaterThanOrEqual(slash.y + slash.height);
      expect(Math.sign(keysOf(top, 'x')[0].v - top.x)).toBe(-Math.sign(keysOf(bottom, 'x')[0].v - bottom.x));
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

  it('sets a large bouquet over a large circle, and a small heart over a smaller circle', () => {
    const look = (kind: CutInSceneTemplate, glyph: string) =>
      withExample(kind, glyph, (cutIn) => {
        const circle = layersOf(cutIn, 'fill')[0];
        const text = layersOf(cutIn, 'text')[0];
        expect(text.text).toBe(glyph);
        return { circle: circle.width, glyph: text.fontSizePx };
      });
    const bouquet = look('bouquet', '💐');
    const heart = look('heart', '❤');

    expect(bouquet.glyph / bouquet.circle).toBeGreaterThanOrEqual(0.85);
    expect(heart.glyph / heart.circle).toBeGreaterThan(1);
    expect(heart.circle).toBeLessThan(bouquet.circle * 0.6);
    expect(heart.glyph).toBeLessThan(bouquet.glyph);
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
