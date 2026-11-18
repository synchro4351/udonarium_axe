import { inject, Injectable } from '@angular/core';
import type { AgentHandler } from '@axe/application/agent/agent-tool-runner.service';
import { EffectLibraryService } from '@axe/application/effect/effect-library.service';
import { HotbarOfferService } from '@axe/application/hotbar/hotbar-offer.service';
import { AgentToolError } from '@axe/core/agent/agent-error';
import { AudioStorage } from '@axe/core/storage/audio-storage';
import { ObjectStore } from '@axe/core/sync/object-store';
import { emptyHotbarSlotDraft, HotbarSlotDraft } from '@axe/domain/hotbar/hotbar-draft';
import { HotbarOffer, HotbarOfferSlot } from '@axe/domain/hotbar/hotbar-offer';
import { TURN_ACTIONS, TurnAction } from '@axe/domain/hotbar/hotbar-payload';
import { CutIn } from '@axe/domain/media/cut-in';
import { findOne, textArg } from '@axe/features/agent-tools/agent-lookup';
import { AgentReadTools } from '@axe/features/agent-tools/agent-read-tools.service';

/** One slot as the AI asks for it. */
type AskedSlot = Readonly<Record<string, unknown>>;

/**
 * The hotbar tool: builds a page of slots from what the AI asks for, each pointing at
 * things the room has, and hands it round the chat as a template for the players to take.
 */
@Injectable({ providedIn: 'root' })
export class AgentHotbarTools {
  private readonly read = inject(AgentReadTools);
  private readonly offers = inject(HotbarOfferService);
  private readonly effects = inject(EffectLibraryService);
  private readonly audioStorage = inject(AudioStorage);
  private readonly objectStore = inject(ObjectStore);

  readonly handlers: Readonly<Record<string, AgentHandler>> = {
    offer_hotbar: (args) => this.offerHotbar(args),
  };

  private offerHotbar(args: Readonly<Record<string, unknown>>): unknown {
    const asked = args['slots'] as readonly AskedSlot[];
    const places = new Set<number>();
    for (const slot of asked) {
      const place = slot['slot'] as number;
      if (places.has(place)) throw new AgentToolError('invalid_input', `Slot ${place} is given twice.`);
      places.add(place);
    }
    const slots: HotbarOfferSlot[] = asked.map((slot) => ({
      slotIndex: (slot['slot'] as number) - 1,
      draft: this.draft(slot, places, asked),
    }));
    const offer: HotbarOffer = { title: textArg(args, 'title').trim(), slots };
    const tab = this.read.tab(textArg(args, 'tab'));
    if (!this.offers.send(tab, offer)) {
      throw new AgentToolError('not_allowed', `This seat may not speak in ${tab.name}.`);
    }
    return { offered: offer.title, slots: slots.length, tab: tab.name };
  }

  private draft(slot: AskedSlot, places: ReadonlySet<number>, asked: readonly AskedSlot[]): HotbarSlotDraft {
    const at = slot['slot'] as number;
    const draft = this.bareDraft(slot, at, places, asked);
    draft.label = textArg(slot, 'label').trim();
    draft.icon = textArg(slot, 'icon');
    draft.color = textArg(slot, 'color').trim();
    return draft;
  }

  private bareDraft(
    slot: AskedSlot,
    at: number,
    places: ReadonlySet<number>,
    asked: readonly AskedSlot[]
  ): HotbarSlotDraft {
    switch (slot['kind']) {
      case 'chat':
      case 'prefill': {
        const draft = emptyHotbarSlotDraft(slot['kind']);
        draft.value = this.needText(slot, at);
        return draft;
      }
      case 'effect': {
        const name = textArg(slot, 'name').trim();
        const preset = this.effects.get(name) ?? this.effects.findByName(name);
        if (!preset) throw new AgentToolError('not_found', `Slot ${at}: there is no effect named ${name}.`);
        const draft = emptyHotbarSlotDraft('effect');
        draft.value = preset.name;
        draft.valueName = preset.name;
        return draft;
      }
      case 'sound': {
        const audio = findOne(
          this.audioStorage.audios,
          textArg(slot, 'name'),
          (one) => one.identifier,
          (one) => one.name,
          'sound'
        );
        const draft = emptyHotbarSlotDraft('sound');
        draft.value = audio.identifier;
        draft.valueName = audio.name;
        return draft;
      }
      case 'cut_in': {
        const cutIn = findOne(
          this.objectStore.getObjects<CutIn>(CutIn),
          textArg(slot, 'name'),
          (one) => one.identifier,
          (one) => one.name,
          'cut-in'
        );
        const draft = emptyHotbarSlotDraft('cutIn');
        draft.value = cutIn.identifier;
        draft.valueName = cutIn.name;
        return draft;
      }
      case 'turn': {
        const draft = emptyHotbarSlotDraft('turn');
        const action = textArg(slot, 'turn', 'next');
        draft.payload = {
          kind: 'turn',
          action: (TURN_ACTIONS as readonly string[]).includes(action) ? (action as TurnAction) : 'next',
        };
        return draft;
      }
      case 'sheet': {
        const draft = emptyHotbarSlotDraft('panel');
        draft.payload = { kind: 'panel', panel: 'sheet' };
        return draft;
      }
      case 'group':
        return this.groupDraft(slot, at, places, asked);
      default:
        throw new AgentToolError('invalid_input', `Slot ${at}: no slot does ${String(slot['kind'])}.`);
    }
  }

  private groupDraft(
    slot: AskedSlot,
    at: number,
    places: ReadonlySet<number>,
    asked: readonly AskedSlot[]
  ): HotbarSlotDraft {
    const steps = (slot['steps'] as readonly number[] | undefined) ?? [];
    if (steps.length < 1) throw new AgentToolError('invalid_input', `Slot ${at}: a group needs steps.`);
    for (const step of steps) {
      if (!places.has(step)) {
        throw new AgentToolError('invalid_input', `Slot ${at}: step ${step} is not a slot of this template.`);
      }
      if (asked.find((one) => one['slot'] === step)?.['kind'] === 'group') {
        throw new AgentToolError('invalid_input', `Slot ${at}: step ${step} is a group, and a group does not run one.`);
      }
    }
    const wait = typeof slot['wait_ms'] === 'number' ? slot['wait_ms'] : 0;
    const draft = emptyHotbarSlotDraft('group');
    draft.payload = {
      kind: 'group',
      steps: steps.map((step, order) => ({
        page: 0,
        slotIndex: step - 1,
        slotIdentifier: '',
        delayMs: order === 0 ? 0 : wait,
      })),
    };
    return draft;
  }

  private needText(slot: AskedSlot, at: number): string {
    const text = textArg(slot, 'text');
    if (!text.trim()) throw new AgentToolError('invalid_input', `Slot ${at}: give the text.`);
    return text;
  }
}
