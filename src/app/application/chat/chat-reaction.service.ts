import { inject, Injectable } from '@angular/core';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { getPeerContext } from '@axe/core/network/peer-context-source';
import { ObjectStore } from '@axe/core/sync/object-store';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import type { ChatReactionCount } from '@axe/domain/chat/chat-reaction';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { canRoleSpeakTab, canRoleViewTab } from '@axe/domain/chat/chat-tab-permission';

/**
 * Leaves and takes back this reader's emoji reactions on chat lines, and says which reactions they
 * may see.
 *
 * Reactions follow the line they are left on: whoever may not read a line, a whisper to someone
 * else or a secret roll kept from them, neither sees its reactions nor leaves one. Leaving one also
 * asks to be allowed to speak in the line's tab, as saying something there would.
 */
@Injectable({ providedIn: 'root' })
export class ChatReactionService {
  private readonly objectStore = inject(ObjectStore);
  private readonly rolePermission = inject(RolePermissionService);

  private get myUserId(): string {
    return getPeerContext()?.userId ?? '';
  }

  /** Whether this reader may see the reactions on the line. */
  canSee(message: ChatMessage | null | undefined): boolean {
    if (!message || !this.isLive(message)) return false;
    return message.canReactBy(this.myUserId, this.rolePermission.canSeeHidden);
  }

  /** Whether this reader may leave or take back a reaction on the line. */
  canReact(message: ChatMessage | null | undefined): boolean {
    if (!message || !this.canSee(message)) return false;
    const tab = message.parent;
    if (!(tab instanceof ChatTab)) return false;
    const role = this.rolePermission.myRole;
    return canRoleViewTab(tab, role) && canRoleSpeakTab(tab, role);
  }

  /** The reactions on the line as this reader may see them; empty when they may see none. */
  reactionsOf(message: ChatMessage | null | undefined): readonly ChatReactionCount[] {
    if (!message || !this.canSee(message)) return [];
    return message.reactionsFor(this.myUserId);
  }

  /**
   * Leaves the emoji on the line for this reader, or takes it back when they already left it.
   * Answers whether it is now left.
   *
   * Whether they may is asked again here rather than trusted from when the picker opened, since a
   * line can be whispered, hidden or deleted in between.
   */
  toggle(message: ChatMessage, emoji: string): boolean {
    if (!this.canReact(message)) return false;
    return message.toggleReaction(this.myUserId, emoji);
  }

  private isLive(message: ChatMessage): boolean {
    return this.objectStore.get(message.identifier) === message;
  }
}
