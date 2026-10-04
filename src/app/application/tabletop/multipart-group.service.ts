import { DestroyRef, inject, Injectable } from '@angular/core';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { ObjectChangeEvent, ObjectChangeService } from '@axe/application/sync/object-change.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { MultiMovableService } from '@axe/application/ui/multi-movable.service';
import { UiSignalService } from '@axe/application/ui/ui-signal.service';
import { ObjectStore } from '@axe/core/sync/object-store';
import { GameCharacter } from '@axe/domain/character/game-character';
import {
  applyPartTransform,
  clearPartGroup,
  decodePartRegion,
  isLinkedPart,
  linkedPartsOf,
  partAnchorOffset,
  partTransformOf,
} from '@axe/domain/character/part-group';
import { DataElement } from '@axe/domain/data/data-element';
import { Config } from '@axe/domain/peer/config';
import { resolveRoomRules } from '@axe/domain/tabletop/room-rules';

/** The common values that are kept as data elements rather than on the piece itself. */
const SHARED_ELEMENTS: ReadonlySet<string> = new Set(['size', 'altitude']);

/**
 * Keeps the parts of a linked group standing together.
 *
 * Only this seat's own changes are passed on, and only to parts out on the table; what arrives
 * from another seat has already been passed on there, so answering it would only fight it. A part
 * coming back to the table takes the group's place rather than dragging the group to wherever it
 * was left, and a part leaving the table takes nobody with it.
 */
@Injectable({ providedIn: 'root' })
export class MultipartGroupService {
  private readonly objectStore = inject(ObjectStore);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly roles = inject(RolePermissionService);
  private readonly multiMovable = inject(MultiMovableService);
  private readonly tabletop = inject(TabletopService);
  private readonly uiSignal = inject(UiSignalService);
  private readonly destroyRef = inject(DestroyRef);
  /** Where each character was last seen, so a return to the table can be told from a move on it. */
  private readonly lastPlace = new Map<string, string>();

  constructor() {
    for (const character of this.objectStore.getObjects(GameCharacter)) this.remember(character);
    this.objectChange.objectAdded$.subscribe((event) => {
      if (event.aliasName !== GameCharacter.aliasName) return;
      const character = this.objectStore.get(event.identifier);
      if (character instanceof GameCharacter) this.remember(character);
    }, this.destroyRef);
    this.objectChange.objectRemoved$.subscribe((event) => this.lastPlace.delete(event.identifier), this.destroyRef);
    this.objectChange.onObjectChangedForAlias(
      [GameCharacter.aliasName, DataElement.aliasName],
      (event) => this.follow(event),
      this.destroyRef
    );
  }

  /** The other parts of the piece's group that are out on the table. */
  linkedPartsOf(character: GameCharacter): GameCharacter[] {
    return linkedPartsOf(character, this.objectStore.getObjects(GameCharacter));
  }

  /** Every character carrying the group key, wherever it is kept. */
  membersOf(group: string): GameCharacter[] {
    if (!group) return [];
    return this.objectStore.getObjects(GameCharacter).filter((character) => character.partGroup === group);
  }

  /** Takes one part out of its group; the rest stay linked. */
  unlink(character: GameCharacter): boolean {
    if (!this.roles.canEditTabletop || !isLinkedPart(character)) return false;
    clearPartGroup(character);
    return true;
  }

  /**
   * Where an effect aimed at the piece lands: its middle, or for a part the middle of its region
   * as the table is being looked at.
   */
  anchorOf(character: GameCharacter, gridSize: number): { x: number; y: number; z: number } {
    const sizePx = gridSize * (character.size > 0 ? character.size : 1);
    const center = { x: character.location.x + sizePx / 2, y: character.location.y + sizePx / 2, z: character.posZ };
    const frame = isLinkedPart(character) ? decodePartRegion(character.partRegion) : null;
    if (!frame) return center;
    const rotation = this.uiSignal.tableViewRotation();
    const table = this.tabletop.currentTable;
    const config = this.objectStore.get<Config>('Config');
    const contain =
      this.tabletop.mode2d() && !!table && resolveRoomRules(config?.roomRuleAnswers ?? null, table).pieceImageInCell;
    const offset = partAnchorOffset(frame, sizePx, {
      mode2d: this.tabletop.mode2d(),
      yawDeg: this.uiSignal.tableViewRotationZ(),
      pitchDeg: rotation?.x ?? 50,
      tiltDeg: rotation?.y ?? 0,
      contain,
      specifiedHeightPx: character.specifyKomaImageFlag && !contain ? character.komaImageHeight : undefined,
    });
    return {
      x: center.x + offset.dx,
      y: center.y + offset.dy,
      z: center.z + offset.dz + (this.tabletop.mode2d() ? 0 : character.altitude * gridSize),
    };
  }

  private remember(character: GameCharacter): void {
    this.lastPlace.set(character.identifier, character.location.name);
  }

  private ownerOf(event: ObjectChangeEvent): GameCharacter | null {
    const object = this.objectStore.get(event.identifier);
    if (object instanceof GameCharacter) return object;
    if (!(object instanceof DataElement) || !SHARED_ELEMENTS.has(object.name)) return null;
    const owner = object.parent?.parent?.parent;
    return owner instanceof GameCharacter && owner.commonDataElement === object.parent ? owner : null;
  }

  private follow(event: ObjectChangeEvent): void {
    const part = this.ownerOf(event);
    if (!part) return;
    const before = this.lastPlace.get(part.identifier);
    const place = part.location.name;
    this.remember(part);
    if (!event.isSendFromSelf || place !== 'table' || !isLinkedPart(part)) return;
    if (!this.roles.canEditTabletop) return;
    // The drag moves its followers itself; it is passed on once the piece is let go.
    if (this.multiMovable.isMoving(part.identifier)) return;
    const linked = this.linkedPartsOf(part);
    if (linked.length < 1) return;
    if (before !== undefined && before !== 'table') {
      applyPartTransform(part, partTransformOf(linked[0]));
      return;
    }
    const transform = partTransformOf(part);
    for (const other of linked) {
      if (this.multiMovable.isMoving(other.identifier)) continue;
      applyPartTransform(other, transform);
    }
  }
}
