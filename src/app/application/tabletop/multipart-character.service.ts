import { inject, Injectable } from '@angular/core';
import { DisclosureService } from '@axe/application/permission/disclosure.service';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { TabletopActionService } from '@axe/application/tabletop/tabletop-action.service';
import { emitFileLoaded } from '@axe/core/event/domain-events';
import { MAX_IMAGE_FILE_SIZE } from '@axe/core/storage/file-archiver';
import { ImageFile, ImageState } from '@axe/core/storage/image-file';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { ObjectStore } from '@axe/core/sync/object-store';
import { generateUuid } from '@axe/core/util/uuid';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ImagePart, imagePartPlacement, validImageParts } from '@axe/domain/character/image-part';
import { encodePartRegion, isLinkedPart, MIN_LINKED_PARTS, partDisplayName } from '@axe/domain/character/part-group';
import { canBrowseImage, ImageTag } from '@axe/domain/media/image-tag';
import { cropImagePart, cropImagePartFrame } from '@axe/infrastructure/media/image-part-crop';

const MAX_GROUP_NAME_LENGTH = 80;

@Injectable({ providedIn: 'root' })
export class MultipartCharacterService {
  private readonly images = inject(ImageStorage);
  private readonly roles = inject(RolePermissionService);
  private readonly disclosure = inject(DisclosureService);
  private readonly tabletop = inject(TabletopService);
  private readonly actions = inject(TabletopActionService);
  private readonly objectStore = inject(ObjectStore);

  mayUse(identifier: string): boolean {
    const image = this.images.get(identifier);
    return (
      this.roles.canEditTabletop &&
      !!image &&
      image.state >= ImageState.COMPLETE &&
      canBrowseImage(ImageTag.get(identifier) ?? null, this.roles.canSeeHidden)
    );
  }

  /**
   * Whether the character on the table may be split into linked parts from the picture it shows.
   * A part is not split again.
   */
  mayLink(character: GameCharacter): boolean {
    return (
      this.objectStore.get(character.identifier) === character &&
      character.isVisibleOnTable &&
      !isLinkedPart(character) &&
      this.disclosure.canView(character) &&
      this.mayUse(character.imageFile.identifier)
    );
  }

  /** Prepares every image before publishing any part to the room. */
  async create(
    identifier: string,
    image: HTMLImageElement,
    parts: readonly ImagePart[],
    stillOpen: () => boolean = () => true
  ): Promise<GameCharacter[]> {
    const source = this.images.get(identifier);
    const sourceUrl = source?.url;
    const table = this.tabletop.currentTable;
    const selections = parts.map((part) => ({ ...part, name: part.name.trim() }));
    if (
      !stillOpen() ||
      !this.mayUse(identifier) ||
      !table.identifier ||
      !validImageParts(selections, image.naturalWidth, image.naturalHeight)
    )
      throw new Error('Unavailable');
    const prepared: ImageFile[] = [];
    const created: GameCharacter[] = [];
    const addedImages: string[] = [];
    const addedTags: ImageTag[] = [];
    try {
      for (const part of selections) prepared.push(await this.prepare(await cropImagePart(image, part), part.name));
      if (
        !stillOpen() ||
        !this.mayUse(identifier) ||
        this.images.get(identifier) !== source ||
        source?.url !== sourceUrl ||
        this.tabletop.currentTable !== table
      )
        throw new Error('Unavailable');
      const stored = this.store(prepared, identifier, addedImages, addedTags);
      for (let i = 0; i < selections.length; i++) {
        const placement = imagePartPlacement(selections[i], image.naturalWidth, image.naturalHeight, table.gridSize);
        const x = (table.width * table.gridSize) / 2 + placement.x;
        const y = (table.height * table.gridSize) / 2 + placement.y;
        const character = this.actions.createGameCharacterWith({ x, y, z: 0 }, selections[i].name, stored[i]);
        created.push(character);
        character.size = placement.size;
        character.location.x = x - (placement.size * table.gridSize) / 2;
        character.location.y = y - (placement.size * table.gridSize) / 2;
        character.update();
      }
      emitFileLoaded();
      return created;
    } catch (error) {
      this.discard(created, addedTags, addedImages);
      throw error;
    } finally {
      this.release(prepared);
    }
  }

  /**
   * Splits a character into linked parts, each a full copy of it showing only its own region.
   *
   * Every part keeps the character's sheet, resources, palettes and buffs as they stand, and from
   * then on keeps its own. They share the character's place, and the character itself goes to the
   * graveyard untouched, where it can be brought back. Nothing reaches the room until every
   * picture is ready.
   */
  async createLinked(
    character: GameCharacter,
    image: HTMLImageElement,
    parts: readonly ImagePart[],
    groupName: string,
    stillOpen: () => boolean = () => true
  ): Promise<GameCharacter[]> {
    const identifier = character.imageFile.identifier;
    const sourceUrl = character.imageFile.url;
    const group = groupName.trim();
    const selections = parts.map((part) => ({ ...part, name: part.name.trim() }));
    if (
      !stillOpen() ||
      !this.mayLink(character) ||
      selections.length < MIN_LINKED_PARTS ||
      group.length < 1 ||
      group.length > MAX_GROUP_NAME_LENGTH ||
      !validImageParts(selections, image.naturalWidth, image.naturalHeight)
    )
      throw new Error('Unavailable');
    const prepared: ImageFile[] = [];
    const created: GameCharacter[] = [];
    const addedImages: string[] = [];
    const addedTags: ImageTag[] = [];
    try {
      for (const part of selections) {
        prepared.push(await this.prepare(await cropImagePartFrame(image, part), `${group}_${part.name}`));
      }
      if (
        !stillOpen() ||
        !this.mayLink(character) ||
        character.imageFile.identifier !== identifier ||
        character.imageFile.url !== sourceUrl
      )
        throw new Error('Unavailable');
      const stored = this.store(prepared, identifier, addedImages, addedTags);
      const key = generateUuid();
      for (let i = 0; i < selections.length; i++) {
        const part = character.clone();
        created.push(part);
        part.name = partDisplayName(group, selections[i].name);
        part.partGroup = key;
        part.partGroupName = group;
        part.partName = selections[i].name;
        part.partRegion = encodePartRegion(selections[i], image.naturalWidth, image.naturalHeight);
        const slot = part.imageSourceElement;
        if (!slot) throw new Error('Unavailable');
        slot.value = stored[i];
        part.update();
      }
      character.setLocation('graveyard');
      emitFileLoaded();
      return created;
    } catch (error) {
      this.discard(created, addedTags, addedImages);
      throw error;
    } finally {
      this.release(prepared);
    }
  }

  private async prepare(blob: Blob, name: string): Promise<ImageFile> {
    if (blob.size > MAX_IMAGE_FILE_SIZE) throw new Error('Oversized');
    return ImageFile.createAsync(new File([blob], `${name}.png`, { type: 'image/png' }));
  }

  /** Registers the prepared pictures, reusing any already there, and returns their identifiers. */
  private store(prepared: ImageFile[], source: string, addedImages: string[], addedTags: ImageTag[]): string[] {
    return prepared.map((file) => {
      const existing = this.images.get(file.identifier);
      const reuse = !!existing && existing.state >= ImageState.COMPLETE;
      const stored = reuse ? existing : this.images.add(file);
      if (reuse && existing !== file) file.destroy();
      if (!existing) addedImages.push(stored.identifier);
      if (!ImageTag.get(stored.identifier)) {
        const tag = ImageTag.create(stored.identifier);
        addedTags.push(tag);
        tag.tag = 'キャラクター';
        tag.isSecret = ImageTag.isSecret(source);
        tag.update();
      }
      return stored.identifier;
    });
  }

  private discard(created: GameCharacter[], addedTags: ImageTag[], addedImages: string[]): void {
    for (const character of created) character.destroy();
    for (const tag of addedTags) tag.destroy();
    for (const identifier of addedImages) this.images.delete(identifier);
  }

  private release(prepared: ImageFile[]): void {
    // Stored entries may share these URLs with an incomplete placeholder; keep those alive.
    for (const file of prepared) if (!this.images.get(file.identifier)) file.destroy();
  }
}
