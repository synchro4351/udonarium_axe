import { Injectable, signal } from '@angular/core';
import { ImageFile } from '@axe/core/storage/image-file';
import { readLocal, writeLocal } from '@axe/core/storage/local-preference';
import { STORAGE_KEYS } from '@axe/core/storage/storage-keys';

/**
 * The longest side a large added picture is scaled down to. Wide enough for a battle map shown
 * across a table, small enough that a phone photo or an 8K scan stops costing every peer megabytes.
 */
export const UPLOAD_MAX_SIDE = 2560;

/**
 * Whether pictures chosen to upload open in the image editor before they are added.
 *
 * Kept in this browser rather than in the room, since it is a way of working: one player crops
 * every portrait, another adds a folder of maps as they are. Left off, pictures go straight in as
 * they always have, and only one over the size limit opens in the editor to be made to fit.
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadPreferenceService {
  private readonly stored = signal(storedEditFirst());

  /** Whether every picture chosen opens in the editor first. */
  readonly editFirst = this.stored.asReadonly();

  private readonly storedShrink = signal(storedShrinkLarge());

  /**
   * Whether pictures added from this browser are scaled down past {@link UPLOAD_MAX_SIDE}. On
   * unless turned off: the uploader shrinks the picture once, before it is hashed and shared, so
   * every peer receives the same smaller file. Pictures already in a room are never touched.
   */
  readonly shrinkLarge = this.storedShrink.asReadonly();

  /** Hands the stored choice to the image store, once at startup. */
  initialize(): void {
    ImageFile.uploadMaxSide = this.storedShrink() ? UPLOAD_MAX_SIDE : 0;
  }

  /** Sets whether large pictures added from here are scaled down, and writes it down. */
  setShrinkLarge(shrinkLarge: boolean): void {
    this.storedShrink.set(shrinkLarge);
    ImageFile.uploadMaxSide = shrinkLarge ? UPLOAD_MAX_SIDE : 0;
    // Private browsing refuses the write; the choice still holds for this session.
    writeLocal(STORAGE_KEYS.imageShrinkLarge, shrinkLarge ? 'true' : 'false');
  }

  /** Sets whether every picture chosen opens in the editor first, and writes it down. */
  setEditFirst(editFirst: boolean): void {
    this.stored.set(editFirst);
    writeLocal(STORAGE_KEYS.imageEditFirst, editFirst ? 'true' : 'false');
  }
}

function storedEditFirst(): boolean {
  return readLocal(STORAGE_KEYS.imageEditFirst) === 'true';
}

function storedShrinkLarge(): boolean {
  return readLocal(STORAGE_KEYS.imageShrinkLarge) !== 'false';
}
