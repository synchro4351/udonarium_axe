import { inject, Injectable } from '@angular/core';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { TabletopActionService } from '@axe/application/tabletop/tabletop-action.service';
import { emitFileLoaded } from '@axe/core/event/domain-events';
import { MAX_IMAGE_FILE_SIZE } from '@axe/core/storage/file-archiver';
import { ImageFile, ImageState } from '@axe/core/storage/image-file';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ImagePart, imagePartPlacement, validImageParts } from '@axe/domain/character/image-part';
import { canBrowseImage, ImageTag } from '@axe/domain/media/image-tag';
import { cropImagePart } from '@axe/infrastructure/media/image-part-crop';

@Injectable({ providedIn: 'root' })
export class MultipartCharacterService {
  private readonly images = inject(ImageStorage);
  private readonly roles = inject(RolePermissionService);
  private readonly tabletop = inject(TabletopService);
  private readonly actions = inject(TabletopActionService);

  mayUse(identifier: string): boolean {
    const image = this.images.get(identifier);
    return (
      this.roles.canEditTabletop &&
      !!image &&
      image.state >= ImageState.COMPLETE &&
      canBrowseImage(ImageTag.get(identifier) ?? null, this.roles.canSeeHidden)
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
      for (const part of selections) {
        const blob = await cropImagePart(image, part);
        if (blob.size > MAX_IMAGE_FILE_SIZE) throw new Error('Oversized');
        prepared.push(await ImageFile.createAsync(new File([blob], `${part.name}.png`, { type: 'image/png' })));
      }
      if (
        !stillOpen() ||
        !this.mayUse(identifier) ||
        this.images.get(identifier) !== source ||
        source?.url !== sourceUrl ||
        this.tabletop.currentTable !== table
      )
        throw new Error('Unavailable');
      for (let i = 0; i < selections.length; i++) {
        const file = prepared[i];
        const existing = this.images.get(file.identifier);
        const reuse = !!existing && existing.state >= ImageState.COMPLETE;
        const stored = reuse ? existing : this.images.add(file);
        if (reuse && existing !== file) file.destroy();
        if (!existing) addedImages.push(stored.identifier);
        if (!ImageTag.get(stored.identifier)) {
          const tag = ImageTag.create(stored.identifier);
          addedTags.push(tag);
          tag.tag = 'キャラクター';
          tag.isSecret = ImageTag.isSecret(identifier);
          tag.update();
        }
        const placement = imagePartPlacement(selections[i], image.naturalWidth, image.naturalHeight, table.gridSize);
        const x = (table.width * table.gridSize) / 2 + placement.x;
        const y = (table.height * table.gridSize) / 2 + placement.y;
        const character = this.actions.createGameCharacterWith({ x, y, z: 0 }, selections[i].name, stored.identifier);
        created.push(character);
        character.size = placement.size;
        character.location.x = x - (placement.size * table.gridSize) / 2;
        character.location.y = y - (placement.size * table.gridSize) / 2;
        character.update();
      }
      emitFileLoaded();
      return created;
    } catch (error) {
      for (const character of created) character.destroy();
      for (const tag of addedTags) tag.destroy();
      for (const identifier of addedImages) this.images.delete(identifier);
      throw error;
    } finally {
      // Stored entries may share these URLs with an incomplete placeholder; keep those alive.
      for (const file of prepared) if (!this.images.get(file.identifier)) file.destroy();
    }
  }
}
