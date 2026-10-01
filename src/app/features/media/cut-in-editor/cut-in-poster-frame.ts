import type { CutInLayer } from '@axe/domain/media/cut-in-layer';
import type { CutInScene } from '@axe/domain/media/cut-in-scene';
import { sampleLayerAt, sceneDurationOf } from '@axe/domain/media/cut-in-scene-timeline';
import { letterPoseAt, resolveCharacterName, splitLetters } from '@axe/domain/media/cut-in-text';

/** How finely the scene is looked over for the moment it shows the most of itself. */
const STEP_MS = 50;
/** A moment this close to the fullest counts as full, so an overshoot that settles later does not win. */
const NEARLY_FULL = 0.98;

/**
 * The first moment a scene shows close to the most of itself.
 *
 * A scene made from a template opens on an empty stage at nought, since everything in it is still
 * to come in. This is where to put the playhead instead, so the first look is at the picture the
 * template makes. A moment while letters are still popping in is passed over where a later one is
 * as full, since a word with half its letters showing does not read. A scene with nothing to show
 * answers nought.
 */
export function posterFrameMs(scene: CutInScene | null): number {
  const durationMs = sceneDurationOf(scene);
  const layers = scene?.layers.filter((layer) => !layer.hidden) ?? [];
  if (durationMs < 1 || layers.length < 1) return 0;

  const momentAt = (ms: number) =>
    layers.reduce(
      (moment, layer) => {
        const sample = sampleLayerAt(layer, ms, durationMs);
        if (!sample.visible) return moment;
        const scale = Math.min(1, Math.abs(sample.scaleX)) * Math.min(1, Math.abs(sample.scaleY));
        const letters = lettersInAt(layer, ms);
        moment.shown += unit(sample.opacity) * unit(sample.wipe) * unit(sample.crumble) * scale * letters;
        moment.popping ||= letters < 1;
        return moment;
      },
      { ms, shown: 0, popping: false }
    );

  const moments: { ms: number; shown: number; popping: boolean }[] = [];
  for (let ms = 0; ms < durationMs; ms += STEP_MS) moments.push(momentAt(ms));
  const fullest = Math.max(...moments.map((moment) => moment.shown));
  if (fullest <= 0) return 0;
  const isFull = (moment: { shown: number }) => moment.shown >= fullest * NEARLY_FULL;
  return (moments.find((moment) => isFull(moment) && !moment.popping) ?? moments.find(isFull))!.ms;
}

/**
 * How much of a text layer's letters have finished coming in, from 0 to 1. Anything whose letters
 * do not pop in counts as wholly in.
 *
 * The name of whoever plays it is not known yet, so the token counts as the stand-in it shows
 * for nobody.
 */
function lettersInAt(layer: CutInLayer, ms: number): number {
  if (layer.kind !== 'text' || layer.letterMotion !== 'pop') return 1;
  const letters = splitLetters(resolveCharacterName(layer.text, '')).filter((letter) => !letter.newline);
  if (letters.length < 1) return 1;
  // A popping letter rises into place as it comes in, so one with no rise left has finished.
  const settled = letters.filter((letter) => {
    const pose = letterPoseAt('pop', letter.index, 0, 1, ms, layer.startMs);
    return pose.opacity >= 1 && pose.dy === 0;
  });
  return settled.length / letters.length;
}

function unit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
