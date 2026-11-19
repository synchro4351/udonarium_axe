import { inject, Injectable } from '@angular/core';
import type { AgentHandler } from '@axe/application/agent/agent-tool-runner.service';
import { AgentViews } from '@axe/application/agent/agent-views.service';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { StampPackService } from '@axe/application/chat/stamp-pack.service';
import { StampRulesService } from '@axe/application/chat/stamp-rules.service';
import { encodeI18nList, encodeI18nMessage } from '@axe/application/i18n/i18n-message';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { GameObjectInventoryService } from '@axe/application/inventory/game-object-inventory.service';
import { AgentToolError } from '@axe/core/agent/agent-error';
import { Network } from '@axe/core/network/network';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Alarm } from '@axe/domain/alarm/alarm';
import { GameCharacter } from '@axe/domain/character/game-character';
import { BUILTIN_STAMPS, stampNameKey } from '@axe/domain/chat/stamp-catalog';
import { STAMP_WORDS, stampMatchesQuery } from '@axe/domain/chat/stamp-words';
import { DataElement } from '@axe/domain/data/data-element';
import { SortOrder } from '@axe/domain/data/data-summary-setting';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { Vote } from '@axe/domain/vote/vote';
import { findOne, numberArg, textArg } from '@axe/features/agent-tools/agent-lookup';
import { AgentReadTools } from '@axe/features/agent-tools/agent-read-tools.service';

/** The sheet item the turn order is written into where the inventory sorts by none. */
const TURN_ORDER_KEY = '行動順';
/** How many stamps list_stamps gives at most. */
const STAMPS_LISTED = 200;

/** A stamp as it is offered to the AI. */
interface AgentStamp {
  readonly id: string;
  readonly name: string;
}

/**
 * The tools that set the table up in plain words: the turn order and the inventory's
 * order, alarms, votes and stamps, each done as the menus do it, as the linked seat.
 */
@Injectable({ providedIn: 'root' })
export class AgentTableTools {
  private readonly read = inject(AgentReadTools);
  private readonly views = inject(AgentViews);
  private readonly inventory = inject(GameObjectInventoryService);
  private readonly objectStore = inject(ObjectStore);
  private readonly chat = inject(ChatMessageService);
  private readonly stampPacks = inject(StampPackService);
  private readonly stampRules = inject(StampRulesService);
  private readonly t = inject(TRANSLATE_FN);

  readonly handlers: Readonly<Record<string, AgentHandler>> = {
    set_turn_order: (args) => this.setTurnOrder(args),
    set_inventory_order: (args) => {
      this.inventory.sortTag = textArg(args, 'by').trim();
      this.inventory.sortOrder = orderOf(textArg(args, 'order'));
      if (typeof args['then_by'] === 'string') this.inventory.sortTag2nd = textArg(args, 'then_by').trim();
      if (typeof args['then_order'] === 'string') this.inventory.sortOrder2nd = orderOf(textArg(args, 'then_order'));
      return this.inventoryOrder();
    },
    set_alarm: (args) => this.setAlarm(args),
    start_vote: (args) => this.startVote(args),
    list_stamps: (args) => {
      const query = textArg(args, 'name');
      // Found by the words a stamp goes by as well as its name, as the picker finds them.
      const fits = this.stamps().filter((stamp) =>
        stampMatchesQuery([stamp.name, ...(STAMP_WORDS[stamp.id] ?? [])], query)
      );
      return { stamps: fits.slice(0, STAMPS_LISTED) };
    },
    send_stamp: (args) => this.sendStamp(args),
  };

  private setTurnOrder(args: Readonly<Record<string, unknown>>): unknown {
    const pieces = (args['pieces'] as readonly string[]).map((reference) => this.read.piece(reference));
    const seen = new Set<string>();
    for (const piece of pieces) {
      if (seen.has(piece.identifier)) {
        throw new AgentToolError('invalid_input', `${this.views.nameOf(piece)} is named twice in the order.`);
      }
      seen.add(piece.identifier);
      if (!this.views.sheetOpen(piece)) {
        throw new AgentToolError('not_allowed', `This seat may not open the sheet of ${this.views.nameOf(piece)}.`);
      }
    }
    const key = textArg(args, 'key').trim() || this.inventory.sortTag || TURN_ORDER_KEY;
    pieces.forEach((piece, index) => this.writeNumber(piece, key, pieces.length - index));
    this.inventory.sortTag = key;
    this.inventory.sortOrder = SortOrder.DESC;
    return { key, order: pieces.map((piece) => this.views.nameOf(piece)), inventory: this.inventoryOrder() };
  }

  /** Writes a number into a piece's sheet item, adding the item at the end of its sheet where it lacks it. */
  private writeNumber(piece: GameCharacter, key: string, value: number): void {
    const root = piece.detailDataElement;
    if (!root) throw new AgentToolError('failed', `${this.views.nameOf(piece)} has no sheet to write into.`);
    const item = DataElement.findElementByReference(root, key);
    if (item) item.value = value;
    else root.appendChild(DataElement.create(key, value, {}));
  }

  private inventoryOrder(): unknown {
    return {
      by: this.inventory.sortTag,
      order: this.inventory.sortOrder === SortOrder.DESC ? 'descending' : 'ascending',
      thenBy: this.inventory.sortTag2nd,
      thenOrder: this.inventory.sortOrder2nd === SortOrder.DESC ? 'descending' : 'ascending',
    };
  }

  private setAlarm(args: Readonly<Record<string, unknown>>): unknown {
    if (PeerCursor.isMyselfKeptOffTable) throw new AgentToolError('not_allowed', 'This seat is kept off the table.');
    const alarm = this.objectStore.get<Alarm>('Alarm');
    if (!alarm) throw new AgentToolError('failed', 'The room has no alarm.');
    const seconds = Math.min(3600, Math.max(1, Math.floor(numberArg(args, 'seconds', 60))));
    const { peerIds, everyone, names } = this.targets(args['to']);
    const target = everyone ? encodeI18nMessage('feature.alarm.targetAll') : ` >${names.join(' ')} `;
    alarm.makeAlarm(
      seconds,
      textArg(args, 'title'),
      peerIds,
      PeerCursor.myCursor.peerId,
      target,
      args['sound'] !== false,
      args['popup'] !== false
    );
    this.chat.sendSystemMessageAsLastSpeaker(
      encodeI18nList([encodeI18nMessage('feature.alarm.setMessage', { seconds }), target], '')
    );
    alarm.startAlarm();
    return { seconds, to: everyone ? 'everyone' : names };
  }

  private startVote(args: Readonly<Record<string, unknown>>): unknown {
    if (PeerCursor.isMyselfKeptOffTable) throw new AgentToolError('not_allowed', 'This seat is kept off the table.');
    const vote = this.objectStore.get<Vote>('Vote');
    if (!vote) throw new AgentToolError('failed', 'The room has no vote.');
    const tab = this.read.tab(textArg(args, 'tab'));
    const choices = ((args['choices'] as readonly string[] | undefined) ?? []).map((choice) => choice.trim());
    const rollCall = choices.length === 0;
    const secret = args['secret'] === true;
    const title = rollCall ? this.t('feature.vote.rollCall') : textArg(args, 'title');
    const { peerIds, names, everyone } = this.targets(args['to']);
    vote.makeVote(
      PeerCursor.myCursor.peerId,
      title,
      peerIds,
      rollCall ? [this.t('feature.vote.rollCallReady')] : choices,
      rollCall,
      tab.identifier,
      secret
    );
    vote.startVote();
    const message = rollCall
      ? encodeI18nMessage('feature.vote.rollCallStart')
      : encodeI18nMessage(secret ? 'feature.vote.voteStartSecret' : 'feature.vote.voteStart', { title });
    this.chat.sendSystemMessageAsLastSpeaker(message, tab.identifier);
    return { rollCall, title, choices, secret, to: everyone ? 'everyone' : names };
  }

  /** The peers the seats named are linked as, this seat's own among them; everyone where none are named. */
  private targets(given: unknown): { peerIds: string[]; names: string[]; everyone: boolean } {
    const me = PeerCursor.myCursor;
    const others = Network.instance.peerContexts
      .map(
        (context) =>
          PeerCursor.findByPeerId(context.peerId) ?? (context.userId ? PeerCursor.findByUserId(context.userId) : null)
      )
      .filter((cursor): cursor is PeerCursor => cursor !== null);
    const seats = [me, ...others];
    const wanted = Array.isArray(given) ? (given as string[]) : [];
    if (wanted.length === 0) {
      return {
        peerIds: seats.map((cursor) => cursor.peerId),
        names: seats.map((cursor) => cursor.name),
        everyone: true,
      };
    }
    const chosen = wanted.map((name) =>
      findOne(
        seats,
        name,
        (cursor) => cursor.userId,
        (cursor) => cursor.name,
        'seat'
      )
    );
    return {
      peerIds: chosen.map((cursor) => cursor.peerId),
      names: chosen.map((cursor) => cursor.name),
      everyone: false,
    };
  }

  private stamps(): AgentStamp[] {
    const builtin = BUILTIN_STAMPS.map((stamp) => ({ id: stamp.id, name: this.t(stampNameKey(stamp)) }));
    const room = this.stampPacks
      .packs()
      .flatMap((pack) => pack.stamps.map((stamp) => ({ id: stamp.stampId, name: stamp.name })));
    return [...builtin, ...room].filter((stamp) => this.stampRules.allows('line', stamp.id));
  }

  private sendStamp(args: Readonly<Record<string, unknown>>): unknown {
    const stamp = findOne(
      this.stamps(),
      textArg(args, 'stamp'),
      (one) => one.id,
      (one) => one.name,
      'stamp'
    );
    const tab = this.read.tab(textArg(args, 'tab'));
    // Marked as the AI's, as the chat tool marks the lines it sends.
    const sent = this.chat.asAiWords(() =>
      this.chat.sendStamp(tab, stamp.id, stamp.name, PeerCursor.myCursor.identifier)
    );
    if (!sent) throw new AgentToolError('not_allowed', `The stamp ${stamp.name} cannot be sent here.`);
    return { sent: stamp.name, tab: tab.name };
  }
}

function orderOf(text: string): SortOrder {
  return text === 'descending' ? SortOrder.DESC : SortOrder.ASC;
}
