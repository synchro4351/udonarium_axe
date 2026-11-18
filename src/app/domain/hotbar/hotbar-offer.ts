import { Hotbar } from '@axe/domain/hotbar/hotbar';
import {
  draftOfSlot,
  encodeHotbarSlotDraft,
  HotbarSlotDraft,
  parseHotbarSlotDraft,
} from '@axe/domain/hotbar/hotbar-draft';
import { HotbarPayload } from '@axe/domain/hotbar/hotbar-payload';
import { HOTBAR_PAGES, HOTBAR_SLOTS_PER_PAGE } from '@axe/domain/hotbar/hotbar-size';

/** The longest title a template carries. */
export const HOTBAR_OFFER_TITLE_MAX = 60;

/** One slot of a template, by its place on the page. */
export interface HotbarOfferSlot {
  slotIndex: number;
  draft: HotbarSlotDraft;
}

/**
 * A page of a hotbar handed round the room, for anyone to take onto their own bar.
 *
 * A bar is each reader's own, so nobody can set up someone else's; what can be handed round is a page
 * of slots, put in the chat by whoever made it, a player or the AI, and taken by whoever wants it. A
 * template is one page, so a group's steps keep pointing at the slots beside them wherever it lands.
 * The slots act as whoever the reader is speaking as, since a piece named in someone else's bar is
 * not the reader's.
 */
export interface HotbarOffer {
  title: string;
  slots: HotbarOfferSlot[];
}

/** Writes a template as the JSON string a chat line carries, the reverse of `parseHotbarOffer`. */
export function encodeHotbarOffer(offer: HotbarOffer): string {
  return JSON.stringify({
    title: offer.title,
    slots: offer.slots.map((slot) => ({ slotIndex: slot.slotIndex, draft: encodeHotbarSlotDraft(slot.draft) })),
  });
}

/**
 * Reads a template back from a chat line. Null for anything that holds no slot this bar can take;
 * a slot outside the page, or a second one in the same place, is left out.
 */
export function parseHotbarOffer(raw: unknown): HotbarOffer | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const held = parsed as Record<string, unknown>;
  if (!Array.isArray(held['slots'])) return null;

  const taken = new Set<number>();
  const slots: HotbarOfferSlot[] = [];
  for (const one of held['slots'] as unknown[]) {
    const record = one as Record<string, unknown> | null;
    const slotIndex = Number(record?.['slotIndex']);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= HOTBAR_SLOTS_PER_PAGE) continue;
    if (taken.has(slotIndex)) continue;
    const draft = parseHotbarSlotDraft(record?.['draft']);
    if (!draft) continue;
    taken.add(slotIndex);
    slots.push({ slotIndex, draft });
  }
  if (slots.length < 1) return null;
  const title = typeof held['title'] === 'string' ? held['title'].trim().slice(0, HOTBAR_OFFER_TITLE_MAX) : '';
  return { title, slots: slots.sort((a, b) => a.slotIndex - b.slotIndex) };
}

/**
 * A page of a reader's own bar as a template to hand round, or null where the page is empty. The
 * pieces its slots name are let go of, so each slot acts as whoever takes it is speaking as.
 */
export function offerOfPage(hotbar: Hotbar, page: number, title: string): HotbarOffer | null {
  const slots = hotbar
    .slotsOn(page)
    .map((slot) => ({ slotIndex: slot.slotNo, draft: unboundDraft(draftOfSlot(slot)) }))
    .sort((a, b) => a.slotIndex - b.slotIndex);
  if (slots.length < 1) return null;
  return { title: title.trim().slice(0, HOTBAR_OFFER_TITLE_MAX), slots };
}

/** The first page of a bar with nothing on it, where a template lands; null where every page holds something. */
export function emptyHotbarPage(hotbar: Hotbar | null): number | null {
  for (let page = 0; page < HOTBAR_PAGES; page++) {
    if (!hotbar || hotbar.slotsOn(page).length < 1) return page;
  }
  return null;
}

/**
 * Puts a template's slots onto a page of a bar, each in its place, the steps of its groups pointed at
 * the slots of that page. Returns how many slots were put.
 */
export function placeHotbarOffer(hotbar: Hotbar, page: number, offer: HotbarOffer): number {
  let put = 0;
  for (const slot of offer.slots) {
    const draft = { ...slot.draft, payload: onPage(slot.draft.payload, page) };
    if (hotbar.put(page, slot.slotIndex, draft)) put++;
  }
  return put;
}

/** A group's steps found by their place on the page they land on, since the slots are made afresh there. */
function onPage(payload: HotbarPayload, page: number): HotbarPayload {
  if (payload.kind !== 'group') return payload;
  return { ...payload, steps: payload.steps.map((step) => ({ ...step, page, slotIdentifier: '' })) };
}

function unboundDraft(draft: HotbarSlotDraft): HotbarSlotDraft {
  return { ...draft, characterIdentifier: '', characterName: '' };
}
