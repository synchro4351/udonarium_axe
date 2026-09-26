import { ImageFile } from '@axe/core/storage/image-file';
import type { ImageStorage } from '@axe/core/storage/image-storage';
import { GameObject } from '@axe/core/sync/game-object';
import { ImageTag, SYSTEM_RESERVED_TAG } from '@axe/domain/media/image-tag';
import { StampItem } from '@axe/domain/media/stamp-pack';

/** A pack as the chat and the stamp panel read it, whether the room's own or the tool's. */
export interface StampPackView {
  readonly identifier: string;
  readonly name: string;
  readonly items: readonly StampItem[];
}

/** Tells the tool's own pack apart from the room's, whose identifiers are never this. */
export const BUILTIN_STAMP_PACK_IDENTIFIER = 'builtin-stamps';

/** The phrase first, as it is shown and logged, then the ways it may be typed after a colon. */
const BUILTIN_STAMP_SEEDS: readonly { readonly key: string; readonly words: readonly string[] }[] = [
  { key: 'iine', words: ['いいね！', 'いいね', 'iine', 'good'] },
  { key: 'konnichiwa', words: ['こんにちは', 'konnichiwa', 'hello'] },
  { key: 'matane', words: ['またね', 'matane', 'bye'] },
  { key: 'nante', words: ['なんて？', 'なんて', 'nante', 'what'] },
  { key: 'yoroshiku', words: ['よろしく！', 'よろしく', 'yoroshiku'] },
  { key: 'donmai', words: ['ドンマイ', 'どんまい', 'donmai'] },
  { key: 'shitsumon', words: ['質問です！', '質問', 'しつもん', 'shitsumon', 'question'] },
  { key: 'ikitete-yokatta', words: ['生きててよかった', 'いきててよかった', 'ikitete'] },
  { key: 'sugoi', words: ['すごい！', 'すごい', 'sugoi', 'wow'] },
  { key: 'toutoi', words: ['尊い', 'とうとい', 'toutoi'] },
];

/**
 * Where a stamp's picture is served from, which is also the name it is stored under.
 *
 * A PNG rather than the SVG it is drawn from, whose lettering would take each viewer's own fonts;
 * scripts/rasterize-builtin-stamps.mjs writes it with the bundled font, so every seat sees the same.
 */
function builtinStampUrl(key: string): string {
  return `assets/images/stamps/${key}.png`;
}

/**
 * The stamps the tool comes with, drawn as lettering.
 *
 * They are part of the tool rather than of any room: every seat already holds the same pictures
 * at the same paths, so nothing of them is sent, saved or read back, and a room from before them,
 * or one read in from a file, shows them the same as a new one, never twice.
 */
export const BUILTIN_STAMP_ITEMS: readonly StampItem[] = BUILTIN_STAMP_SEEDS.map((seed) => ({
  id: `builtin-${seed.key}`,
  name: seed.words[0],
  imageIdentifier: builtinStampUrl(seed.key),
  words: seed.words,
}));

/** The tool's own pack, under the name given for it in the reader's language. */
export function builtinStampPack(name: string): StampPackView {
  return { identifier: BUILTIN_STAMP_PACK_IDENTIFIER, name, items: BUILTIN_STAMP_ITEMS };
}

/** Whether a pack is the tool's own, which nobody may change. */
export function isBuiltinStampPack(pack: Pick<StampPackView, 'identifier'>): boolean {
  return pack.identifier === BUILTIN_STAMP_PACK_IDENTIFIER;
}

/**
 * Puts the tool's stamps in the image store, so they are drawn wherever a stamp is.
 *
 * They are tagged as the tool's own, which keeps them out of the media library the way the sample
 * cut-ins' faces are. Called on a fresh store, so every seat files them under the same names; a
 * picture already there, or a tag somebody deleted, is left as it is.
 */
export function registerBuiltinStamps(imageStorage: ImageStorage): void {
  GameObject.batch(() => {
    for (const item of BUILTIN_STAMP_ITEMS) {
      if (!imageStorage.get(item.imageIdentifier)) {
        const context = ImageFile.createEmpty(item.imageIdentifier).toContext();
        context.name = item.name;
        context.url = item.imageIdentifier;
        imageStorage.add(context);
      }
      if (ImageTag.get(item.imageIdentifier)) continue;
      const tag = ImageTag.create(item.imageIdentifier);
      if (ImageTag.get(item.imageIdentifier) === tag) tag.tag = SYSTEM_RESERVED_TAG;
    }
  });
}
