import { SyncObject, SyncVar } from '@axe/core/sync/decorator';
import { ObjectNode } from '@axe/core/sync/object-node';
import { applyPersistedIdentifier } from '@axe/core/sync/persisted-identifier';
import { imageStampId } from '@axe/domain/chat/stamp-catalog';
import { DataElement, DataElementType } from '@axe/domain/data/data-element';

const LEGACY_STAMP_ID = 'tyoitashi-stamp-id';
const LEGACY_STAMP_WORDS = 'tyoitashi-stamp-words';

/** One stamp in the older pack format, retained as a compatibility view of picture children. */
export interface StampItem {
  readonly id: string;
  readonly name: string;
  readonly imageIdentifier: string;
  readonly words: readonly string[];
}

/** One stamp in a room's set: a picture from the room, under the name it goes by. */
export interface PackedStamp {
  readonly stampId: string;
  readonly imageIdentifier: string;
  readonly name: string;
  readonly element: DataElement;
}

/**
 * A set of stamps the room has made from its own pictures, as a server keeps its own stickers.
 *
 * Each stamp is a picture element under the set, named as the stamp is, so the pictures go into a
 * saved room with it. A stamp is known by its picture, not by its place in a set, so a line already
 * answered with one still shows it after the set is changed or gone.
 */
@SyncObject('stamp-pack')
export class StampPack extends ObjectNode {
  @SyncVar() name: string = '';

  /** Keeps the pack's stable id in room exports so other saves can replace it by id. */
  override toAttributes() {
    return { ...super.toAttributes(), identifier: this.identifier };
  }

  /** Restores the stable id unless it is already taken in this room, in which case this is a copy. */
  override parseAttributes(attributes: NamedNodeMap): void {
    super.parseAttributes(attributes);
    const persisted = this.attributes['identifier'];
    delete this.attributes['identifier'];
    applyPersistedIdentifier(this, persisted, { whenTaken: 'copy' });
  }

  /** The stamps in the set, once each, in the order they were added. */
  get stamps(): PackedStamp[] {
    const seen = new Set<string>();
    const stamps: PackedStamp[] = [];
    for (const child of this.children) {
      if (!(child instanceof DataElement) || child.type !== DataElementType.IMAGE) continue;
      const imageIdentifier = `${child.value ?? ''}`.trim();
      if (imageIdentifier.length < 1 || seen.has(imageIdentifier)) continue;
      seen.add(imageIdentifier);
      stamps.push({ stampId: imageStampId(imageIdentifier), imageIdentifier, name: child.name, element: child });
    }
    return stamps;
  }

  /** The older pack API, with its original id and search words carried on each picture element. */
  get items(): readonly StampItem[] {
    return this.children
      .filter((child): child is DataElement => child instanceof DataElement && child.type === DataElementType.IMAGE)
      .map((element) => {
        const imageIdentifier = `${element.value ?? ''}`.trim();
        return {
          id: element.getAttribute(LEGACY_STAMP_ID) || imageStampId(imageIdentifier),
          name: element.name,
          imageIdentifier,
          words: readLegacyWords(element.getAttribute(LEGACY_STAMP_WORDS)),
        };
      });
  }

  /** Replaces the picture children with stamps from the older pack API. */
  setItems(items: readonly StampItem[]): void {
    for (const child of [...this.children]) child.destroy();
    for (const item of items) {
      const imageIdentifier = item.imageIdentifier.trim();
      if (!imageIdentifier) continue;
      const element = DataElement.create(item.name, imageIdentifier, { type: DataElementType.IMAGE });
      this.appendChild(element);
      if (item.id && item.id !== imageStampId(imageIdentifier)) element.setAttribute(LEGACY_STAMP_ID, item.id);
      if (item.words.length > 0) element.setAttribute(LEGACY_STAMP_WORDS, JSON.stringify(item.words));
    }
  }

  /** Finds an older stamp by its stored id or the official catalog id. */
  itemOf(id: string): StampItem | null {
    return this.items.find((stamp) => stamp.id === id || imageStampId(stamp.imageIdentifier) === id) ?? null;
  }

  /** The picture identifiers carried by this pack, once each. */
  get carriedImageIdentifiers(): readonly string[] {
    return [...new Set(this.stamps.map((stamp) => stamp.imageIdentifier))];
  }

  /** Adds a picture as a stamp under a name, unless it is in the set already. The stamp's element, or null. */
  addStamp(imageIdentifier: string, name: string): DataElement | null {
    const identifier = imageIdentifier.trim();
    if (identifier.length < 1 || this.stamps.some((stamp) => stamp.imageIdentifier === identifier)) return null;
    const element = DataElement.create(name, identifier, { type: DataElementType.IMAGE });
    this.appendChild(element);
    return element;
  }

  /** Makes an empty set under a name and adds it to the room. */
  static create(name: string): StampPack {
    const pack = new StampPack();
    pack.name = name;
    pack.initialize();
    return pack;
  }

  /** Reads old JSON stamps into the picture children used by current saves. */
  override parseInnerXml(element: Element): void {
    super.parseInnerXml(element);
    const legacy = this.getAttribute('stamps');
    if (!legacy || this.stamps.length > 0) return;

    const items = parseLegacyStampItems(legacy);
    if (!items) return;
    for (const item of items) {
      const picture = DataElement.create(item.name, item.imageIdentifier, { type: DataElementType.IMAGE });
      this.appendChild(picture);
      if (item.id !== imageStampId(item.imageIdentifier)) picture.setAttribute(LEGACY_STAMP_ID, item.id);
      if (item.words.length > 0) picture.setAttribute(LEGACY_STAMP_WORDS, JSON.stringify(item.words));
    }
    delete this.attributes['stamps'];
  }
}

function parseLegacyStampItems(raw: string): StampItem[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const items: StampItem[] = [];
  for (const value of parsed) {
    if (typeof value !== 'object' || value === null) continue;
    const source = value as Record<string, unknown>;
    if (
      typeof source['id'] !== 'string' ||
      !source['id'] ||
      typeof source['imageIdentifier'] !== 'string' ||
      !source['imageIdentifier']
    )
      continue;
    items.push({
      id: source['id'],
      imageIdentifier: source['imageIdentifier'],
      name: typeof source['name'] === 'string' ? source['name'] : '',
      words: Array.isArray(source['words'])
        ? source['words'].filter((word): word is string => typeof word === 'string')
        : [],
    });
  }
  return items;
}

function readLegacyWords(raw: string): readonly string[] {
  if (!raw) return [];
  try {
    const words: unknown = JSON.parse(raw);
    return Array.isArray(words) ? words.filter((word): word is string => typeof word === 'string') : [];
  } catch {
    return [];
  }
}
