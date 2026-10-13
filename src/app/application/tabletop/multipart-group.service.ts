import { DestroyRef, inject, Injectable } from '@angular/core';
import { DisclosureService } from '@axe/application/permission/disclosure.service';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { ObjectChangeEvent, ObjectChangeService } from '@axe/application/sync/object-change.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { MultiMovableService } from '@axe/application/ui/multi-movable.service';
import { UiSignalService } from '@axe/application/ui/ui-signal.service';
import { ObjectStore } from '@axe/core/sync/object-store';
import { generateUuid } from '@axe/core/util/uuid';
import { GameCharacter } from '@axe/domain/character/game-character';
import {
  applyPartTransform,
  clearPartGroup,
  decodePartRegion,
  hasPartRegion,
  isLinkedPart,
  linkedPartsOf,
  partAnchorOffset,
  PartAnchorView,
  partDisplayName,
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
  private readonly disclosure = inject(DisclosureService);
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
    if (
      !this.roles.canEditTabletop ||
      !isLinkedPart(character) ||
      this.objectStore.get(character.identifier) !== character ||
      !this.disclosure.canView(character)
    )
      return false;
    clearPartGroup(character);
    return true;
  }

  /** Links a chosen set of distinct characters while keeping their cropped-picture metadata. */
  link(characters: readonly GameCharacter[]): boolean {
    if (!this.roles.canEditTabletop || characters.length < 2 || characters.some((character) => character.isLock))
      return false;
    const requested = [...new Set(characters)];
    const groups = new Set(requested.map((character) => character.partGroup).filter(Boolean));
    const distinct = [...new Set([...requested, ...[...groups].flatMap((group) => this.membersOf(group))])];
    if (
      distinct.length < 2 ||
      distinct.some(
        (character) =>
          this.objectStore.get(character.identifier) !== character ||
          !this.disclosure.canView(character) ||
          (requested.includes(character) && character.location.name !== 'table') ||
          character.isLock
      )
    )
      return false;
    const transform = partTransformOf(distinct[0]);
    const group = generateUuid();
    const groupName =
      requested.find((character) => character.partGroupName.trim())?.partGroupName.trim() || requested[0].name;
    for (const character of distinct) {
      character.partGroup = group;
      if (!character.partName.trim()) character.partName = character.name;
      character.partGroupName = groupName;
      character.name = partDisplayName(groupName, character.partName);
      if (character.location.name === 'table') applyPartTransform(character, transform);
    }
    return true;
  }

  /** Copies every member of a linked group once, with its own fresh group key. */
  copyGroup(character: GameCharacter): GameCharacter[] {
    if (
      !this.roles.canEditTabletop ||
      this.objectStore.get(character.identifier) !== character ||
      !this.disclosure.canView(character)
    )
      return [];
    const members = isLinkedPart(character) ? this.membersOf(character.partGroup) : [character];
    if (members.length === 0 || members.some((member) => !this.disclosure.canView(member))) return [];
    const group = isLinkedPart(character) && members.length > 1 ? generateUuid() : '';
    const sharedBase = character.partGroupName || character.name.replace(/\([^()]*\)$/, '');
    const baseMatch = sharedBase.match(/^(.*)_([0-9]+)$/);
    const unsuffixedBase = baseMatch?.[1] ?? sharedBase;
    const firstNumber = baseMatch ? Number(baseMatch[2]) + 1 : 2;
    const taken = new Set(
      this.objectStore.getObjects(GameCharacter).flatMap((candidate) => {
        const candidateBase = candidate.partGroupName || candidate.name.replace(/\([^()]*\)$/, '');
        const match = candidateBase.match(/^(.*)_([0-9]+)$/);
        if (!match || match[1] !== unsuffixedBase) return [];
        return [Number(match[2])];
      })
    );
    let sharedSuffix = firstNumber;
    while (taken.has(sharedSuffix)) sharedSuffix++;
    const copiedGroupName = `${unsuffixedBase}_${sharedSuffix}`;
    const copies: GameCharacter[] = [];
    try {
      for (const member of members) {
        const copy = member.clone();
        copies.push(copy);
        copy.partRegion = member.partRegion;
        if (group) {
          copy.partGroup = group;
          copy.partGroupName = copiedGroupName;
          copy.partName = member.partName;
          copy.name = partDisplayName(copiedGroupName, copy.partName);
        }
        if (member.location.name === 'table') {
          copy.location.x += 50;
          copy.location.y += 50;
        }
        member.parent?.appendChild(copy);
        copy.update();
      }
      return copies;
    } catch (error) {
      for (const copy of copies) copy.destroy();
      throw error;
    }
  }

  renameGroup(group: string, name: string): boolean {
    if (!this.roles.canEditTabletop || !group) return false;
    const members = this.membersOf(group);
    if (members.length === 0 || members.some((member) => !this.disclosure.canView(member))) return false;
    for (const member of members) {
      member.partGroupName = name.trim();
      member.name = partDisplayName(member.partGroupName, member.partName);
    }
    return true;
  }

  renamePart(character: GameCharacter, name: string): boolean {
    if (
      !this.roles.canEditTabletop ||
      !isLinkedPart(character) ||
      this.objectStore.get(character.identifier) !== character ||
      !this.disclosure.canView(character)
    )
      return false;
    character.partName = name.trim();
    character.name = partDisplayName(character.partGroupName, character.partName);
    return true;
  }

  /**
   * Where an effect aimed at the piece lands: its middle, or for a part the middle of its region
   * in the table view or a supplied billboard view.
   */
  anchorOf(character: GameCharacter, gridSize: number, view?: PartAnchorView): { x: number; y: number; z: number } {
    const sizePx = gridSize * (character.size > 0 ? character.size : 1);
    const center = { x: character.location.x + sizePx / 2, y: character.location.y + sizePx / 2, z: character.posZ };
    const frame = hasPartRegion(character) ? decodePartRegion(character.partRegion) : null;
    if (!frame) return center;
    const mode2d = view?.mode2d ?? this.tabletop.mode2d();
    const rotation = view
      ? { x: view.pitchDeg ?? 50, y: view.tiltDeg ?? 0, z: view.yawDeg }
      : this.uiSignal.tableViewRotation();
    const table = this.tabletop.currentTable;
    const config = this.objectStore.get<Config>('Config');
    const contain =
      view?.contain ?? (mode2d && !!table && resolveRoomRules(config?.roomRuleAnswers ?? null, table).pieceImageInCell);
    const offset = partAnchorOffset(frame, sizePx, {
      mode2d,
      yawDeg: view?.yawDeg ?? this.uiSignal.tableViewRotationZ(),
      pitchDeg: rotation?.x ?? 50,
      tiltDeg: rotation?.y ?? 0,
      contain,
      specifiedHeightPx:
        view?.specifiedHeightPx ?? (character.specifyKomaImageFlag && !contain ? character.komaImageHeight : undefined),
    });
    return {
      x: center.x + offset.dx,
      y: center.y + offset.dy,
      z: center.z + offset.dz + (mode2d ? 0 : character.altitude * gridSize),
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
