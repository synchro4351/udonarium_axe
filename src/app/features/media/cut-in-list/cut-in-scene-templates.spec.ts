import { TestBed } from '@angular/core/testing';
import {
  createCutInSceneTemplate,
  CUT_IN_SCENE_TEMPLATES,
} from '@axe/features/media/cut-in-list/cut-in-scene-templates';

describe('cut-in scene examples', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it.each(CUT_IN_SCENE_TEMPLATES)('creates an editable %s scene with no external media', (kind) => {
    const cutIn = createCutInSceneTemplate(kind, 'Replace this title');
    try {
      expect(cutIn.name).toBe('Replace this title');
      expect(cutIn.imageIdentifier).toBe('');
      expect(cutIn.audioIdentifier).toBe('');
      expect(cutIn.scene?.layers.map((layer) => layer.kind)).toEqual(['fill', 'text']);
      expect(cutIn.scene?.layers[1].text).toBe('Replace this title');
      expect(cutIn.scene?.layers[1].tracks).not.toBe('');
      expect(cutIn.scene?.backgroundColor).toBe('');
      expect(cutIn.scene?.durationMs).toBeGreaterThanOrEqual(1000);
      expect(cutIn.scene?.durationMs).toBeLessThanOrEqual(3000);
    } finally {
      cutIn.destroy();
    }
  });

  it('offers visibly different cutout and fill patterns', () => {
    const examples = CUT_IN_SCENE_TEMPLATES.map((kind) => createCutInSceneTemplate(kind, kind));
    try {
      const fills = examples.map((example) => example.scene!.layers[0]);
      expect(new Set(fills.map((fill) => fill.clip)).size).toBeGreaterThan(4);
      expect(new Set(fills.map((fill) => fill.fillShape)).size).toBeGreaterThan(3);
    } finally {
      for (const example of examples) example.destroy();
    }
  });
});
