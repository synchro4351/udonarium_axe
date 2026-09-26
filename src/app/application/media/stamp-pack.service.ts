import { inject, Injectable } from '@angular/core';
import { SaveDataService } from '@axe/application/file/save-data.service';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { isAnimatedImageBytes } from '@axe/core/storage/animated-image';
import { FileArchiver } from '@axe/core/storage/file-archiver';
import * as FileReaderUtil from '@axe/core/storage/file-reader-util';
import { downscaleImageBlob } from '@axe/core/storage/image-downscale';
import { ImageState } from '@axe/core/storage/image-file';
import { looksLikeImage } from '@axe/core/storage/image-sniff';
import { ImageStorage } from '@axe/core/storage/image-storage';
import * as MimeType from '@axe/core/storage/mime-type';
import type { ZipEntry } from '@axe/core/storage/zip-archive-message';
import { ObjectStore } from '@axe/core/sync/object-store';
import { generateUuid } from '@axe/core/util/uuid';
import { xml2element } from '@axe/core/util/xml-util';
import {
  normalizeStampName,
  normalizeStampWords,
  parseStampItemsStrict,
  STAMP_LIMITS,
  StampItem,
  StampPack,
} from '@axe/domain/media/stamp-pack';

/** Why a picture was not taken in as a stamp. */
export type StampImageProblem = 'notImage' | 'animated' | 'tooLarge';

/** Why a change to the packs was not made. */
export type StampEditProblem = 'forbidden' | 'packLimit' | 'stampLimit' | StampImageProblem;

/** Why a pack file was turned away. */
export type StampArchiveProblem = 'notArchive' | 'malformed' | 'tooManyStamps' | 'missingImage' | 'badImage';

/** A pack file read and checked, ready to be brought into the room. */
export interface StampPackArchive {
  readonly identifier: string;
  readonly name: string;
  readonly items: readonly StampItem[];
  /** The pictures the file holds that this seat does not, by identifier. */
  readonly images: ReadonlyMap<string, File>;
}

/** The pack file a pack is written into: its XML, as any saved object is. */
const PACK_XML = 'data.xml';

/** A picture is taken in only this large before it is shrunk; anything larger is surely a mistake. */
const SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;

/** A pack file larger than every stamp at its largest is not a pack file. */
const ARCHIVE_BYTES = STAMP_LIMITS.stampsPerPack * STAMP_LIMITS.imageBytes + 1024 * 1024;

const SAVED_IMAGE_NAME = /^([0-9a-f]{64})\.[a-z0-9]+$/;

/** Whether a problem is one of those a change can meet, for telling results apart from packs. */
export function isStampProblem<T>(result: T | string): result is string {
  return typeof result === 'string';
}

/**
 * The room's stamp packs: making, changing and throwing them away, and carrying them in and out
 * as files.
 *
 * A pack is shared with the whole room, so only a seat that may change the table may change a
 * pack, the same as for cut-ins. The pictures go through the image store, and so reach the
 * others and a saved room the way every other picture does.
 */
@Injectable({ providedIn: 'root' })
export class StampPackService {
  private readonly objectStore = inject(ObjectStore);
  private readonly imageStorage = inject(ImageStorage);
  private readonly fileArchiver = inject(FileArchiver);
  private readonly saveDataService = inject(SaveDataService);
  private readonly rolePermission = inject(RolePermissionService);

  /** Every pack in the room, in the order they were made. */
  packs(): StampPack[] {
    return this.objectStore.getObjects(StampPack);
  }

  /** Whether this seat may make, change and throw away packs. */
  get canEdit(): boolean {
    return this.rolePermission.canEditTabletop;
  }

  /** Makes an empty pack under the name given. */
  createPack(name: string): StampPack | StampEditProblem {
    if (!this.canEdit) return 'forbidden';
    if (this.packs().length >= STAMP_LIMITS.packsPerRoom) return 'packLimit';
    const pack = new StampPack();
    pack.name = normalizeStampName(name);
    pack.initialize();
    return pack;
  }

  /** Renames a pack, keeping the old name where the new one is blank. */
  renamePack(pack: StampPack, name: string): StampEditProblem | null {
    if (!this.canEdit) return 'forbidden';
    const normalized = normalizeStampName(name);
    if (normalized.length > 0 && normalized !== pack.name) pack.name = normalized;
    return null;
  }

  /** Throws a pack away for everyone. Its pictures stay in the image store, where others may use them. */
  deletePack(pack: StampPack): StampEditProblem | null {
    if (!this.canEdit) return 'forbidden';
    pack.destroy();
    return null;
  }

  /**
   * Adds a picture to a pack as a new stamp, named after its file.
   *
   * Only still pictures are taken. They are shrunk to fit the largest side a stamp may have, and
   * turned away if even then they are larger than a stamp may be.
   */
  async addStamp(pack: StampPack, file: File): Promise<StampItem | StampEditProblem> {
    if (!this.canEdit) return 'forbidden';
    if (pack.items.length >= STAMP_LIMITS.stampsPerPack) return 'stampLimit';
    const prepared = await this.prepareImage(file);
    if (isStampProblem(prepared)) return prepared;
    const image = await this.imageStorage.addAsync(prepared);
    // Read again after the wait, since someone else may have filled the pack meanwhile.
    if (pack.items.length >= STAMP_LIMITS.stampsPerPack) return 'stampLimit';
    const name = normalizeStampName(file.name.replace(/\.[^.]*$/, '')) || normalizeStampName(file.name);
    const item: StampItem = { id: generateUuid(), name, imageIdentifier: image.identifier, words: [] };
    pack.setItems([...pack.items, item]);
    return item;
  }

  /** Changes a stamp's name and search words. A blank name keeps the old one. */
  updateStamp(pack: StampPack, id: string, change: { name?: string; words?: string }): StampEditProblem | null {
    if (!this.canEdit) return 'forbidden';
    const items = pack.items.map((item) => {
      if (item.id !== id) return item;
      const name = change.name === undefined ? item.name : normalizeStampName(change.name) || item.name;
      const words = change.words === undefined ? item.words : normalizeStampWords(change.words);
      return { ...item, name, words };
    });
    pack.setItems(items);
    return null;
  }

  /** Takes a stamp out of a pack. Its picture stays in the image store. */
  removeStamp(pack: StampPack, id: string): StampEditProblem | null {
    if (!this.canEdit) return 'forbidden';
    pack.setItems(pack.items.filter((item) => item.id !== id));
    return null;
  }

  /** Saves a pack to a zip of its own, with its pictures, as a cut-in is saved. */
  exportPack(pack: StampPack, progress?: (percent: number) => void): Promise<void> {
    return this.saveDataService.saveGameObjectAsync(pack, 'stamp_' + (pack.name || pack.identifier), progress);
  }

  /** Whether the room already has a pack going by the identifier the file carries. */
  existingPackOf(archive: StampPackArchive): StampPack | null {
    const found = this.objectStore.get(archive.identifier);
    return found instanceof StampPack ? found : null;
  }

  /**
   * Reads and checks a pack file without changing anything.
   *
   * The whole file is turned away when it is not a zip, holds no pack, names a stamp wrongly,
   * lacks a picture a stamp shows, or holds a picture that is not a still one of the right size
   * or not what its name says. A picture this seat already holds is not read again.
   */
  async readArchive(file: Blob): Promise<StampPackArchive | StampArchiveProblem> {
    if (file.size > ARCHIVE_BYTES) return 'notArchive';
    let entries: ZipEntry[];
    try {
      entries = await this.fileArchiver.readZipEntriesAsync(file);
    } catch {
      return 'notArchive';
    }
    const xmlEntry = entries.find((entry) => entry.name === PACK_XML);
    if (!xmlEntry) return 'malformed';
    const root = xml2element(await FileReaderUtil.readAsTextAsync(xmlEntry.blob));
    if (!root || root.tagName !== StampPack.aliasName) return 'malformed';

    const identifier = root.getAttribute('identifier') ?? '';
    const name = normalizeStampName(root.getAttribute('name'));
    if (identifier.length === 0 || identifier.length > 128 || name.length === 0) return 'malformed';
    const items = parseStampItemsStrict(root.getAttribute('stamps') ?? '');
    if (isStampProblem(items)) return items;

    const entryByIdentifier = new Map<string, ZipEntry>();
    for (const entry of entries) {
      const saved = SAVED_IMAGE_NAME.exec(entry.name);
      if (saved) entryByIdentifier.set(saved[1], entry);
    }
    const images = new Map<string, File>();
    for (const imageIdentifier of new Set(items.map((item) => item.imageIdentifier))) {
      if (this.holds(imageIdentifier)) continue;
      const entry = entryByIdentifier.get(imageIdentifier);
      if (!entry) return 'missingImage';
      const checked = await this.checkArchivedImage(imageIdentifier, entry);
      if (!checked) return 'badImage';
      images.set(imageIdentifier, checked);
    }
    return { identifier, name, items, images };
  }

  /**
   * Brings a checked pack file into the room.
   *
   * A pack going by the same identifier is brought up to date in place, so it keeps its place
   * and its tab; ask before calling for that. Only the pictures this seat does not hold yet are
   * added, so the same picture is never kept twice.
   */
  async importArchive(archive: StampPackArchive): Promise<StampPack | StampEditProblem> {
    if (!this.canEdit) return 'forbidden';
    const existing = this.existingPackOf(archive);
    if (!existing && this.packs().length >= STAMP_LIMITS.packsPerRoom) return 'packLimit';

    for (const [identifier, image] of archive.images) {
      if (!this.holds(identifier)) await this.imageStorage.addAsync(image);
    }

    // Looked up again after the wait, in case the pack arrived or went meanwhile.
    const target = this.existingPackOf(archive);
    if (target) {
      target.name = archive.name;
      target.setItems(archive.items);
      return target;
    }
    if (this.packs().length >= STAMP_LIMITS.packsPerRoom) return 'packLimit';
    // One deleted here is brought back under a name of its own, or the others would delete it again.
    const pack = new StampPack(this.objectStore.isDeleted(archive.identifier) ? undefined : archive.identifier);
    pack.name = archive.name;
    pack.setItems(archive.items);
    pack.initialize();
    return pack;
  }

  private holds(imageIdentifier: string): boolean {
    const image = this.imageStorage.get(imageIdentifier);
    return image !== null && image.state >= ImageState.COMPLETE;
  }

  /** A picture from a pack file as the file to add, or null when it is not one a stamp may show. */
  private async checkArchivedImage(identifier: string, entry: ZipEntry): Promise<File | null> {
    if (entry.blob.size > STAMP_LIMITS.imageBytes) return null;
    const buffer = await FileReaderUtil.readAsArrayBufferAsync(entry.blob);
    if ((await FileReaderUtil.calcSHA256Async(buffer)) !== identifier) return null;
    const type = MimeType.type(entry.name);
    const blob = new Blob([buffer], { type });
    if (!type.startsWith('image/') || !(await looksLikeImage(blob)) || isAnimatedImageBytes(buffer)) return null;
    if ((await this.measure(blob)) !== 'fits') return null;
    return new File([blob], entry.name, { type });
  }

  /** A picture made ready to be a stamp: checked, shrunk to size, and checked again. */
  private async prepareImage(file: File): Promise<Blob | StampImageProblem> {
    if (file.size > SOURCE_IMAGE_BYTES) return 'tooLarge';
    if (!(await looksLikeImage(file))) return 'notImage';
    if (isAnimatedImageBytes(await FileReaderUtil.readAsArrayBufferAsync(file))) return 'animated';
    const shrunk = await this.shrink(file);
    if (shrunk.size > STAMP_LIMITS.imageBytes) return 'tooLarge';
    const measured = await this.measure(shrunk);
    if (measured !== 'fits') return measured === 'unreadable' ? 'notImage' : 'tooLarge';
    return shrunk;
  }

  /** The picture resampled to the largest side a stamp may have, or as it was where that cannot be done. */
  private async shrink(file: File): Promise<Blob> {
    return (await downscaleImageBlob(file, STAMP_LIMITS.imageSide)) ?? file;
  }

  /**
   * Whether a picture is no wider or taller than a stamp may be, or cannot be drawn at all. Where
   * the browser has no way to measure it, the byte limit alone has to do.
   */
  private async measure(blob: Blob): Promise<'fits' | 'tooLarge' | 'unreadable'> {
    if (typeof createImageBitmap !== 'function') return 'fits';
    try {
      const bitmap = await createImageBitmap(blob);
      const fits = bitmap.width <= STAMP_LIMITS.imageSide && bitmap.height <= STAMP_LIMITS.imageSide;
      bitmap.close();
      return fits ? 'fits' : 'tooLarge';
    } catch {
      return 'unreadable';
    }
  }
}
