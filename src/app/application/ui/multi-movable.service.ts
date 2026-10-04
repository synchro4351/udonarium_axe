import { inject, Injectable } from '@angular/core';
import { SelectionSignalService } from '@axe/application/ui/selection-signal.service';
import { GameCharacter } from '@axe/domain/character/game-character';
import { isLinkedPart, linkedPartsOf } from '@axe/domain/character/part-group';
import { isLockedInPlace } from '@axe/domain/tabletop/lockable';
import { TabletopObject } from '@axe/domain/tabletop/tabletop-object';

export interface MovableLike {
  readonly identifier: string;
  readonly tabletopObject: TabletopObject | undefined;
  posX: number;
  posY: number;
}

interface FollowerSnapshot {
  ref: MovableLike;
  startX: number;
  startY: number;
}

@Injectable({ providedIn: 'root' })
export class MultiMovableService {
  private readonly selectionSignalService = inject(SelectionSignalService);

  private readonly registry = new Map<string, MovableLike>();

  private leaderId: string | null = null;
  private leaderStartX = 0;
  private leaderStartY = 0;
  private followers: FollowerSnapshot[] = [];

  /**
   * Makes a movable piece reachable by identifier, so it can follow along when a selection it
   * belongs to is dragged.
   */
  register(ref: MovableLike): void {
    if (!ref.identifier) return;
    this.registry.set(ref.identifier, ref);
  }

  /**
   * Forgets a movable piece that is going away, ending the group drag if the piece was leading it.
   */
  unregister(ref: MovableLike): void {
    if (!ref.identifier) return;
    if (this.registry.get(ref.identifier) === ref) {
      this.registry.delete(ref.identifier);
    }
    if (this.leaderId === ref.identifier) {
      this.clear();
    } else {
      this.followers = this.followers.filter((f) => f.ref.identifier !== ref.identifier);
    }
  }

  /**
   * Starts a group drag led by one piece, and says whether anything will follow it.
   *
   * A selected piece brings the other unlocked selected pieces. A linked part also brings its
   * group without selection; unrelated selected pieces stay where they are in that case.
   */
  beginDrag(leader: MovableLike): boolean {
    const selected = this.selectionSignalService.selectedObjects();
    const selectedLeader = selected.has(leader.identifier);
    const linkedLeader = leader.tabletopObject instanceof GameCharacter && isLinkedPart(leader.tabletopObject);
    if (!leader.identifier || (!selectedLeader && !linkedLeader)) {
      this.clear();
      return false;
    }
    this.leaderId = leader.identifier;
    this.leaderStartX = leader.posX;
    this.leaderStartY = leader.posY;
    this.followers = [];
    for (const id of selectedLeader ? selected : []) {
      if (id === leader.identifier) continue;
      const ref = this.registry.get(id);
      if (!ref) continue;
      if (this.isLocked(ref)) continue;
      this.followers.push({ ref, startX: ref.posX, startY: ref.posY });
    }
    this.addLinkedParts(leader);
    if (selectedLeader) {
      const expanded = new Set(linkedLeader ? [(leader.tabletopObject as GameCharacter).partGroup] : []);
      for (const id of selected) {
        const ref = this.registry.get(id);
        const object = ref?.tabletopObject;
        if (ref && object instanceof GameCharacter && isLinkedPart(object) && !this.isLocked(ref)) {
          if (expanded.has(object.partGroup)) continue;
          expanded.add(object.partGroup);
          this.addLinkedParts(ref);
        }
      }
    }
    return this.followers.length > 0;
  }

  /**
   * The parts linked to a dragged part come along, starting from the leader's own place: a group
   * stands on one spot, so one that had drifted apart is brought back together by the drag.
   */
  private addLinkedParts(leader: MovableLike): void {
    const part = leader.tabletopObject;
    if (!(part instanceof GameCharacter) || !isLinkedPart(part)) return;
    const following = new Set(this.followers.map((f) => f.ref.identifier));
    const linked = linkedPartsOf(
      part,
      [...this.registry.values()]
        .map((ref) => ref.tabletopObject)
        .filter((object): object is GameCharacter => object instanceof GameCharacter)
    );
    for (const other of linked) {
      if (following.has(other.identifier)) {
        this.followers = this.followers.filter((f) => f.ref.identifier !== other.identifier);
      }
      const ref = this.registry.get(other.identifier);
      if (ref) this.followers.push({ ref, startX: leader.posX, startY: leader.posY });
    }
  }

  /** Whether the piece is leading or following a drag that is under way. */
  isMoving(identifier: string): boolean {
    if (!identifier || this.leaderId === null) return false;
    return this.leaderId === identifier || this.followers.some((f) => f.ref.identifier === identifier);
  }

  /**
   * Moves every follower by however far the leader has come since the drag began. Ignored for
   * anything but the current leader.
   */
  applyLeaderDelta(leader: MovableLike): void {
    if (this.leaderId !== leader.identifier) return;
    const dx = leader.posX - this.leaderStartX;
    const dy = leader.posY - this.leaderStartY;
    for (const f of this.followers) {
      f.ref.posX = f.startX + dx;
      f.ref.posY = f.startY + dy;
    }
  }

  /** Ends the group drag, if this piece is the one leading it. */
  endDrag(leader: MovableLike): void {
    if (this.leaderId !== leader.identifier) return;
    this.clear();
  }

  /**
   * The objects following a leader in the current group drag, or nothing when that piece is not
   * leading one.
   */
  followerTabletopObjectsFor(leaderIdentifier: string): readonly TabletopObject[] {
    if (!leaderIdentifier || this.leaderId !== leaderIdentifier) return [];
    const result: TabletopObject[] = [];
    for (const f of this.followers) {
      const obj = f.ref.tabletopObject;
      if (obj) result.push(obj);
    }
    return result;
  }

  private clear(): void {
    this.leaderId = null;
    this.followers = [];
  }

  private isLocked(ref: MovableLike): boolean {
    const obj = ref.tabletopObject;
    if (!obj) return false;
    return isLockedInPlace(obj);
  }
}
